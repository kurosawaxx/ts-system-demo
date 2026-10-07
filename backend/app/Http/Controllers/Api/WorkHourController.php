<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\WorkHour;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkHourController extends Controller
{
    private function assertAssigned(Request $request, Project $project): void
    {
        abort_unless(
            $project->users()->where('user_id', $request->user()->id)->exists(),
            403,
            'この案件にアクセスする権限がありません。'
        );
    }

    public function index(Request $request, Project $project): JsonResponse
    {
        $this->assertAssigned($request, $project);

        $request->validate(['month' => 'sometimes|date_format:Y-m']);

        $query = WorkHour::where('project_id', $project->id)
            ->where('user_id', $request->user()->id)
            ->orderBy('work_date');

        if ($request->month) {
            $query->whereRaw('DATE_FORMAT(work_date, "%Y-%m") = ?', [$request->month]);
        }

        return response()->json($query->get());
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $this->assertAssigned($request, $project);

        $data = $request->validate([
            'work_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', function ($attr, $val, $fail) use ($project) {
                if ($project->start_month && $val < $project->start_month->format('Y-m-d')) {
                    $fail("{$attr}は案件の開始日以降の日付を指定してください。");
                } elseif ($project->end_month && $val > $project->end_month->format('Y-m-d')) {
                    $fail("{$attr}は案件の終了予定日以前の日付を指定してください。");
                }
            }],
            'hours'     => ['required', 'numeric', 'max:24', function ($attr, $val, $fail) {
                $totalMin = (int) round((float)$val * 60);
                if ($totalMin < 5) $fail("{$attr}は5分以上で入力してください。");
                elseif ($totalMin % 5 !== 0) $fail("{$attr}は5分刻みで入力してください。");
            }],
            'memo'      => 'nullable|string|max:255',
        ]);

        // 単価改定で過去の原価・粗利が遡って変わらないよう、入力時点の人日単価を固定する。
        // 未設定(0)のときはNULLにして、後から単価が設定されたら反映されるようにする。
        $dayCost = (float) $request->user()->day_cost;

        $workHour = WorkHour::create([
            ...$data,
            'project_id' => $project->id,
            'user_id'    => $request->user()->id,
            'day_cost'   => $dayCost > 0 ? $dayCost : null,
        ]);

        return response()->json($workHour, 201);
    }

    public function update(Request $request, Project $project, WorkHour $workHour): JsonResponse
    {
        $this->assertAssigned($request, $project);
        abort_unless($workHour->user_id === $request->user()->id, 403);
        abort_unless($workHour->project_id === $project->id, 404);

        $data = $request->validate([
            'hours' => ['sometimes', 'numeric', 'min:0.25', 'max:24', fn($attr, $val, $fail) => fmod((float)$val * 4, 1) !== 0.0 && $fail("{$attr}は0.25刻みで入力してください。")],
            'memo'  => 'nullable|string|max:255',
        ]);

        $workHour->update($data);

        return response()->json($workHour);
    }

    public function destroy(Request $request, Project $project, WorkHour $workHour): JsonResponse
    {
        $this->assertAssigned($request, $project);
        abort_unless($workHour->user_id === $request->user()->id, 403);
        abort_unless($workHour->project_id === $project->id, 404);

        $workHour->delete();

        return response()->json(null, 204);
    }
}
