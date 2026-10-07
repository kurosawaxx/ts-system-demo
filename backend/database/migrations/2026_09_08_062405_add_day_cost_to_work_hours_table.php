<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 原価・粗利は work_hours の時間に users.day_cost(現在値)を掛けて算出していたため、
 * 単価を改定すると過去の案件の原価と粗利が遡って変わっていた。
 * 工数入力時点の単価をスナップショットして、確定した過去の数字が動かないようにする。
 *
 * nullable にしているのは「入力時点で単価が未設定(0)だった」ケースを区別するため。
 * NULL の行は読み出し時に users.day_cost へフォールバックする(COALESCE)ので、
 * 後から単価を設定すれば反映される。0 を入れて固定してしまうと永久に原価0になる。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_hours', function (Blueprint $table): void {
            $table->decimal('day_cost', 10, 2)->nullable()->after('hours');
        });

        // 既存行には当時の単価が残っていないため、現在値で埋める(移行時点で判明している最良の値)。
        // 単価未設定(0)のユーザーは NULL のままにしてフォールバック対象とする。
        // 相関サブクエリはMySQL・SQLiteのどちらでも動く(UPDATE...JOINはSQLiteで使えない)。
        DB::statement('UPDATE work_hours SET day_cost = (
            SELECT u.day_cost FROM users u WHERE u.id = work_hours.user_id
        ) WHERE (SELECT u.day_cost FROM users u WHERE u.id = work_hours.user_id) > 0');
    }

    public function down(): void
    {
        Schema::table('work_hours', function (Blueprint $table): void {
            $table->dropColumn('day_cost');
        });
    }
};
