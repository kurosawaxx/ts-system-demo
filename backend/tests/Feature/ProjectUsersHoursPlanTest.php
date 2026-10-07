<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectUsersHoursPlanTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_hours_returns_actual_and_planned_breakdown_by_month(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user', 'day_cost' => 32000]);

        $project = Project::create(['project_name' => 'テスト案件']);
        $project->users()->attach($member->id);

        WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'work_date' => '2026-02-10',
            'hours' => 16,
        ]);

        ProjectWorkItem::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'position_name' => 'コーダー',
            'assignee_name' => $member->name,
            'work_month' => '2026-02-01',
            'planned_cost' => 80000,
        ]);
        ProjectWorkItem::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'position_name' => 'コーダー',
            'assignee_name' => $member->name,
            'work_month' => '2026-03-01',
            'planned_cost' => 40000,
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $this->assertSame(['2026-02', '2026-03'], $response->json('months'));

        $users = collect($response->json('users'));
        $user = $users->firstWhere('id', $member->id);

        // 実績: 2026-02に16時間 => 2人日、人日単価32000円 => 64000円
        $this->assertEquals(16.0, $user['monthly']['2026-02']['actual_hours']);
        $this->assertEquals(64000.0, $user['monthly']['2026-02']['actual_cost']);
        $this->assertEquals(0.0, $user['monthly']['2026-03']['actual_hours']);

        // 予定: 2026-02の計画80000円 ÷ 人日単価32000円 = 2.5人日
        $this->assertEquals(2.5, $user['monthly']['2026-02']['planned_days']);
        $this->assertEquals(80000.0, $user['monthly']['2026-02']['planned_cost']);
        $this->assertEquals(1.25, $user['monthly']['2026-03']['planned_days']);
        $this->assertEquals(40000.0, $user['monthly']['2026-03']['planned_cost']);

        $this->assertEquals(64000.0, $response->json('total_actual_cost'));
        $this->assertEquals(120000.0, $response->json('total_planned_cost'));
    }

    public function test_users_hours_includes_planned_only_user_not_manually_assigned(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $planOnlyUser = User::factory()->create(['role' => 'user', 'day_cost' => 24000]);

        $project = Project::create(['project_name' => 'テスト案件2']);
        // project_userには未アサインだが、project_work_itemsには存在するケース
        ProjectWorkItem::create([
            'project_id' => $project->id,
            'user_id' => $planOnlyUser->id,
            'position_name' => 'デザイナー',
            'assignee_name' => $planOnlyUser->name,
            'work_month' => '2026-04-01',
            'planned_cost' => 30000,
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $ids = collect($response->json('users'))->pluck('id')->all();
        $this->assertContains($planOnlyUser->id, $ids);
    }

    public function test_total_planned_cost_includes_unmatched_cost_line_items(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = Project::create(['project_name' => 'テスト案件3']);

        ProjectWorkItem::create([
            'project_id' => $project->id,
            'user_id' => null,
            'position_name' => null,
            'assignee_name' => 'ドメイン費用',
            'work_month' => '2026-05-01',
            'planned_cost' => 5000,
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $this->assertEquals(5000.0, $response->json('total_planned_cost'));
        $this->assertSame([], $response->json('users'));
    }
}
