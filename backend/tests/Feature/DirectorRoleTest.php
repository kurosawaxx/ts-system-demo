<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DirectorRoleTest extends TestCase
{
    use RefreshDatabase;

    private function makeProjectWithMember(User $member, ?string $accountDirector = null): Project
    {
        $project = Project::create(['project_name' => 'テスト案件', 'account_director' => $accountDirector]);
        $project->users()->attach($member->id);

        return $project;
    }

    public function test_director_can_view_and_sync_assignees_for_own_project(): void
    {
        $director = User::factory()->create(['role' => 'director']);
        $project = $this->makeProjectWithMember($director, $director->name);
        $other = User::factory()->create(['role' => 'user']);

        $this->actingAs($director)
            ->getJson("/api/admin/projects/{$project->id}/users")
            ->assertOk();

        $this->actingAs($director)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk()
            ->assertJsonStructure(['months', 'users']);

        $this->actingAs($director)
            ->putJson("/api/admin/projects/{$project->id}/users", ['user_ids' => [$director->id, $other->id]])
            ->assertOk();

        $this->assertTrue($project->users()->where('user_id', $other->id)->exists());
    }

    public function test_director_project_list_includes_all_projects(): void
    {
        // ディレクターも管理者と同じく全案件を一覧で見られる(担当案件だけには絞らない)。
        $director = User::factory()->create(['role' => 'director']);
        $ownProject = $this->makeProjectWithMember($director, $director->name);
        $other = User::factory()->create(['role' => 'user']);
        $othersProject = $this->makeProjectWithMember($other);

        $response = $this->actingAs($director)
            ->getJson('/api/admin/projects')
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($ownProject->id, $ids);
        $this->assertContains($othersProject->id, $ids);
    }

    public function test_admin_project_list_includes_all_projects(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $userA = User::factory()->create(['role' => 'user']);
        $userB = User::factory()->create(['role' => 'user']);
        $projectA = $this->makeProjectWithMember($userA);
        $projectB = $this->makeProjectWithMember($userB);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/projects')
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($projectA->id, $ids);
        $this->assertContains($projectB->id, $ids);
    }

    public function test_general_user_forbidden_from_project_list(): void
    {
        $user = User::factory()->create(['role' => 'user']);

        $this->actingAs($user)
            ->getJson('/api/admin/projects')
            ->assertForbidden();
    }

    public function test_director_can_access_project_of_another_account_director(): void
    {
        // 一覧が全案件になったため、自分がアカウントディレクターでない案件でも
        // 担当者の参照・設定・工数集計ができる(管理者と同等の扱い)。
        $director = User::factory()->create(['role' => 'director']);
        $otherDirector = User::factory()->create(['role' => 'director']);
        $someoneElse = User::factory()->create(['role' => 'user']);
        $project = $this->makeProjectWithMember($someoneElse, $otherDirector->name);

        $this->actingAs($director)
            ->getJson("/api/admin/projects/{$project->id}/users")
            ->assertOk();

        $this->actingAs($director)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $this->actingAs($director)
            ->putJson("/api/admin/projects/{$project->id}/users", ['user_ids' => [$someoneElse->id]])
            ->assertOk();
    }

    public function test_director_cannot_access_admin_only_project_detail_endpoint(): void
    {
        // Admin\ProjectController::show (粗利等の管理者専用情報を含む) は
        // role:admin のみのルートグループに属しており、ディレクターは
        // 自分がアサインされた案件であっても到達できないことを固定化する。
        $director = User::factory()->create(['role' => 'director']);
        $project = $this->makeProjectWithMember($director, $director->name);

        $this->actingAs($director)
            ->getJson("/api/admin/projects/{$project->id}")
            ->assertForbidden();
    }

    public function test_general_user_still_forbidden_from_assignee_endpoints(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $project = $this->makeProjectWithMember($user);

        $this->actingAs($user)
            ->getJson("/api/admin/projects/{$project->id}/users")
            ->assertForbidden();

        $this->actingAs($user)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertForbidden();
    }

    public function test_users_hours_excludes_directors(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $director = User::factory()->create(['role' => 'director']);
        $member = User::factory()->create(['role' => 'user']);

        $project = Project::create(['project_name' => 'テスト案件']);
        $project->users()->attach([$admin->id, $director->id, $member->id]);

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/projects/{$project->id}/users-hours")
            ->assertOk();

        $ids = collect($response->json('users'))->pluck('id')->all();
        $this->assertContains($admin->id, $ids);
        $this->assertContains($member->id, $ids);
        $this->assertNotContains($director->id, $ids);
    }

    public function test_director_sees_only_general_users_in_user_list(): void
    {
        $director = User::factory()->create(['role' => 'director']);
        $otherDirector = User::factory()->create(['role' => 'director']);
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        $response = $this->actingAs($director)
            ->getJson('/api/admin/users')
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($member->id, $ids);
        $this->assertNotContains($otherDirector->id, $ids);
        $this->assertNotContains($admin->id, $ids);
        $this->assertNotContains($director->id, $ids);
    }

    public function test_admin_sees_all_roles_in_user_list(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $director = User::factory()->create(['role' => 'director']);
        $member = User::factory()->create(['role' => 'user']);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/users')
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($admin->id, $ids);
        $this->assertContains($director->id, $ids);
        $this->assertContains($member->id, $ids);
    }

    public function test_guest_gets_unauthenticated_response(): void
    {
        $project = Project::create(['project_name' => 'テスト案件']);

        $this->getJson("/api/admin/projects/{$project->id}/users")
            ->assertUnauthorized();
    }

    public function test_director_can_view_own_project_detail_via_general_endpoint(): void
    {
        // /projects/{id} はディレクター・一般ユーザー共用のエンドポイント。
        // ディレクターはproject_userへの紐付けが無くてもaccount_director一致で見られる。
        $director = User::factory()->create(['role' => 'director']);
        $project = Project::create(['project_name' => 'テスト案件', 'account_director' => $director->name]);

        $this->actingAs($director)
            ->getJson("/api/projects/{$project->id}")
            ->assertOk();
    }

    public function test_director_can_view_other_directors_project_detail_via_general_endpoint(): void
    {
        // 一覧から他のアカウントディレクターの案件も開けるようにする。
        $director = User::factory()->create(['role' => 'director']);
        $otherDirector = User::factory()->create(['role' => 'director']);
        $project = Project::create(['project_name' => 'テスト案件', 'account_director' => $otherDirector->name]);

        $this->actingAs($director)
            ->getJson("/api/projects/{$project->id}")
            ->assertOk();
    }

    public function test_general_user_cannot_view_project_they_are_not_assigned_to(): void
    {
        // ディレクターの制限を外しても、一般ユーザーはアサインされた案件しか見られない。
        $user = User::factory()->create(['role' => 'user']);
        $someoneElse = User::factory()->create(['role' => 'user']);
        $project = $this->makeProjectWithMember($someoneElse);

        $this->actingAs($user)
            ->getJson("/api/projects/{$project->id}")
            ->assertForbidden();
    }

    public function test_general_user_can_still_view_own_assigned_project_detail(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $project = $this->makeProjectWithMember($user);

        $this->actingAs($user)
            ->getJson("/api/projects/{$project->id}")
            ->assertOk();
    }
}
