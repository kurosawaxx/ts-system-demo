<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * 原価・粗利は work_hours の時間に users.day_cost(現在値)を掛けて算出していたため、
 * 単価を改定すると過去の案件の原価・粗利・予定人日が遡って変わっていた。
 * 工数入力時/インポート時の単価をスナップショットして、確定した数字が動かないことを検証する。
 */
class DayCostSnapshotTest extends TestCase
{
    use RefreshDatabase;

    private function makeXlsxUpload(array $rows): UploadedFile
    {
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getActiveSheet()->fromArray($rows, null, 'A1');

        $path = tempnam(sys_get_temp_dir(), 'xlsx').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return new UploadedFile($path, 'import.xlsx', null, null, true);
    }

    /** @return array{0: User, 1: Project} */
    private function projectWithMember(float $dayCost): array
    {
        $member = User::factory()->create(['role' => 'user', 'day_cost' => $dayCost]);
        $project = Project::create(['project_name' => '単価スナップショット検証', 'amount' => 1000000]);
        $project->users()->attach($member->id);

        return [$member, $project];
    }

    private function postWorkHour(User $member, Project $project, string $date, float $hours): void
    {
        $this->actingAs($member)
            ->postJson("/api/projects/{$project->id}/work-hours", ['work_date' => $date, 'hours' => $hours])
            ->assertCreated();
    }

    public function test_work_hour_stores_day_cost_snapshot_on_input(): void
    {
        [$member, $project] = $this->projectWithMember(40000);

        $this->postWorkHour($member, $project, '2026-02-10', 8);

        $this->assertEquals(40000, WorkHour::firstOrFail()->day_cost);
    }

    public function test_past_cost_and_profit_do_not_move_when_rate_is_revised(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$member, $project] = $this->projectWithMember(40000);

        $this->postWorkHour($member, $project, '2026-02-10', 8);

        // 8h / 8h per day * 40,000 = 40,000
        $listBefore = $this->actingAs($admin)->getJson('/api/admin/projects')->assertOk();
        $this->assertEquals(40000, $listBefore->json('0.total_cost'));
        $this->assertEquals(960000, $listBefore->json('0.gross_profit'));

        $member->update(['day_cost' => 80000]);

        $listAfter = $this->actingAs($admin)->getJson('/api/admin/projects')->assertOk();
        $this->assertEquals(40000, $listAfter->json('0.total_cost'), '単価改定で案件一覧の原価が動いた');
        $this->assertEquals(960000, $listAfter->json('0.gross_profit'), '単価改定で粗利が動いた');

