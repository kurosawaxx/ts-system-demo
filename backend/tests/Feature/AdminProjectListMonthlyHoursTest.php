<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * 案件一覧エクスポートを取込元ファイルと同じ明細行(案件×担当者×明細月)で出力するため、
 * 管理者向け案件一覧APIが担当者ごとの月別内訳(monthly)を返すことを検証する。
 */
class AdminProjectListMonthlyHoursTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_monthly_breakdown_merging_plan_and_actual_months(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        $project = Project::create(['project_name' => 'テスト案件']);
        $project->users()->attach($member->id);

        WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'work_date' => '2026-02-10',
            'hours' => 8,
        ]);
        WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'work_date' => '2026-02-12',
            'hours' => 4.5,
        ]);

        // 明細月は計画明細にのみ存在する月(2026-03)も行として残す
        ProjectWorkItem::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'position_name' => 'コーダー',
            'assignee_name' => $member->name,
            'work_month' => '2026-03-01',
            'planned_cost' => 40000,
        ]);

        $response = $this->actingAs($admin)->getJson('/api/admin/projects')->assertOk();

        $user = collect($response->json('0.users'))->firstWhere('id', $member->id);

        $this->assertSame(
            [
                ['month' => '2026-02', 'actual_hours' => 12.5],
                ['month' => '2026-03', 'actual_hours' => 0],
            ],
            $user['monthly']
        );
        $this->assertEquals(12.5, $user['actual_hours']);
    }

    public function test_index_returns_empty_monthly_for_member_without_work_items_or_hours(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        $project = Project::create(['project_name' => '実績なし案件']);
        $project->users()->attach($member->id);

        $response = $this->actingAs($admin)->getJson('/api/admin/projects')->assertOk();

        $user = collect($response->json('0.users'))->firstWhere('id', $member->id);

        $this->assertSame([], $user['monthly']);
        $this->assertEquals(0, $user['actual_hours']);
    }

    public function test_index_requires_admin_role(): void
    {
        $member = User::factory()->create(['role' => 'user']);

        $this->actingAs($member)->getJson('/api/admin/projects')->assertForbidden();
    }
}
