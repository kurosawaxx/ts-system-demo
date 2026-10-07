<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberProjectListColumnsTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_project_list_includes_planned_and_actual_hours(): void
    {
        // 担当案件一覧に予定工数と実働工数を時間で返す。
        // 予定工数は計画明細の計画額 ÷ 人日単価 × 1人日あたりの時間(案件詳細の「予定」と同じ計算)。
        // 実働工数は work_hours の実入力時間の合計。どちらも自分以外の担当者の分も含む案件全体の値。
        $user = User::factory()->create(['role' => 'user', 'day_cost' => 32000]);
        $other = User::factory()->create(['role' => 'user', 'day_cost' => 24000]);

        $project = Project::create(['project_name' => '工数比較テスト案件']);
        $project->users()->attach([$user->id, $other->id]);

        // 80000 / 32000 = 2.5人日 → 20h、24000 / 24000 = 1人日 → 8h。合計 28h
        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $user->id, 'position_name' => 'コーダー', 'assignee_name' => $user->name, 'work_month' => '2026-05-01', 'planned_cost' => 80000]);
        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $other->id, 'position_name' => 'デザイナー', 'assignee_name' => $other->name, 'work_month' => '2026-05-01', 'planned_cost' => 24000]);

        // 実入力時間の合計をそのまま小数第二位まで保持する(人日換算による丸めはしない)。
        WorkHour::create(['project_id' => $project->id, 'user_id' => $user->id, 'work_date' => '2026-05-01', 'hours' => 8.52]);
        WorkHour::create(['project_id' => $project->id, 'user_id' => $other->id, 'work_date' => '2026-05-01', 'hours' => 4.0]);

        $data = collect($this->actingAs($user)->getJson('/api/projects')->assertOk()->json())
            ->firstWhere('id', $project->id);

        $this->assertSame(28.0, (float) $data['total_planned_hours']);
        $this->assertSame(12.52, (float) $data['total_actual_hours']);
    }

    public function test_member_project_list_hours_exclude_director_and_admin(): void
    {
        // 予定工数・実働工数はメンバー(role=user)の分のみ。
        // ディレクター/管理者は作業者として数えない(管理者側の実働工数出力と同じ扱い)。
        $user = User::factory()->create(['role' => 'user', 'day_cost' => 32000]);
        $director = User::factory()->create(['role' => 'director', 'day_cost' => 40000]);
        $admin = User::factory()->create(['role' => 'admin', 'day_cost' => 40000]);

        $project = Project::create(['project_name' => 'ロール除外テスト案件']);
        $project->users()->attach([$user->id, $director->id, $admin->id]);

        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $user->id, 'position_name' => 'コーダー', 'assignee_name' => $user->name, 'work_month' => '2026-05-01', 'planned_cost' => 32000]);
        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $director->id, 'position_name' => 'ディレクション', 'assignee_name' => $director->name, 'work_month' => '2026-05-01', 'planned_cost' => 40000]);
        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $admin->id, 'position_name' => '管理', 'assignee_name' => $admin->name, 'work_month' => '2026-05-01', 'planned_cost' => 40000]);

        WorkHour::create(['project_id' => $project->id, 'user_id' => $user->id, 'work_date' => '2026-05-01', 'hours' => 5.0]);
        WorkHour::create(['project_id' => $project->id, 'user_id' => $director->id, 'work_date' => '2026-05-01', 'hours' => 3.0]);
        WorkHour::create(['project_id' => $project->id, 'user_id' => $admin->id, 'work_date' => '2026-05-01', 'hours' => 2.0]);

        $data = collect($this->actingAs($user)->getJson('/api/projects')->assertOk()->json())
            ->firstWhere('id', $project->id);

        $this->assertSame(8.0, (float) $data['total_planned_hours']);
        $this->assertSame(5.0, (float) $data['total_actual_hours']);
    }

    public function test_member_project_list_planned_hours_exclude_work_items_without_assignee(): void
    {
        // 明細名が職種名のみで担当者が特定できない行は人日単価が決まらないため予定工数に含めない
        // (案件詳細の「担当者別・月次稼働」も同じく担当者が紐づく明細のみを対象にしている)。
        $user = User::factory()->create(['role' => 'user', 'day_cost' => 32000]);

        $project = Project::create(['project_name' => '担当者未確定明細あり案件']);
        $project->users()->attach($user->id);

        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $user->id, 'position_name' => 'コーダー', 'assignee_name' => $user->name, 'work_month' => '2026-05-01', 'planned_cost' => 32000]);
        // インポート時は明細名から作業者名を取るが、ユーザーマスタに無い名前だと user_id が紐づかない。
        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => null, 'position_name' => 'コーダー', 'assignee_name' => '未登録の作業者', 'work_month' => '2026-05-01', 'planned_cost' => 500000]);

        $data = collect($this->actingAs($user)->getJson('/api/projects')->assertOk()->json())
            ->firstWhere('id', $project->id);

        $this->assertSame(8.0, (float) $data['total_planned_hours']);
    }

    public function test_member_project_list_returns_zero_hours_without_plan_and_work_hours(): void
    {
        $user = User::factory()->create(['role' => 'user', 'day_cost' => 32000]);

        $project = Project::create(['project_name' => '計画も工数も無い案件']);
        $project->users()->attach($user->id);

        $data = collect($this->actingAs($user)->getJson('/api/projects')->assertOk()->json())
            ->firstWhere('id', $project->id);

        $this->assertSame(0.0, (float) $data['total_planned_hours']);
        $this->assertSame(0.0, (float) $data['total_actual_hours']);
    }

    public function test_member_project_list_does_not_expose_amount_or_cost_fields(): void
    {
        // 工数超過の確認に金額は不要なため返さない。
        // (金額と工数が揃うと day_cost が逆算できてしまうため、メンバー向けには工数のみ開示する)
        $user = User::factory()->create(['role' => 'user', 'day_cost' => 32000]);

        $project = Project::create([
            'project_name' => '金額非開示案件',
            'amount' => 1000000,
            'direct_outsourcing_cost_plan' => 500000,
        ]);
        $project->users()->attach($user->id);

        ProjectWorkItem::create(['project_id' => $project->id, 'user_id' => $user->id, 'position_name' => 'コーダー', 'assignee_name' => $user->name, 'work_month' => '2026-05-01', 'planned_cost' => 32000]);
        WorkHour::create(['project_id' => $project->id, 'user_id' => $user->id, 'work_date' => '2026-05-01', 'hours' => 8.0]);

        $data = collect($this->actingAs($user)->getJson('/api/projects')->assertOk()->json())
            ->firstWhere('id', $project->id);

        $this->assertArrayNotHasKey('amount', $data);
        $this->assertArrayNotHasKey('direct_outsourcing_cost_plan', $data);
        $this->assertArrayNotHasKey('total_cost', $data);
        $this->assertArrayNotHasKey('gross_profit', $data);
        $this->assertArrayNotHasKey('margin', $data);
    }

    public function test_member_project_list_excludes_projects_user_is_not_assigned_to(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $other = User::factory()->create(['role' => 'user']);

        $assigned = Project::create(['project_name' => '担当案件']);
        $assigned->users()->attach($user->id);

        $notAssigned = Project::create(['project_name' => '他人の案件']);
        $notAssigned->users()->attach($other->id);

        $names = collect($this->actingAs($user)->getJson('/api/projects')->assertOk()->json())
            ->pluck('project_name')->all();

        $this->assertEquals(['担当案件'], $names);
    }

    public function test_guest_cannot_access_member_project_list(): void
    {
        $this->getJson('/api/projects')->assertUnauthorized();
    }
}
