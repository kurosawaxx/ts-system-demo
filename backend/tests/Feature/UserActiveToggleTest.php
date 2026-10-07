<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * 退職者を「削除」(deleted_at)ではなく「無効化」(is_active)で扱えるようにするため、
 * 無効化が実際にアクセスを断つことを検証する。
 * is_active は元々 UI から切り替えられず、ログイン判定にも使われていなかったため、
 * 無効化しても本人はログインして工数入力を続けられる状態だった。
 */
class UserActiveToggleTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_deactivate_and_reactivate_a_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('is_active', false);

        $this->assertFalse((bool) $member->fresh()->is_active);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['is_active' => true])
            ->assertOk()
            ->assertJsonPath('is_active', true);

        $this->assertTrue((bool) $member->fresh()->is_active);
    }

    public function test_deactivation_records_the_date_and_reactivation_clears_it(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        // 論理削除の deleted_at が実質「退職日」として使われていたため、無効化日として引き継ぐ。
        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['is_active' => false])
            ->assertOk();

        $this->assertNotNull($member->fresh()->deactivated_at);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['is_active' => true])
            ->assertOk();

        $this->assertNull($member->fresh()->deactivated_at);
    }

    public function test_updating_other_fields_keeps_the_deactivation_date(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        $this->actingAs($admin)->putJson("/api/admin/users/{$member->id}", ['is_active' => false])->assertOk();
        $recordedAt = $member->fresh()->deactivated_at;

        $this->actingAs($admin)->putJson("/api/admin/users/{$member->id}", ['name' => '改名後'])->assertOk();

        $this->assertEquals($recordedAt, $member->fresh()->deactivated_at);
    }

    public function test_delete_and_restore_endpoints_no_longer_exist(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        // 論理削除は「一覧から見えなくなる」だけで、行もメールアドレスも残るため撤去した。
        // /users/{user} は GET/PUT が残っているので DELETE は 405、restore はルート自体が無いので 404。
        $this->actingAs($admin)->deleteJson("/api/admin/users/{$member->id}")->assertStatus(405);
        $this->actingAs($admin)->postJson("/api/admin/users/{$member->id}/restore")->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $member->id]);
    }

    public function test_user_list_puts_inactive_members_last(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'name' => 'あ管理者']);
        $inactive = User::factory()->create(['role' => 'user', 'name' => 'あ無効', 'is_active' => false]);
        $active = User::factory()->create(['role' => 'user', 'name' => 'ん現役']);

        // 氏名順では「あ無効」が先頭に来るが、無効メンバーは末尾へ回す。
        // 並べ替えはフロントではなくDBのORDER BYで行う(ページネーション導入時に崩れないため)。
        $ids = collect($this->actingAs($admin)->getJson('/api/admin/users')->assertOk()->json())
            ->pluck('id')
            ->all();

        $this->assertSame([$admin->id, $active->id, $inactive->id], $ids);
    }

    public function test_deactivated_user_cannot_log_in(): void
    {
        $member = User::factory()->create(['role' => 'user', 'is_active' => false]);

        $this->postJson('/api/auth/login', ['email' => $member->email, 'password' => 'password'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_active_user_can_still_log_in(): void
    {
        $member = User::factory()->create(['role' => 'user']);

        $this->postJson('/api/auth/login', ['email' => $member->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']]);
    }

    public function test_reactivated_user_can_log_in_again(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user', 'is_active' => false]);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['is_active' => true])
            ->assertOk();

        // auth:sanctum を通ると Authenticate ミドルウェアが shouldUse('sanctum') し、
        // これは config('auth.defaults.guard') 自体を書き換えるため、以降の既定ガードが
        // sanctum(RequestGuard)のままになり Auth::attempt が使えなくなる。
        // 本番はリクエストごとにプロセスが分かれるため起きない、テスト内だけの副作用。
        Auth::shouldUse('web');

        $this->postJson('/api/auth/login', ['email' => $member->email, 'password' => 'password'])
            ->assertOk();
    }

    public function test_deactivation_revokes_existing_tokens(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        // ログイン済みでトークンを持っている状態を作る
        $token = $this->postJson('/api/auth/login', ['email' => $member->email, 'password' => 'password'])
            ->assertOk()
            ->json('token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertOk();

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['is_active' => false])
            ->assertOk();

        // ログインを塞ぐだけでは発行済みトークンで入力を続けられてしまう
        $this->assertSame(0, $member->fresh()->tokens()->count());
    }

    public function test_updating_other_fields_does_not_revoke_tokens(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create(['role' => 'user']);

        $this->postJson('/api/auth/login', ['email' => $member->email, 'password' => 'password'])->assertOk();
        $this->assertSame(1, $member->fresh()->tokens()->count());

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$member->id}", ['name' => '改名後'])
            ->assertOk();

        $this->assertSame(1, $member->fresh()->tokens()->count());
    }

    public function test_admin_cannot_deactivate_themselves(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$admin->id}", ['is_active' => false])
            ->assertStatus(422);

        $this->assertTrue((bool) $admin->fresh()->is_active);
    }

    public function test_admin_can_still_update_their_own_other_fields(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->putJson("/api/admin/users/{$admin->id}", ['name' => '管理者(改名)'])
            ->assertOk();

        $this->assertSame('管理者(改名)', $admin->fresh()->name);
    }

    public function test_non_admin_cannot_toggle_active_state(): void
    {
        $member = User::factory()->create(['role' => 'user']);
        $other = User::factory()->create(['role' => 'user']);

        $this->actingAs($member)
            ->putJson("/api/admin/users/{$other->id}", ['is_active' => false])
            ->assertForbidden();

        $this->assertTrue((bool) $other->fresh()->is_active);
    }
}
