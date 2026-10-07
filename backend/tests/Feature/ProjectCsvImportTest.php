<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ProjectCsvImportTest extends TestCase
{
    use RefreshDatabase;

    private function makeXlsxUpload(array $rows): UploadedFile
    {
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getActiveSheet()->fromArray($rows, null, 'A1');

        $path = tempnam(sys_get_temp_dir(), 'xlsx').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return new UploadedFile($path, 'import.xlsx', null, null, true);
    }

    public function test_admin_can_import_new_columns_including_dates_and_probability(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-001', 'クライアントA', '案件A', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '200000', '案件A_コーダー_鈴木一郎_20260305', '2026-03-05', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);

        $response->assertOk();
        $this->assertSame(1, $response->json('created'));

        $project = Project::where('ts_project_code', 'TS-001')->firstOrFail();
        $this->assertSame('案件A', $project->project_name);
        $this->assertSame('山田太郎', $project->account_director);
        $this->assertSame('2026-01-10', $project->ts_created_date->format('Y-m-d'));
        $this->assertSame('2026-02-01', $project->start_month->format('Y-m-d'));
        $this->assertSame('2026-06-30', $project->end_month->format('Y-m-d'));
        $this->assertSame('2026-03-01', $project->billing_month->format('Y-m-d'));
        $this->assertSame('won', $project->probability);
    }

    public function test_import_does_not_overwrite_legacy_fields_no_longer_in_the_csv(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        Project::create([
            'ts_project_code' => 'TS-002',
            'project_name' => '既存案件',
            'sales_rep' => '佐藤花子',
            'amount' => 500000,
        ]);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-002', 'クライアントB', '既存案件(更新)', '鈴木一郎', '2026-01-10', '', '', '', '600000', '', '', '', ''],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);

        $response->assertOk();
        $this->assertSame(1, $response->json('updated'));

        $project = Project::where('ts_project_code', 'TS-002')->firstOrFail();
        $this->assertSame('既存案件(更新)', $project->project_name);
        $this->assertSame('佐藤花子', $project->sales_rep);
        $this->assertSame('pending', $project->probability);
    }

    public function test_import_creates_project_work_item_and_splits_detail_name_with_underscore_in_project_name(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $assignee = User::factory()->create(['name' => '山田太郎', 'day_cost' => 24000]);

        // プロジェクト名自体に「_」を含み、かつ明細名の先頭とプロジェクト名が完全一致するケース
        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-003', 'クライアントD', 'クライアントD_月次運用 2026年2月分', '佐藤花子', '2026-01-31', '2026-02-01', '2026-02-28', '2026-02-28', '300000', '90000', 'クライアントD_月次運用 2026年2月分_コーダー_山田太郎_20260201', '2026-02-01', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);

        $response->assertOk();
        $this->assertSame(1, $response->json('work_items_saved'));

        $project = Project::where('ts_project_code', 'TS-003')->firstOrFail();
        $workItem = ProjectWorkItem::where('project_id', $project->id)->firstOrFail();

        $this->assertSame('コーダー', $workItem->position_name);
        $this->assertSame('山田太郎', $workItem->assignee_name);
        $this->assertSame($assignee->id, $workItem->user_id);
        $this->assertSame('2026-02-01', $workItem->work_month->format('Y-m-d'));
        $this->assertSame('90000.00', $workItem->planned_cost);
    }

    public function test_import_keeps_work_item_without_matching_user_but_user_id_is_null(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-004', 'クライアントC', '案件C', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '50000', '案件C_デザイナー_未登録太郎_20260305', '2026-03-05', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);

        $response->assertOk();

        $project = Project::where('ts_project_code', 'TS-004')->firstOrFail();
        $workItem = ProjectWorkItem::where('project_id', $project->id)->firstOrFail();

        $this->assertSame('デザイナー', $workItem->position_name);
        $this->assertSame('未登録太郎', $workItem->assignee_name);
        $this->assertNull($workItem->user_id);
    }

    public function test_import_parses_detail_name_even_when_project_name_prefix_is_truncated(): void
    {
        // 「作業項目明細名」内のプロジェクト名部分が文字数で途中打ち切りされていることがある
        // （例: プロジェクト名「クライアントG様　Chatbot月次ランニング(2月分)_2025」に対し
        //   明細名は「クライアントG様　Chatbot月次ラ_システム_鈴木一郎_20250201」)。
        // 前方一致を前提にすると解析に失敗するため、末尾からの解析で対応できることを確認する。
        $admin = User::factory()->create(['role' => 'admin']);
        $assignee = User::factory()->create(['name' => '鈴木一郎', 'day_cost' => 20000]);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-006', 'クライアントG', 'クライアントG様　Chatbot月次ランニング(2月分)_2025', '佐藤花子', '2026-01-31', '2026-02-01', '2026-02-28', '2026-02-28', '100000', '40000', 'クライアントG様　Chatbot月次ラ_システム_鈴木一郎_20250201', '2026-02', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);
        $response->assertOk();

        $project = Project::where('ts_project_code', 'TS-006')->firstOrFail();
        $workItem = ProjectWorkItem::where('project_id', $project->id)->firstOrFail();

        $this->assertSame('システム', $workItem->position_name);
        $this->assertSame('鈴木一郎', $workItem->assignee_name);
        $this->assertSame($assignee->id, $workItem->user_id);
        $this->assertSame('2026-02-01', $workItem->work_month->format('Y-m-d'));
    }

    public function test_import_parses_year_month_only_format_without_day(): void
    {
        // 実データの「明細月」列は "2026/02" のように日を含まない形式で入る。
        $admin = User::factory()->create(['role' => 'admin']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-007', 'クライアントE', '案件E', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '50000', '案件E_コーダー_鈴木一郎_20260305', '2026/03', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);
        $response->assertOk();
        $this->assertSame(1, $response->json('work_items_saved'));

        $project = Project::where('ts_project_code', 'TS-007')->firstOrFail();
        $workItem = ProjectWorkItem::where('project_id', $project->id)->firstOrFail();
        $this->assertSame('2026-03-01', $workItem->work_month->format('Y-m-d'));
    }

    public function test_import_stores_cost_line_item_without_person_as_assignee_name(): void
    {
        // 担当者ではなくサービス/費用名がその位置に入る行が存在する
        // （例: 「クライアントH_2025年3月～2026年2_レンタルサーバー　ビジネスプラン_20250301」）。
        // このようなケースでもuser_idはnullのまま、assignee_nameに明細名がそのまま入り、
        // planned_costは正しく保持されることを確認する。
        $admin = User::factory()->create(['role' => 'admin']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-008', 'クライアントH', 'クライアントH_2025年3月～2026年2月　サーバ・ドメイン費', '佐藤花子', '2025-01-10', '2025-03-01', '2026-02-28', '2025-03-05', '20000', '5000', 'クライアントH_2025年3月～2026年2_レンタルサーバー　ビジネスプラン_20250301', '2025/03', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);
        $response->assertOk();

        $project = Project::where('ts_project_code', 'TS-008')->firstOrFail();
        $workItem = ProjectWorkItem::where('project_id', $project->id)->firstOrFail();

        $this->assertSame('レンタルサーバー　ビジネスプラン', $workItem->assignee_name);
        $this->assertNull($workItem->user_id);
        $this->assertSame('5000.00', $workItem->planned_cost);
    }

    public function test_project_level_plan_cost_is_sum_of_all_its_rows_not_last_row_value(): void
    {
        // 実データでは1案件に対して担当者×月の複数行が存在し、それぞれの直接外注費(計画)は
        // 行ごとに異なりうる。案件テーブル側の直接外注費(計画)は行の単純上書きではなく、
        // 同一プロジェクトコードの全行合計になっている必要がある。
        $admin = User::factory()->create(['role' => 'admin']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-009', 'クライアントF', '案件F', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '30000', '案件F_コーダー_鈴木一郎_20260201', '2026/02', '受注'],
            ['TS-009', 'クライアントF', '案件F', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '70000', '案件F_デザイナー_未登録花子_20260301', '2026/03', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);
        $response->assertOk();

        $project = Project::where('ts_project_code', 'TS-009')->firstOrFail();
        $this->assertSame('100000.00', $project->direct_outsourcing_cost_plan);

        $items = ProjectWorkItem::where('project_id', $project->id)->orderBy('work_month')->get();
        $this->assertSame(2, $items->count());
        $this->assertSame('30000.00', $items[0]->planned_cost);
        $this->assertSame('70000.00', $items[1]->planned_cost);
    }

    public function test_import_auto_assigns_matched_work_item_user_to_project(): void
    {
        // インポートで解決できた作業担当者は、手動アサインなしで
        // project_userへ自動的に追加され、案件の担当者一覧に現れる想定。
        $admin = User::factory()->create(['role' => 'admin']);
        $worker = User::factory()->create(['name' => '鈴木一郎', 'role' => 'user']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-010', 'クライアントG', '案件G', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '30000', '案件G_コーダー_鈴木一郎_20260201', '2026/02', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);
        $response->assertOk();

        $project = Project::where('ts_project_code', 'TS-010')->firstOrFail();
        $assignedIds = $project->users()->pluck('users.id')->all();

        $this->assertContains($worker->id, $assignedIds);
    }

    public function test_import_does_not_remove_existing_manual_assignment(): void
    {
        // 自動アサインは追加のみ行い、既存の手動アサインを消してはいけない。
        $admin = User::factory()->create(['role' => 'admin']);
        $manual = User::factory()->create(['name' => '手動アサイン済み', 'role' => 'user']);

        $project = Project::create(['ts_project_code' => 'TS-011', 'project_name' => '案件H']);
        $project->users()->attach($manual->id);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-011', 'クライアントH', '案件H', '', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '30000', '', '', '受注'],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);
        $response->assertOk();

        $project->refresh();
        $this->assertContains($manual->id, $project->users()->pluck('users.id')->all());
    }

    public function test_reimporting_same_row_updates_existing_work_item_instead_of_duplicating(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $rows = [
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-005', 'クライアントD', '案件D', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '50000', '案件D_コーダー_鈴木一郎_20260305', '2026-03-05', '受注'],
        ];

        $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $this->makeXlsxUpload($rows)])->assertOk();

        $rows[1][9] = '80000'; // 直接外注費(計画)を変更して再インポート
        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $this->makeXlsxUpload($rows)]);
        $response->assertOk();

        $project = Project::where('ts_project_code', 'TS-005')->firstOrFail();
        $this->assertSame(1, ProjectWorkItem::where('project_id', $project->id)->count());
        $this->assertSame('80000.00', ProjectWorkItem::where('project_id', $project->id)->firstOrFail()->planned_cost);
    }

    public function test_import_skips_salesforce_export_footer_row_without_error(): void
    {
        // Salesforceエクスポートのxlsxは末尾に著作権表記の行が付与されることがあり、
        // これがプロジェクトコード列(varchar(50))に入るとSQLエラーで処理全体が壊れていた。
        // フッター行とみなしてスキップし、通常の行は問題なく処理されることを確認する。
        $admin = User::factory()->create(['role' => 'admin']);

        $file = $this->makeXlsxUpload([
            ['プロジェクトコード', '発注元', 'プロジェクト名', 'アカウントディレクター', '作成日', '開始日', '終了予定日', '請求月', '売上予定額', '直接外注費(計画)', '作業項目明細名', '明細月', '確度'],
            ['TS-030', 'クライアントI', '案件I', '山田太郎', '2026-01-10', '2026-02-01', '2026-06-30', '2026-03-05', '1000000', '30000', '', '', '受注'],
            ['Copyright © 2000-2026 salesforce.com, inc. All rights reserved.', '', '', '', '', '', '', '', '', '', '', '', ''],
        ]);

        $response = $this->actingAs($admin)->postJson('/api/admin/projects/import-csv', ['file' => $file]);

        $response->assertOk();
        $this->assertSame(1, $response->json('created'));
        $this->assertSame(1, $response->json('skipped'));
        $this->assertNotEmpty($response->json('errors'));

        $this->assertNotNull(Project::where('ts_project_code', 'TS-030')->first());
    }
}
