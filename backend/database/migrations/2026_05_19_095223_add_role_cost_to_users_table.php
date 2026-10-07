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
        Schema::table('users', function (Blueprint $table): void {
            $table->enum('role', ['admin', 'user'])->default('user')->after('email');
            $table->decimal('hourly_cost', 10, 2)->default(0)->after('role');
            $table->string('employee_code', 20)->nullable()->after('hourly_cost');
            $table->boolean('is_active')->default(true)->after('employee_code');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['role', 'hourly_cost', 'employee_code', 'is_active', 'deleted_at']);
        });
    }
};
