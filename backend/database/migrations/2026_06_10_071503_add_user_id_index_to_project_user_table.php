<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('project_user', function (Blueprint $table): void {
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('project_user', function (Blueprint $table): void {
            $table->dropIndex(['user_id']);
        });
    }
};
