<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_start_and_end_date_with_full_date_format(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = Project::create(['project_name' => '案件A']);

        $response = $this->actingAs($admin)->putJson("/api/admin/projects/{$project->id}", [
            'start_month' => '2026-04-01',
            'end_month'   => '2026-09-15',
        ]);

        $response->assertOk();
        $project->refresh();
        $this->assertSame('2026-04-01', $project->start_month->format('Y-m-d'));
        $this->assertSame('2026-09-15', $project->end_month->format('Y-m-d'));
    }

    public function test_update_rejects_month_only_format_for_start_and_end_date(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = Project::create(['project_name' => '案件B']);

        $response = $this->actingAs($admin)->putJson("/api/admin/projects/{$project->id}", [
            'start_month' => '2026-04',
        ]);

        $response->assertStatus(422);
    }
}
