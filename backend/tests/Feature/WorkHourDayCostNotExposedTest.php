<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * 人日単価はメンバーに見せない。
 *
 * 原価を単価改定から守るため work_hours に day_cost を持たせたが、メンバーは自分の工数一覧
 * (GET /projects/{project}/work-hours)で WorkHour モデルを直接受け取るため、
 * 何もしないと自分の人日単価が JSON に出てしまう。$hidden で塞いだことを検証する。
 */
class WorkHourDayCostNotExposedTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: Project} */
    private function assignedMember(): array
    {
        $member = User::factory()->create(['role' => 'user', 'day_cost' => 40000]);
        $project = Project::create(['project_name' => '単価非公開の検証', 'amount' => 1000000]);
        $project->users()->attach($member->id);

        return [$member, $project];
    }

    public function test_work_hour_index_does_not_expose_day_cost(): void
    {
        [$member, $project] = $this->assignedMember();

        WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'work_date' => '2026-02-10',
            'hours' => 8,
            'day_cost' => 40000,
        ]);

        $response = $this->actingAs($member)
            ->getJson("/api/projects/{$project->id}/work-hours")
            ->assertOk();

        $response->assertJsonMissingPath('0.day_cost');
        $this->assertStringNotContainsString('40000', $response->getContent());
        // 工数そのものは従来どおり返る
        $this->assertEquals(8, $response->json('0.hours'));
    }

    public function test_work_hour_store_response_does_not_expose_day_cost(): void
    {
        [$member, $project] = $this->assignedMember();

        $response = $this->actingAs($member)
            ->postJson("/api/projects/{$project->id}/work-hours", ['work_date' => '2026-02-10', 'hours' => 8])
            ->assertCreated();

        $response->assertJsonMissingPath('day_cost');
        $this->assertStringNotContainsString('40000', $response->getContent());

        // 隠すのは表示だけで、スナップショット自体は保存されている
        $this->assertEquals(40000, WorkHour::firstOrFail()->day_cost);
    }

    public function test_work_hour_update_response_does_not_expose_day_cost(): void
    {
        [$member, $project] = $this->assignedMember();

        $workHour = WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'work_date' => '2026-02-10',
            'hours' => 8,
            'day_cost' => 40000,
        ]);

        $response = $this->actingAs($member)
            ->putJson("/api/projects/{$project->id}/work-hours/{$workHour->id}", ['hours' => 4])
            ->assertOk();

        $response->assertJsonMissingPath('day_cost');
        $this->assertStringNotContainsString('40000', $response->getContent());
    }

    public function test_member_facing_project_endpoints_do_not_expose_costs(): void
    {
        [$member, $project] = $this->assignedMember();

        WorkHour::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'work_date' => '2026-02-10',
            'hours' => 8,
            'day_cost' => 40000,
        ]);

        // 担当案件一覧・案件詳細に原価系のフィールドが載っていないこと
        foreach (['/api/projects', "/api/projects/{$project->id}"] as $path) {
            $content = $this->actingAs($member)->getJson($path)->assertOk()->getContent();
            foreach (['day_cost', 'total_cost', 'gross_profit', 'margin', 'planned_cost'] as $field) {
                $this->assertStringNotContainsString("\"{$field}\"", $content, "{$path} が {$field} を返している");
            }
        }
    }

    public function test_member_cannot_reach_admin_cost_endpoints(): void
    {
        [$member, $project] = $this->assignedMember();

        $this->actingAs($member)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($member)->getJson('/api/admin/projects')->assertForbidden();
        $this->actingAs($member)->getJson("/api/admin/projects/{$project->id}/users-hours")->assertForbidden();
    }
}
