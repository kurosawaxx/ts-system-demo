<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectListFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_by_account_director_ids(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $directorA = User::factory()->create(['name' => 'ディレクターA', 'role' => 'director']);
        $directorB = User::factory()->create(['name' => 'ディレクターB', 'role' => 'director']);

        $projectA = Project::create(['project_name' => '案件A', 'account_director' => 'ディレクターA']);
        Project::create(['project_name' => '案件B', 'account_director' => 'ディレクターB']);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/projects?' . http_build_query(['account_director_ids' => [$directorA->id]]))
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertEquals([$projectA->id], $ids);
    }

    public function test_director_can_filter_by_account_director_ids(): void
    {
        // ディレクターも管理者と同じ絞り込みが使える(自分の担当案件には固定されない)。
        $director = User::factory()->create(['role' => 'director']);
        $otherDirector = User::factory()->create(['role' => 'director']);

        $ownProject = Project::create(['project_name' => '自分の案件', 'account_director' => $director->name]);
        $ownProject->users()->attach($director->id);
        $othersProject = Project::create(['project_name' => '他ディレクターの案件', 'account_director' => $otherDirector->name]);

        $response = $this->actingAs($director)
            ->getJson('/api/admin/projects?'.http_build_query(['account_director_ids' => [$otherDirector->id]]))
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertEquals([$othersProject->id], $ids);
    }

    public function test_director_can_filter_by_work_status(): void
    {
        $director = User::factory()->create(['role' => 'director']);

        $inProgress = Project::create(['project_name' => '進行中', 'work_status' => 'in_progress']);
        Project::create(['project_name' => '完了', 'work_status' => 'completed']);

        $response = $this->actingAs($director)
            ->getJson('/api/admin/projects?work_status=in_progress')
            ->assertOk();

        $ids = collect($response->json())->pluck('id')->all();
        $this->assertEquals([$inProgress->id], $ids);
    }

    public function test_admin_can_filter_by_billing_month_range(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $inRange = Project::create(['project_name' => '範囲内', 'billing_month' => '2026-03-01']);
        Project::create(['project_name' => '範囲外(前)', 'billing_month' => '2026-01-01']);
        Project::create(['project_name' => '範囲外(後)', 'billing_month' => '2026-06-01']);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/projects?billing_month_from=2026-02&billing_month_to=2026-04')
            ->assertOk();

        $names = collect($response->json())->pluck('project_name')->all();
        $this->assertEquals(['範囲内'], $names);
        $this->assertSame($inRange->project_name, $names[0]);
    }

    public function test_billing_month_just_outside_range_does_not_match(): void
    {
        // 請求月が指定範囲の外(1か月前)にある案件はヒットしない。
        $admin = User::factory()->create(['role' => 'admin']);
        Project::create(['project_name' => '請求月3月', 'billing_month' => '2026-03-01']);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/projects?billing_month_from=2026-04&billing_month_to=2026-07')
            ->assertOk();

        $this->assertSame([], collect($response->json())->pluck('project_name')->all());
    }

    public function test_general_user_can_filter_own_projects_by_billing_month_range(): void
    {
        $user = User::factory()->create(['role' => 'user']);

        $inRange = Project::create(['project_name' => '範囲内', 'billing_month' => '2026-03-01']);
        $inRange->users()->attach($user->id);

        $outOfRange = Project::create(['project_name' => '範囲外', 'billing_month' => '2026-08-01']);
        $outOfRange->users()->attach($user->id);

        $response = $this->actingAs($user)
            ->getJson('/api/projects?billing_month_from=2026-02&billing_month_to=2026-04')
            ->assertOk();

        $names = collect($response->json())->pluck('project_name')->all();
        $this->assertEquals(['範囲内'], $names);
    }

    public function test_admin_project_list_includes_actual_hours_and_role_per_assigned_user(): void
    {
        // 案件一覧APIは案件×担当者ごとのwork_hours合計(actual_hours)と、
        // 作業者出力からディレクターを除外するための role を各userに付与する。
        $admin = User::factory()->create(['role' => 'admin']);
        $memberA = User::factory()->create(['name' => '担当者A', 'role' => 'user']);
        $memberB = User::factory()->create(['name' => '担当者B', 'role' => 'user']);
        $memberC = User::factory()->create(['name' => '担当者C(工数無し)', 'role' => 'user']);
        $director = User::factory()->create(['name' => 'ディレクター', 'role' => 'director']);

        $project = Project::create(['project_name' => '工数テスト案件']);
        $project->users()->attach([$memberA->id, $memberB->id, $memberC->id, $director->id]);

        // 実入力時間の合計をそのまま小数第二位まで保持する(人日換算による丸めはしない)。
        // 8.52 + 8.52 = 17.04 のような端数が丸められず出力されることを固定化する。
        WorkHour::create(['project_id' => $project->id, 'user_id' => $memberA->id, 'work_date' => '2026-05-01', 'hours' => 8.52]);
        WorkHour::create(['project_id' => $project->id, 'user_id' => $memberA->id, 'work_date' => '2026-05-02', 'hours' => 8.52]);
        WorkHour::create(['project_id' => $project->id, 'user_id' => $memberB->id, 'work_date' => '2026-05-01', 'hours' => 4.0]);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/projects')
            ->assertOk();

        $data = collect($response->json())->firstWhere('id', $project->id);
        $usersByName = collect($data['users'])->keyBy('name');

        $this->assertSame(17.04, (float) $usersByName['担当者A']['actual_hours']);
        $this->assertSame(4.0, (float) $usersByName['担当者B']['actual_hours']);
        $this->assertSame(0.0, (float) $usersByName['担当者C(工数無し)']['actual_hours']);

        // role が付与されており、フロントはこれでディレクターを作業者出力から除外できる。
        $this->assertSame('user', $usersByName['担当者A']['role']);
        $this->assertSame('director', $usersByName['ディレクター']['role']);
    }
}
