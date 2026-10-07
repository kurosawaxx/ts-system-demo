<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Excelインポート(CsvImportController)経由で取り込まれたSalesforceエクスポートデータのうち、
     * 「㈱」(機種依存文字)がMySQL格納時にリテラルの"?"へ文字化けしていたレコードを修復する。
     *
     * "?"が数字に隣接している場合は会社名の「㈱」ではなく日付範囲の波ダッシュ(例: "2026年6月?2027年5月")の
     * 文字化けであるため、そちらは「～」に修復する。
     */
    public function up(): void
    {
        $rows = DB::table('projects')
            ->where('client_name', 'like', '%?%')
            ->orWhere('project_name', 'like', '%?%')
            ->get(['id', 'client_name', 'project_name']);

        foreach ($rows as $row) {
            $fix = function (?string $value): ?string {
                if ($value === null) {
                    return null;
                }

                $value = preg_replace('/(?<!\d)\?(?!\d)/u', '㈱', $value);

                return preg_replace('/(?<=\d)\?(?=\d)/u', '～', $value);
            };

            $newClientName = $fix($row->client_name);
            $newProjectName = $fix($row->project_name);

            if ($newClientName !== $row->client_name || $newProjectName !== $row->project_name) {
                DB::table('projects')->where('id', $row->id)->update([
                    'client_name' => $newClientName,
                    'project_name' => $newProjectName,
                ]);
            }
        }
    }

    /**
     * 元がどの文字だったか判定できない文字化け修復のため、このマイグレーションは不可逆。
     */
    public function down(): void
    {
        // no-op: irreversible data fix
    }
};
