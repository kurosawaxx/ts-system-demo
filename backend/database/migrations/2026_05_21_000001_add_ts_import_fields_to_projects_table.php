<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->string('account_director')->nullable()->after('project_name');
            $table->string('sales_rep')->nullable()->after('account_director');
            $table->date('ts_created_date')->nullable()->after('sales_rep');
            $table->decimal('gross_profit_plan', 15, 2)->nullable()->after('amount');
            $table->decimal('gross_profit_actual', 15, 2)->nullable()->after('gross_profit_plan');
            $table->decimal('direct_outsourcing_cost_plan', 15, 2)->nullable()->after('gross_profit_actual');
            $table->decimal('internal_hours_plan', 8, 2)->nullable()->after('direct_outsourcing_cost_plan');
            $table->decimal('internal_hours_input', 8, 2)->nullable()->after('internal_hours_plan');
            $table->boolean('billing_confirmed')->default(false)->after('internal_hours_input');
            $table->boolean('billing_pd_confirmed')->default(false)->after('billing_confirmed');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn([
                'account_director', 'sales_rep', 'ts_created_date',
                'gross_profit_plan', 'gross_profit_actual', 'direct_outsourcing_cost_plan',
                'internal_hours_plan', 'internal_hours_input',
                'billing_confirmed', 'billing_pd_confirmed',
            ]);
        });
    }
};
