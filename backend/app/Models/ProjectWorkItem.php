<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectWorkItem extends Model
{
    protected $fillable = [
        'project_id', 'user_id', 'position_name', 'assignee_name', 'work_month', 'planned_cost', 'day_cost',
    ];

    protected function casts(): array
    {
        return [
            'work_month'   => 'date:Y-m',
            'planned_cost' => 'decimal:2',
            // インポート時点の人日単価のスナップショット(金額→人日の換算に使う)。
            'day_cost' => 'decimal:2',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
