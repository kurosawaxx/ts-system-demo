<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountDirectorOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_gets_directors_admins_and_users_used_as_account_director(): void
    {
        $admin = User::factory()->create(['name' => '管理者', 'role' => 'admin']);
        User::factory()->create(['name' => 'ディレクターA', 'role' => 'director']);
        User::factory()->create(['name' => '一般メンバー兼AD', 'role' => 'user']);
        User::factory()->create(['name' => '一般メンバー', 'role' => 'user']);

        // 一般ユーザーのアカウントがアカウントディレクターになっている案件。
        Project::create(['project_name' => '案件', 'account_director' => '一般メンバー兼AD']);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/account-directors')
            ->assertOk();

        $names = collect($response->json())->pluck('name')->all();
        $this->assertContains('ディレクターA', $names);
        $this->assertContains('管理者', $names);
        $this->assertContains('一般メンバー兼AD', $names);
        $this->assertNotContains('一般メンバー', $names);
    }

    public function test_director_gets_same_options_as_admin(): void
    {
        // /admin/users はディレクターに role=user しか返さないため、絞り込みの選択肢は
        // この専用エンドポイントから取る。返すのは ID と名前だけ。
        // 管理者アカウントをアカウントディレクターに使っている場合があるので管理者も含める。
        $director = User::factory()->create(['name' => 'ディレクターA', 'role' => 'director']);
        User::factory()->create(['name' => 'ディレクターB', 'role' => 'director']);
        User::factory()->create(['name' => '管理者', 'role' => 'admin']);

        $response = $this->actingAs($director)
            ->getJson('/api/admin/account-directors')
            ->assertOk();

        $names = collect($response->json())->pluck('name')->all();
        $this->assertEquals(['ディレクターA', 'ディレクターB', '管理者'], $names);
        $this->assertSame(['id', 'name'], array_keys($response->json()[0]));
    }

    public function test_general_user_is_forbidden(): void
    {
        $user = User::factory()->create(['role' => 'user']);

        $this->actingAs($user)
            ->getJson('/api/admin/account-directors')
            ->assertForbidden();
    }

    public function test_guest_gets_unauthenticated_response(): void
    {
        $this->getJson('/api/admin/account-directors')
            ->assertUnauthorized();
    }
}
