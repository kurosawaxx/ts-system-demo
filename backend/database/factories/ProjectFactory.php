<?php

namespace Database\Factories;

use App\Models\Project;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    // 実在企業と誤認されないよう、Fakerのcompany()ではなく一般語の組み合わせで生成する
    private const CLIENT_PREFIXES = [
        'サンライズ', 'フロンティア', 'ネクスト', 'グローバル', 'ブライト',
        'クリエイト', 'スマート', 'リンク', 'テクノ', 'アルファ', 'ミライ', 'ユナイテッド',
    ];

    private const CLIENT_SUFFIXES = [
        '商事', 'システムズ', 'ホールディングス', 'テクノロジー',
        'コンサルティング', 'コマース', 'ソリューションズ', '物産', 'クリエイティブ',
    ];

    private const PROJECT_DOMAINS = [
        'ECサイト', '基幹システム', 'スマートフォンアプリ', 'コーポレートサイト',
        'データ分析基盤', '業務効率化ツール', '会員管理システム', '予約システム',
    ];

    private const PROJECT_PHASES = [
        'リニューアル', '新規開発', '構築', '導入支援', '保守運用', '機能改修',
    ];

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = CarbonImmutable::instance(fake()->dateTimeBetween('-8 months', '-2 months'))->startOfMonth();
        $end = $start->addMonths(fake()->numberBetween(2, 8))->endOfMonth();

        return [
            'ts_project_code' => 'DEMO-'.fake()->unique()->numerify('####'),
            'client_name' => $this->clientName(),
            'project_name' => $this->projectName(),
            'account_director' => fake('ja_JP')->name(),
            'sales_rep' => fake('ja_JP')->name(),
            'ts_created_date' => $start->subMonth(),
            'currency' => 'JPY',
            'amount' => fake()->numberBetween(50, 1500) * 10000,
            'direct_outsourcing_cost_plan' => fake()->numberBetween(0, 40) * 10000,
            'probability' => fake()->randomElement(['won', 'won', 'won', 'pending', 'lost']),
            'billing_month' => $end->startOfMonth(),
            'start_month' => $start,
            'end_month' => $end,
            'work_status' => fake()->randomElement(['in_progress', 'completed']),
        ];
    }

    private function clientName(): string
    {
        $name = fake()->randomElement(self::CLIENT_PREFIXES).fake()->randomElement(self::CLIENT_SUFFIXES);

        return fake()->boolean(70) ? '株式会社'.$name : $name.'株式会社';
    }

    private function projectName(): string
    {
        return fake()->randomElement(self::PROJECT_DOMAINS).fake()->randomElement(self::PROJECT_PHASES);
    }
}
