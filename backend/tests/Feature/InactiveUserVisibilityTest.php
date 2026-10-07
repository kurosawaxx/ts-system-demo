<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * 退職者の扱いを論理削除から無効化(is_active)へ一本化したため、
 * 無効メンバーの担当実績が画面から消えないことを検証する。
 *
 * 論理削除時代は SoftDeletes のグローバルスコープで Eloquent の全クエリから静かに落ち、
 * 案件一覧エクスポートの担当者行が丸ごと欠落したり、担当者アサインの保存で
 * project_user 行が暗黙に削除されたりしていた。is_active はグローバルスコープを持たないが、
 * 担当者候補からは意図的に除外しているためアサイン保存の穴だけは残る。
 */
class InactiveUserVisibilityTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: User, 2: Project} */
    private function projectWithInactiveMember(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $inactive = User::factory()->create(['role' => 'user', 'day_cost' => 40000]);

        $project = Project::create(['project_name' => '無効メンバーが担当した案件']);
        $project->users()->attach($inactive->id);

        WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $inactive->id,
            'work_date' => '2026-02-10',
            'hours' => 8,
        ]);

        $inactive->update(['is_active' => false]);

        return [$admin, $inactive, $project];
    }

    public function test_sync_users_keeps_assignment_of_inactive_member(): void
    {
        [$admin, $inactive, $project] = $this->projectWithInactiveMember();
        $active = User::factory()->create(['role' => 'user']);

        // 無効メンバーは担当者候補に出ないため、画面から送られる user_ids には含まれない。
        $this->actingAs($admin)
            ->putJson("/api/admin/projects/{$project->id}/users", ['user_ids' => [$active->id]])
            ->assertOk();

        $this->assertDatabaseHas('project_user', [
            'project_id' => $project->id,
            'user_id' => $inactive->id,
        ]);
        $this->assertDatabaseHas('project_user', [
            'project_id' => $project->id,
            'user_id' => $active->id,
        ]);
    }

    public function test_sync_users_does_not_duplicate_when_inactive_id_is_sent_back(): void
    {
        [$admin, $inactive, $project] = $this->projectWithInactiveMember();

        $this->actingAs($admin)
            ->putJson("/api/admin/projects/{$project->id}/users", ['user_ids' => [$inactive->id]])
            ->assertOk();

        $this->assertSame(1, $project->users()->count());
    }

    public function test_sync_users_still_removes_active_member_when_unselected(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $removed = User::factory()->create(['role' => 'user']);
        $kept = User::factory()->create(['role' => 'user']);

        $project = Project::create(['project_name' => '担当者入れ替えの案件']);
        $project->users()->attach([$removed->id, $kept->id]);

        $this->actingAs($admin)
            ->putJson("/api/admin/projects/{$project->id}/users", ['user_ids' => [$kept->id]])
            ->assertOk();

        $this->assertDatabaseMissing('project_user', [
            'project_id' => $project->id,
            'user_id' => $removed->id,
        ]);
    }

    public function test_admin_project_index_includes_inactive_member_with_hours(): void
    {
        [$admin, $inactive, $project] = $this->projectWithInactiveMember();

        $response = $this->actingAs($admin)->getJson('/api/admin/projects')->assertOk();

        $user = collect($response->json('0.users'))->firstWhere('id', $inactive->id);

        $this->assertNotNull($user, '無効メンバーがエクスポート元の users から欠落している');
        $this->assertFalse($user['is_active']);
        $this->assertEquals(8, $user['actual_hours']);
        $this->assertSame([['month' => '2026-02', 'actual_hours' => 8]], $user['monthly']);
    }

    public function test_users_hours_returns_inactive_flag(): void
    {
        [$admin, $inactive, $project] = $this->projectWithInactiveMember();

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $user = collect($response->json('users'))->firstWhere('id', $inactive->id);

        $this->assertNotNull($user);
        $this->assertFalse($user['is_active']);
        $this->assertEquals(8, $user['total_actual_hours']);
    }

    public function test_active_member_is_reported_as_active(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user', 'day_cost' => 40000]);

        $project = Project::create(['project_name' => '現役メンバーの案件']);
        $project->users()->attach($member->id);

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $this->assertTrue(collect($response->json('users'))->firstWhere('id', $member->id)['is_active']);
    }

    public function test_sync_users_requires_admin_or_director_role(): void
    {
        [, , $project] = $this->projectWithInactiveMember();
        $member = User::factory()->create(['role' => 'user']);

        $this->actingAs($member)
            ->putJson("/api/admin/projects/{$project->id}/users", ['user_ids' => []])
            ->assertForbidden();
    }
}
