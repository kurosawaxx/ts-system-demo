<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use App\Models\WorkHour;
use Carbon\CarbonImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    private const POSITIONS = ['PM', 'PL', 'SE', 'PG', 'デザイナー', 'QA'];

    private const MEMOS = ['要件定義', '基本設計', '詳細設計', '実装', 'テスト', 'レビュー', '打ち合わせ'];

    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => '管理者',
                'password' => bcrypt('password'),
                'role' => 'admin',
                'day_cost' => 0,
                'is_active' => true,
            ]
        );

        // docker-compose.override.yml が起動のたびに db:seed を実行するため、
        // このガードが無いとコンテナを再起動するたびにデモデータが増殖する。
        if (Project::exists()) {
            return;
        }

        $this->seedDemoData();
    }

    private function seedDemoData(): void
    {
        User::factory()->create([
            'name' => '田中 ディレクター',
            'email' => 'director@example.com',
            'role' => 'director',
            'day_cost' => 48000,
            'is_active' => true,
        ]);

        $members = collect(range(1, 12))->map(fn (int $i) => User::factory()->create([
            'name' => fake('ja_JP')->name(),
            'email' => "member{$i}@example.com",
            'role' => 'user',
            'day_cost' => fake()->numberBetween(24, 52) * 1000,
            'employee_code' => sprintf('EMP%03d', $i),
            'is_active' => true,
        ]));

        $today = CarbonImmutable::today();
        $workHours = [];

        foreach (Project::factory()->count(20)->create() as $project) {
            $assigned = $members->random(random_int(2, 4))->values();
            $project->users()->attach($assigned->pluck('id')->all());

            $startMonth = CarbonImmutable::parse($project->start_month)->startOfMonth();

            foreach ($assigned as $index => $user) {
                $workHours = array_merge(
                    $workHours,
                    $this->buildWorkHours($project->id, $user->id, $startMonth, $today)
                );

                // unique(project_id, assignee_name, work_month) を避けるため担当者ごとに月をずらす
                ProjectWorkItem::create([
                    'project_id' => $project->id,
                    'user_id' => $user->id,
                    'position_name' => fake()->randomElement(self::POSITIONS),
                    'assignee_name' => $user->name,
                    'work_month' => $startMonth->addMonths($index)->toDateString(),
                    'planned_cost' => fake()->numberBetween(10, 150) * 10000,
                ]);
            }
        }

        foreach (array_chunk($workHours, 500) as $chunk) {
            WorkHour::insert($chunk);
        }
    }

    /**
     * work_hours は unique(project_id, user_id, work_date) を持つため、
     * ランダムな日付ではなく営業日を順に進めて割り当てる。
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildWorkHours(int $projectId, int $userId, CarbonImmutable $startMonth, CarbonImmutable $today): array
    {
        $rows = [];
        $remaining = random_int(15, 40);
        $date = $startMonth;

        while ($remaining > 0 && $date->lessThanOrEqualTo($today)) {
            if (! $date->isWeekend()) {
                $rows[] = [
                    'project_id' => $projectId,
                    'user_id' => $userId,
                    'work_date' => $date->toDateString(),
                    'hours' => fake()->randomElement([4, 5, 6, 7, 7.5, 8]),
                    'memo' => fake()->boolean(30) ? fake()->randomElement(self::MEMOS) : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $remaining--;
            }

            $date = $date->addDay();
        }

        return $rows;
    }
}
