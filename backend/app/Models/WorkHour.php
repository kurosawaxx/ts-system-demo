<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkHour extends Model
{
    use HasFactory;

    protected $fillable = ['project_id', 'user_id', 'work_date', 'hours', 'memo', 'day_cost'];

    // メンバーは自分の工数一覧(GET /projects/{project}/work-hours)でこのモデルを直接受け取るため、
    // 人日単価をJSONに含めない。原価の集計はいずれも生SQL/クエリビルダで行っており、
    // シリアライズされた day_cost を読んでいる箇所は無い。
    protected $hidden = ['day_cost'];

    protected function casts(): array
    {
        return [
            'work_date' => 'date:Y-m-d',
            'hours' => 'decimal:2',
            // 入力時点の人日単価のスナップショット。NULL は入力時に単価未設定だったことを表す。
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
