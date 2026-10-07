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
        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->string('ts_project_code', 50)->nullable()->unique();
            $table->string('ts_job_id', 60)->nullable();
            $table->string('client_name')->nullable();
            $table->string('project_name');
            $table->string('currency', 10)->default('JPY');
            $table->decimal('amount', 15, 2)->default(0);
            $table->enum('probability', ['won', 'lost', 'pending'])->default('pending');
            $table->date('billing_month')->nullable();
            $table->date('acceptance_month')->nullable();
            $table->date('start_month')->nullable();
            $table->date('end_month')->nullable();
            $table->enum('work_status', ['in_progress', 'completed'])->default('in_progress');
            $table->text('notes')->nullable();
            $table->timestamp('ts_last_synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
