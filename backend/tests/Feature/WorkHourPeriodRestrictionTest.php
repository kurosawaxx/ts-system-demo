<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkHourPeriodRestrictionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_work_hour_within_project_period(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'project_name' => '案件A',
            'start_month'  => now()->subMonth()->format('Y-m-d'),
            'end_month'    => now()->format('Y-m-d'),
        ]);
        $project->users()->attach($user->id);

        $response = $this->actingAs($user)->postJson("/api/projects/{$project->id}/work-hours", [
            'work_date' => now()->format('Y-m-d'),
            'hours'     => 1,
        ]);

        $response->assertCreated();
    }

    public function test_user_cannot_register_work_hour_before_project_start(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'project_name' => '案件B',
            'start_month'  => now()->addDay()->format('Y-m-d'),
            'end_month'    => now()->addMonth()->format('Y-m-d'),
        ]);
        $project->users()->attach($user->id);

        $response = $this->actingAs($user)->postJson("/api/projects/{$project->id}/work-hours", [
            'work_date' => now()->format('Y-m-d'),
            'hours'     => 1,
        ]);

        $response->assertStatus(422);
    }

    public function test_user_cannot_register_work_hour_after_project_end(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'project_name' => '案件C',
            'start_month'  => now()->subMonth()->format('Y-m-d'),
            'end_month'    => now()->subDay()->format('Y-m-d'),
        ]);
        $project->users()->attach($user->id);

        $response = $this->actingAs($user)->postJson("/api/projects/{$project->id}/work-hours", [
            'work_date' => now()->format('Y-m-d'),
            'hours'     => 1,
        ]);

        $response->assertStatus(422);
    }

    public function test_unauthenticated_user_cannot_register_work_hour(): void
    {
        $project = Project::create([
            'project_name' => '案件D',
            'start_month'  => now()->subMonth()->format('Y-m-d'),
            'end_month'    => now()->addMonth()->format('Y-m-d'),
        ]);

        $response = $this->postJson("/api/projects/{$project->id}/work-hours", [
            'work_date' => now()->format('Y-m-d'),
            'hours'     => 1,
        ]);

        $response->assertStatus(401);
    }

    public function test_unassigned_user_cannot_register_work_hour(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'project_name' => '案件E',
            'start_month'  => now()->subMonth()->format('Y-m-d'),
            'end_month'    => now()->addMonth()->format('Y-m-d'),
        ]);

        $response = $this->actingAs($user)->postJson("/api/projects/{$project->id}/work-hours", [
            'work_date' => now()->format('Y-m-d'),
            'hours'     => 1,
        ]);

        $response->assertStatus(403);
    }
}
