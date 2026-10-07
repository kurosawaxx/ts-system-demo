<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 退職者の扱いを論理削除(deleted_at)から無効化(is_active)へ一本化する。
 *
 * 論理削除は SoftDeletes のグローバルスコープで Eloquent の全クエリから静かに消えるため、
 * withTrashed() を書き忘れた箇所で担当者名や実績が欠落していた(案件一覧エクスポートの
 * 担当者行の欠落、担当者アサイン保存時の project_user の暗黙削除)。
 * 一方 is_active にはグローバルスコープが無く、除外は意図的に書いたときだけ起きる。
 *
 * 実効面でも論理削除は何も達成していなかった:
 *  - users 行は物理的に残る
 *  - unique:users,email は DB を直接見るためメールアドレスが解放されず、作り直せない
 *  - work_hours.user_id が RESTRICT のため物理削除もできない
 * つまり「一覧から見えなくなる」だけで、その副作用が上記の不具合だった。
 *
 * deleted_at は実質「退職日」として使われていた(既存データは 2026-07-24 等)ため、
 * 値を捨てずに deactivated_at へリネームして無効化日として引き継ぐ。
 * deleted_at という名前のまま残すと、誰かが SoftDeletes を再追加した瞬間に
 * 同じ問題が再発するため、名前も変える。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->renameColumn('deleted_at', 'deactivated_at');
        });

        // 論理削除されていたユーザーは「無効」として扱う。deactivated_at には退職日が既に入っている。
        DB::table('users')->whereNotNull('deactivated_at')->update(['is_active' => false]);
    }

    public function down(): void
    {
        // 無効化のうち、日付を持つものだけを論理削除に戻す(日付が無いものは元々論理削除ではない)。
        DB::table('users')->whereNotNull('deactivated_at')->update(['is_active' => true]);

        Schema::table('users', function (Blueprint $table): void {
            $table->renameColumn('deactivated_at', 'deleted_at');
        });
    }
};
