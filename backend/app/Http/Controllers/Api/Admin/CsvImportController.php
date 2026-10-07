<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class CsvImportController extends Controller
{
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:10240',
        ]);

        try {
            $spreadsheet = IOFactory::load($request->file('file')->getPathname());
        } catch (\Exception $e) {
            return response()->json(['message' => 'ファイルの読み込みに失敗しました: ' . $e->getMessage()], 422);
        }

        $sheet             = $spreadsheet->getActiveSheet();
        $highestRow        = $sheet->getHighestDataRow();
        $created           = 0;
        $updated           = 0;
        $skipped           = 0;
        $workItemSaved     = 0;
        $errors            = [];
        $userIdsByName     = User::pluck('id', 'name');
        $dayCostsByName    = User::pluck('day_cost', 'name');
        $assigneeIdsByProject = [];

        // 1案件につき複数行(担当者×月)が存在するため、案件全体の「直接外注費(計画)」は
        // 同一プロジェクトコードを持つ全行の合計値とする(1行ずつの値で単純上書きすると
        // 最後に処理した行の値しか残らず、案件全体の計画額として不正確になるため)。
        $planTotalsByCode = [];
        for ($row = 2; $row <= $highestRow; $row++) {
            $tsCode = trim((string) $sheet->getCell('A' . $row)->getValue());
            if ($tsCode === '' || $this->isFooterRow($tsCode)) {
                continue;
            }
            $planTotalsByCode[$tsCode] = ($planTotalsByCode[$tsCode] ?? 0.0) + $this->num($sheet->getCell('J' . $row));
        }

        for ($row = 2; $row <= $highestRow; $row++) {
            try {
                $tsCode = trim((string) $sheet->getCell('A' . $row)->getValue());

                if ($tsCode === '') {
                    $skipped++;
                    continue;
                }

                // SalesforceエクスポートXLSXの末尾に付与される著作権表記などのフッター行を除外する。
                // プロジェクトコード列はDB上varchar(50)のため、それを超える内容は実データではないとみなす。
                if ($this->isFooterRow($tsCode)) {
                    $skipped++;
                    $errors[] = "{$row}行目: プロジェクトコード列の内容が長すぎるため(先頭: " . mb_substr($tsCode, 0, 30) . "...)、フッター行とみなしスキップしました。";
                    continue;
                }

                $data     = $this->buildRowData($sheet, $row);
                $rowCost  = $data['direct_outsourcing_cost_plan'];
                $data['direct_outsourcing_cost_plan'] = $planTotalsByCode[$tsCode] ?? 0.0;
                $project  = Project::withTrashed()->where('ts_project_code', $tsCode)->first();

                if ($project) {
                    $project->fill($data);
                    if ($project->trashed()) {
                        $project->restore();
                        $project->save();
                        $updated++;
                    } elseif ($project->isDirty()) {
                        $project->save();
                        $updated++;
                    } else {
                        $skipped++;
                    }
                } else {
                    $project = Project::create($data);
                    $created++;
                }

                $workItem = $this->parseWorkItem($sheet, $row, $data['project_name']);
                if ($workItem !== null) {
                    $workItem['user_id'] = $userIdsByName[$workItem['assignee_name']] ?? null;

                    $item = ProjectWorkItem::firstOrNew([
                        'project_id'    => $project->id,
                        'assignee_name' => $workItem['assignee_name'],
                        'work_month'    => $workItem['work_month'],
                    ]);
                    $item->fill([
                        'user_id'       => $workItem['user_id'],
                        'position_name' => $workItem['position_name'],
                        'planned_cost'  => $rowCost,
                    ]);

                    // 単価は最初に取り込んだ時点の値で固定する(再インポートで過去の人日換算が動かないように)。
                    // 担当者が特定できない明細や単価未設定のユーザーはNULLのままにし、読み出し時に現在値へフォールバックさせる。
                    if ($item->day_cost === null) {
                        $rate = (float) ($dayCostsByName[$workItem['assignee_name']] ?? 0);
                        $item->day_cost = $rate > 0 ? $rate : null;
                    }

                    $item->save();
                    $workItemSaved++;

                    if ($workItem['user_id'] !== null) {
                        $assigneeIdsByProject[$project->id][$workItem['user_id']] = true;
                    }
                }
            } catch (\Exception $e) {
                $errors[] = "{$row}行目: " . $e->getMessage();
            }
        }

        // 案件×担当者×月の計画明細で解決できた担当者を、案件の担当者(project_user)へ自動的に追加する。
        // 既存の手動アサインを消さないよう追加のみ行い、除外は引き続き手動アサイン画面で行う。
        foreach ($assigneeIdsByProject as $projectId => $userIds) {
            Project::find($projectId)?->users()->syncWithoutDetaching(array_keys($userIds));
        }

        return response()->json([
            'message' => "インポート完了: 新規 {$created}件、更新 {$updated}件、スキップ {$skipped}件、作業明細 {$workItemSaved}件",
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'work_items_saved' => $workItemSaved,
            'errors'  => $errors,
        ]);
    }

    private function buildRowData($sheet, int $row): array
    {
        $c = fn(int $col) => $sheet->getCell(Coordinate::stringFromColumnIndex($col) . $row);

        return [
            'ts_project_code'              => $this->str($c(1)),
            'client_name'                  => $this->str($c(2)),
            'project_name'                 => $this->str($c(3)) ?? '(名称未設定)',
            'account_director'             => $this->str($c(4)),
            'ts_created_date'              => $this->parseDate($c(5)),
            'start_month'                  => $this->parseDate($c(6)),
            'end_month'                    => $this->parseDate($c(7)),
            'billing_month'                => $this->parseBillingMonth($c(8)),
            'amount'                       => $this->num($c(9)),
            'direct_outsourcing_cost_plan' => $this->num($c(10)),
            'probability'                  => $this->parseProbability($c(13)),
        ];
    }

    /**
     * 「作業項目明細名」(11列目)を解析し、案件×担当者×月の計画明細を組み立てる。
     * 形式: {プロジェクト名}_{ポジション名}_{作業者名}_{作業月(YYYYMMDD)}
     * ただし実データではプロジェクト名部分が文字数で途中打ち切り(truncate)されており、
     * 列3のプロジェクト名との前方一致は成立しない。そのため末尾から
     * [作業月, 作業者名, ポジション名] の3要素を取り、それより前(打ち切られたプロジェクト名)は破棄する。
     * 末尾から2要素しか無い場合(例: "SSL費用_20250301")は担当者不明の費用明細とみなし、
     * ポジション名側の1要素を明細名としてassignee_nameに入れる(担当者無しのためuser_idはnullのまま)。
     */
    private function parseWorkItem($sheet, int $row, string $projectName): ?array
    {
        $c      = fn(int $col) => $sheet->getCell(Coordinate::stringFromColumnIndex($col) . $row);
        $detail = $this->str($c(11));
        $month  = $this->parseYearMonth($c(12));

        if ($detail === null || $month === null) {
            return null;
        }

        $parts = explode('_', $detail);
        if (count($parts) < 2) {
            return null;
        }

        array_pop($parts); // 末尾の作業月(YYYYMMDD)は明細月セルの値を正とするため破棄

        if (count($parts) === 1) {
            // 担当者無しの費用明細(例: 外部サービス利用料など)
            $positionName = null;
            $assigneeName = array_pop($parts);
        } else {
            $assigneeName = array_pop($parts);
            $positionName = array_pop($parts);
        }

        if ($assigneeName === '') {
            return null;
        }

        return [
            'position_name' => $positionName,
            'assignee_name' => $assigneeName,
            'work_month'    => $month,
        ];
    }

    /**
     * プロジェクトコード列(varchar(50))に収まらない内容は、Salesforceエクスポート等の
     * 末尾に付与される著作権表記のようなフッター行とみなす。
     */
    private function isFooterRow(string $tsCode): bool
    {
        return mb_strlen($tsCode) > 50;
    }

    private function str(Cell $cell): ?string
    {
        $val = trim((string) $cell->getValue());
        return $val === '' ? null : $val;
    }

    private function num(Cell $cell): float
    {
        $val = $cell->getValue();
        return is_numeric($val) ? (float) $val : 0.0;
    }

    private function parseDate(Cell $cell): ?string
    {
        $val = $cell->getValue();
        if ($val === null || $val === '') {
            return null;
        }

        if (is_numeric($val) && ExcelDate::isDateTime($cell)) {
            return ExcelDate::excelToDateTimeObject((float) $val)->format('Y-m-d');
        }

        try {
            return Carbon::parse((string) $val)->format('Y-m-d');
        } catch (\Exception) {
            return null;
        }
    }

    private function parseBillingMonth(Cell $cell): ?string
    {
        $date = $this->parseDate($cell);
        return $date !== null ? Carbon::parse($date)->startOfMonth()->format('Y-m-d') : null;
    }

    /**
     * 「明細月」(12列目)は "2025/02" のように日を含まないY/m形式で入るため、
     * 通常のparseDate/parseBillingMonth(フル日付前提)とは別に専用パースを行う。
     */
    private function parseYearMonth(Cell $cell): ?string
    {
        $val = $cell->getValue();
        if ($val === null || $val === '') {
            return null;
        }

        if (is_numeric($val) && ExcelDate::isDateTime($cell)) {
            return ExcelDate::excelToDateTimeObject((float) $val)->startOfMonth()->format('Y-m-d');
        }

        $str = trim((string) $val);

        foreach (['Y/n', 'Y-n', 'Y/m', 'Y-m'] as $format) {
            try {
                return Carbon::createFromFormat($format, $str)->startOfMonth()->format('Y-m-d');
            } catch (\Exception) {
                continue;
            }
        }

        try {
            return Carbon::parse($str)->startOfMonth()->format('Y-m-d');
        } catch (\Exception) {
            return null;
        }
    }

    private function parseProbability(Cell $cell): string
    {
        $val = trim((string) $cell->getValue());

        return match ($val) {
            '受注' => 'won',
            '失注' => 'lost',
            default => 'pending',
        };
    }
}