        // 案件詳細(loadProfitMetrics)も同じ基準で出す
        $detail = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}")->assertOk();
        $this->assertEquals(40000, $detail->json('total_cost'), '単価改定で案件詳細の原価が動いた');

        // 担当者別・月次稼働の実績原価も動かない
        $hours = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertOk();
        $this->assertEquals(40000, $hours->json('users.0.total_actual_cost'));
        $this->assertEquals(40000, $hours->json('total_actual_cost'));
    }

    public function test_new_input_after_revision_uses_the_new_rate(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$member, $project] = $this->projectWithMember(40000);

        $this->postWorkHour($member, $project, '2026-02-10', 8);
        $member->update(['day_cost' => 48000]);
        $this->postWorkHour($member, $project, '2026-03-10', 8);

        $hours = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertOk();

        // 2月は旧単価、3月は新単価で積まれる
        $this->assertEquals(40000, $hours->json('users.0.monthly.2026-02.actual_cost'));
        $this->assertEquals(48000, $hours->json('users.0.monthly.2026-03.actual_cost'));
        $this->assertEquals(88000, $hours->json('users.0.total_actual_cost'));
    }

    public function test_users_hours_reports_rate_range_when_revised_mid_project(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$member, $project] = $this->projectWithMember(40000);

        $this->postWorkHour($member, $project, '2026-02-10', 8);
        $member->update(['day_cost' => 48000]);
        $this->postWorkHour($member, $project, '2026-03-10', 8);

        $hours = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertOk();

        $this->assertEquals(40000, $hours->json('users.0.day_cost_min'));
        $this->assertEquals(48000, $hours->json('users.0.day_cost_max'));
    }

    public function test_users_hours_reports_single_rate_when_unchanged(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$member, $project] = $this->projectWithMember(40000);

        $this->postWorkHour($member, $project, '2026-02-10', 8);

        $hours = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertOk();

        $this->assertEquals(40000, $hours->json('users.0.day_cost_min'));
        $this->assertEquals(40000, $hours->json('users.0.day_cost_max'));
    }

    public function test_unset_rate_is_left_null_and_falls_back_to_the_current_rate(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$member, $project] = $this->projectWithMember(0);

        $this->postWorkHour($member, $project, '2026-02-10', 8);

        // 単価未設定のまま入力した行は固定せず NULL にしておく
        $this->assertNull(WorkHour::firstOrFail()->day_cost);
        $this->assertEquals(0, $this->actingAs($admin)->getJson('/api/admin/projects')->json('0.total_cost'));

        // 後から単価を設定すれば原価に反映される(0 で固定してしまうと永久に 0 のままになる)
        $member->update(['day_cost' => 40000]);

        $this->assertEquals(40000, $this->actingAs($admin)->getJson('/api/admin/projects')->json('0.total_cost'));
    }

    public function test_editing_hours_later_keeps_the_original_rate(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$member, $project] = $this->projectWithMember(40000);

        $this->postWorkHour($member, $project, '2026-02-10', 8);
        $workHour = WorkHour::firstOrFail();

        $member->update(['day_cost' => 80000]);

        $this->actingAs($member)
            ->putJson("/api/projects/{$project->id}/work-hours/{$workHour->id}", ['hours' => 4])
            ->assertOk();

        // 時間だけ半分になり、単価は入力当時のまま
        $this->assertEquals(40000, $workHour->fresh()->day_cost);
        $this->assertEquals(20000, $this->actingAs($admin)->getJson('/api/admin/projects')->json('0.total_cost'));
    }

    public function test_import_snapshots_rate_and_planned_days_stay_fixed_after_revision(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user', 'name' => '鈴木一郎', 'day_cost' => 40000]);

        $rows = [
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-100', 'クライアントA', '案件A', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '200000', '案件A_コーダー_鈴木一郎_20260305', '2026-03-05', '受注'],
        ];

        $this->actingAs($admin)
            ->postJson('/api/admin/projects/import-csv', ['file' => $this->makeXlsxUpload($rows)])
            ->assertOk();

        $item = ProjectWorkItem::firstOrFail();
        $this->assertSame($member->id, $item->user_id, '明細名から担当者が特定できていない');
        $this->assertEquals(40000, $item->day_cost);

        $project = Project::where('ts_project_code', 'TS-100')->firstOrFail();

        // 200,000 / 40,000 = 5.0 人日
        $before = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertOk();
        $this->assertEquals(5.0, $before->json('users.0.total_planned_days'));

        $member->update(['day_cost' => 50000]);

        $after = $this->actingAs($admin)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertOk();
        $this->assertEquals(5.0, $after->json('users.0.total_planned_days'), '単価改定で予定人日が動いた');

        // 担当案件一覧の予定工数(時間換算)も動かない: 5.0人日 * 8h = 40h
        $memberList = $this->actingAs($member)->getJson('/api/projects')->assertOk();
        $this->assertEquals(40.0, $memberList->json('0.total_planned_hours'));
    }

    public function test_reimport_does_not_overwrite_the_original_rate(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user', 'name' => '鈴木一郎', 'day_cost' => 40000]);

        $rows = [
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-101', 'クライアントA', '案件A', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '200000', '案件A_コーダー_鈴木一郎_20260305', '2026-03-05', '受注'],
        ];

        $this->actingAs($admin)
            ->postJson('/api/admin/projects/import-csv', ['file' => $this->makeXlsxUpload($rows)])
            ->assertOk();

        $member->update(['day_cost' => 50000]);

        $this->actingAs($admin)
            ->postJson('/api/admin/projects/import-csv', ['file' => $this->makeXlsxUpload($rows)])
            ->assertOk();

        $this->assertEquals(40000, ProjectWorkItem::firstOrFail()->day_cost, '再インポートで単価が上書きされた');
        $this->assertSame(1, ProjectWorkItem::count());
    }
}
