<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'ts_project_code', 'ts_job_id', 'client_name', 'project_name',
        'account_director', 'sales_rep', 'ts_created_date',
        'currency', 'amount',
        'gross_profit_plan', 'gross_profit_actual', 'direct_outsourcing_cost_plan',
        'internal_hours_plan', 'internal_hours_input',
        'billing_confirmed', 'billing_pd_confirmed',
        'probability', 'billing_month', 'acceptance_month',
        'start_month', 'end_month', 'work_status', 'notes', 'ts_last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'gross_profit_plan' => 'decimal:2',
            'gross_profit_actual' => 'decimal:2',
            'direct_outsourcing_cost_plan' => 'decimal:2',
            'internal_hours_plan' => 'decimal:2',
            'internal_hours_input' => 'decimal:2',
            'billing_confirmed' => 'boolean',
            'billing_pd_confirmed' => 'boolean',
            'ts_created_date' => 'date',
            'billing_month' => 'date:Y-m',
            'acceptance_month' => 'date:Y-m',
            'start_month' => 'date',
            'end_month' => 'date',
            'ts_last_synced_at' => 'datetime',
        ];
    }

    public function users()
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function workHours()
    {
        return $this->hasMany(WorkHour::class);
    }

    private static function costSubquery(): string
    {
        $hoursPerDay = (int) config('work.hours_per_day');

        // 単価は工数入力時点のスナップショット(wh.day_cost)を使う。単価改定で過去の原価が動かないようにするため。
        // hours * 1.0 としているのは、SQLite だと decimal が整数として格納され hours / 8 が整数除算になるため
        // (例: 4h が 0 になる)。attachTotalPlannedHours と同じ対処。
        // 入力時点で単価が未設定だった行は NULL なので、現在の users.day_cost にフォールバックする。
        return "(SELECT COALESCE(SUM(wh.hours * 1.0 / {$hoursPerDay} * COALESCE(wh.day_cost, u.day_cost)), 0)
                 FROM work_hours wh
                 JOIN users u ON u.id = wh.user_id
                 WHERE wh.project_id = projects.id)";
    }

    public function scopeWithProfitMetrics(Builder $query): Builder
    {
        $cost = self::costSubquery();

        return $query->selectRaw("projects.*,
            {$cost} AS total_cost,
            projects.amount - {$cost} AS gross_profit,
            CASE WHEN projects.amount > 0
                THEN ROUND((projects.amount - {$cost}) / projects.amount * 100, 2)
                ELSE 0 END AS margin");
    }

    public function loadProfitMetrics(): void
    {
        $amount = (float) $this->amount;
        $hoursPerDay = (int) config('work.hours_per_day');

        // costSubquery() と同じくスナップショット優先・現在値フォールバックで原価を出す。
        $cost = "COALESCE(SUM(wh.hours * 1.0 / {$hoursPerDay} * COALESCE(wh.day_cost, u.day_cost)), 0)";

        $metrics = DB::selectOne(
            "SELECT
                {$cost} AS total_cost,
                ? - {$cost} AS gross_profit,
                CASE WHEN ? > 0
                    THEN ROUND((? - {$cost}) / ? * 100, 2)
                    ELSE 0 END AS margin
            FROM work_hours wh
            JOIN users u ON u.id = wh.user_id
            WHERE wh.project_id = ?",
            [$amount, $amount, $amount, $amount, $this->id]
        );

        $this->setAttribute('total_cost', (float) $metrics->total_cost);
        $this->setAttribute('gross_profit', (float) $metrics->gross_profit);
        $this->setAttribute('margin', (float) $metrics->margin);
    }
}
