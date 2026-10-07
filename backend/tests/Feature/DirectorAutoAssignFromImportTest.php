<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class DirectorAutoAssignFromImportTest extends TestCase
{
    use RefreshDatabase;

    private function makeXlsxUpload(array $rows): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getActiveSheet()->fromArray($rows, null, 'A1');

        $path = tempnam(sys_get_temp_dir(), 'xlsx') . '.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return new UploadedFile($path, 'import.xlsx', null, null, true);
    }

    public function test_director_sees_project_in_own_list_after_import_without_manual_assignment(): void
    {
        // 案件を取り込むときの「アカウントディレクター」名とディレクター本人の登録名が
        // 一致すれば、手動アサインなしで一覧に自動的に出るようになっている想定。
        $admin    = User::factory()->create(['role' => 'admin']);
        $director = User::factory()->create(['name' => '山田太郎', 'role' => 'director']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-020', 'クライアントZ', '案件Z', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '0', '', '', '受注'],
        ]);

        $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file])->assertOk();

        $response = $this->actingAs($director)->getJson('/api/admin/projects')->assertOk();

        $names = collect($response->json())->pluck('project_name')->all();
        $this->assertContains('案件Z', $names);
    }

    public function test_director_also_sees_project_of_a_different_director(): void
    {
        // 一覧は全案件が対象になったため、他ディレクター担当としてインポートされた案件も
        // 一覧に出て、工数集計まで参照できる。
        $admin = User::factory()->create(['role' => 'admin']);
        $director = User::factory()->create(['name' => '自分', 'role' => 'director']);
        User::factory()->create(['name' => '他人', 'role' => 'director']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-021', 'クライアントY', '他人担当案件', '他人', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '0', '', '', '受注'],
        ]);

        $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file])->assertOk();

        $project = Project::where('ts_project_code', 'TS-021')->firstOrFail();

        $response = $this->actingAs($director)->getJson('/api/admin/projects')->assertOk();
        $this->assertContains('他人担当案件', collect($response->json())->pluck('project_name')->all());

        $this->actingAs($director)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();
    }
}
