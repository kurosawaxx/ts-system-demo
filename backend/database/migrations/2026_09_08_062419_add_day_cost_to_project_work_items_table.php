<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 計画明細の planned_cost は取込元ファイル由来の「円の絶対額」なので金額自体は既に固定されている。
 * 動くのは金額→人日の換算(planned_cost / users.day_cost)だけで、単価改定で予定人日がずれていた。
 * 実績側と同じ基準で予定/実績を比較できるよう、こちらもインポート時点の単価を固定する。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_work_items', function (Blueprint $table): void {
            $table->decimal('day_cost', 10, 2)->nullable()->after('planned_cost');
        });

        // 既存行は現在値で埋める。単価未設定(0)や担当者未紐付け(user_id が NULL)の行は
        // NULL のままにし、読み出し時に users.day_cost へフォールバックさせる。
        DB::statement('UPDATE project_work_items SET day_cost = (
            SELECT u.day_cost FROM users u WHERE u.id = project_work_items.user_id
        ) WHERE (SELECT u.day_cost FROM users u WHERE u.id = project_work_items.user_id) > 0');
    }

    public function down(): void
    {
        Schema::table('project_work_items', function (Blueprint $table): void {
            $table->dropColumn('day_cost');
        });
    }
};
