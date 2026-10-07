<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectWorkItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $accountDirectorIds = array_filter((array) $request->input('account_director_ids', []));

        // ディレクターも管理者と同じく全案件を対象にし、同じ絞り込み(稼働状況・アカウントディレクター・請求月)を使える。
        // 無効化(退職等)されたメンバーも過去の実績の担当者として残る。is_active は「（無効）」表示用。
        $projects = Project::with(['users:id,name,role,is_active'])
            ->withProfitMetrics()
            ->when($request->work_status, fn ($q, $v) => $q->where('work_status', $v))
            ->when($request->probability, fn ($q, $v) => $q->where('probability', $v))
            ->when(
                $accountDirectorIds !== [],
                fn ($q) => $q->whereIn('account_director', User::whereIn('id', $accountDirectorIds)->pluck('name'))
            )
            ->when($request->billing_month_from, fn ($q, $v) => $q->where('billing_month', '>=', $v.'-01'))
            ->when($request->billing_month_to, fn ($q, $v) => $q->where('billing_month', '<=', Carbon::parse($v.'-01')->endOfMonth()->format('Y-m-d')))
            ->orderByDesc('billing_month')
            ->get();

        $this->attachActualHoursPerUser($projects);

        return response()->json($projects);
    }

    public function show(Project $project): JsonResponse
    {
        $project->load('users:id,name');
        $project->loadProfitMetrics();

        return response()->json($project);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate([
            'project_name' => 'sometimes|string|max:255',
            'client_name' => 'nullable|string|max:255',
            'ts_project_code' => "nullable|string|max:50|unique:projects,ts_project_code,{$project->id}",
            'ts_job_id' => 'nullable|string|max:60',
            'currency' => 'sometimes|string|max:10',
            'amount' => 'sometimes|numeric|min:0',
            'probability' => 'sometimes|in:won,lost,pending',
            'billing_month' => 'nullable|date_format:Y-m',
            'acceptance_month' => 'nullable|date_format:Y-m',
            'start_month' => 'nullable|date_format:Y-m-d',
            'end_month' => 'nullable|date_format:Y-m-d',
            'work_status' => 'sometimes|in:in_progress,completed',
            'notes' => 'nullable|string',
        ]);

        foreach (['billing_month', 'acceptance_month'] as $field) {
            if (array_key_exists($field, $data) && ! empty($data[$field])) {
                $data[$field] = $data[$field].'-01';
            }
        }

        $project->update($data);

        return response()->json($project->load('users:id,name'));
    }

    public function destroy(Project $project): JsonResponse
    {
        $project->delete();

        return response()->json(null, 204);
    }

    public function assignedUsers(Project $project): JsonResponse
    {
        return response()->json($project->users()->select('users.id', 'users.name', 'users.email', 'users.is_active')->get());
    }

    public function usersHours(Project $project): JsonResponse
    {
        $hoursPerDay = (int) config('work.hours_per_day');

        // 単価は工数入力/インポート時点のスナップショット(wh.day_cost / pwi.day_cost)を使う。
        // 単価改定で確定した過去の原価が動かないようにするため。
        // 入力時点で単価が未設定だった行は NULL なので、現在の users.day_cost にフォールバックする。
        $actualRows = collect(DB::select(
            'SELECT u.id, u.name, u.is_active, wh.work_date, wh.hours,
                    COALESCE(wh.day_cost, u.day_cost) AS day_cost
             FROM project_user pu
             JOIN users u ON u.id = pu.user_id
             LEFT JOIN work_hours wh ON wh.user_id = u.id AND wh.project_id = pu.project_id
             WHERE pu.project_id = ? AND u.role != ?
             ORDER BY u.id',
            [$project->id, 'director']
        ))->each(function ($row) {
            $row->ym = $row->work_date ? Carbon::parse($row->work_date)->format('Y-m') : null;
        });

        $planRows = collect(DB::select(
            'SELECT u.id, u.name, u.is_active, pwi.work_month, pwi.planned_cost,
                    COALESCE(pwi.day_cost, u.day_cost) AS day_cost
             FROM project_work_items pwi
             JOIN users u ON u.id = pwi.user_id
             WHERE pwi.project_id = ? AND u.role != ?',
            [$project->id, 'director']
        ))->each(function ($row) {
            $row->ym = Carbon::parse($row->work_month)->format('Y-m');
        });

        $months = $actualRows->pluck('ym')->filter()
            ->merge($planRows->pluck('ym'))
            ->unique()->sort()->values();

        $userMeta = [];
        foreach ($actualRows->merge($planRows) as $row) {
            $userMeta[$row->id] ??= [
                'id' => $row->id,
                'name' => $row->name,
                'is_active' => (bool) $row->is_active,
                'rates' => [],
            ];

            // 「当時の単価」表示用に、この案件で実際に使われた単価を集める。
            // 案件途中で単価改定があると複数になるため、フロントで範囲表示できるようにする。
            if ((float) $row->day_cost > 0) {
                $userMeta[$row->id]['rates'][] = (float) $row->day_cost;
            }
        }

        // 単価は行ごとに違いうるので、月の合計時間に単価を掛けるのではなく行ごとに原価を積む。
        $actualHoursByUserMonth = [];
        $actualCostByUserMonth = [];
        foreach ($actualRows as $row) {
            if ($row->ym === null) {
                continue;
            }
            $hours = (float) $row->hours;
            $actualHoursByUserMonth[$row->id][$row->ym] = ($actualHoursByUserMonth[$row->id][$row->ym] ?? 0.0) + $hours;
            $actualCostByUserMonth[$row->id][$row->ym] = ($actualCostByUserMonth[$row->id][$row->ym] ?? 0.0)
                + $hours / $hoursPerDay * (float) $row->day_cost;
        }

        $plannedCostByUserMonth = [];
        $plannedDaysByUserMonth = [];
        foreach ($planRows as $row) {
            $cost = (float) $row->planned_cost;
            $rate = (float) $row->day_cost;
            $plannedCostByUserMonth[$row->id][$row->ym] = ($plannedCostByUserMonth[$row->id][$row->ym] ?? 0.0) + $cost;
            $plannedDaysByUserMonth[$row->id][$row->ym] = ($plannedDaysByUserMonth[$row->id][$row->ym] ?? 0.0)
                + ($rate > 0 ? $cost / $rate : 0.0);
        }

        $users = collect($userMeta)->map(function ($meta) use ($months, $actualHoursByUserMonth, $actualCostByUserMonth, $plannedCostByUserMonth, $plannedDaysByUserMonth) {
            $totalActualHours = 0.0;
            $totalActualCost = 0.0;
            $totalPlannedDays = 0.0;
            $totalPlannedCost = 0.0;

            $monthly = $months->mapWithKeys(function ($m) use ($meta, $actualHoursByUserMonth, $actualCostByUserMonth, $plannedCostByUserMonth, $plannedDaysByUserMonth, &$totalActualHours, &$totalActualCost, &$totalPlannedDays, &$totalPlannedCost) {
                $actualHours = $actualHoursByUserMonth[$meta['id']][$m] ?? 0.0;
                $actualCost = $actualCostByUserMonth[$meta['id']][$m] ?? 0.0;
                $plannedCost = $plannedCostByUserMonth[$meta['id']][$m] ?? 0.0;
                $plannedDays = $plannedDaysByUserMonth[$meta['id']][$m] ?? 0.0;

                $totalActualHours += $actualHours;
                $totalActualCost += $actualCost;
                $totalPlannedDays += $plannedDays;
                $totalPlannedCost += $plannedCost;

                return [$m => [
                    'actual_hours' => round($actualHours, 2),
                    'actual_cost' => round($actualCost, 2),
                    'planned_days' => round($plannedDays, 2),
                    'planned_cost' => round($plannedCost, 2),
                ]];
            });

            $rates = array_unique($meta['rates']);

            return [
                'id' => $meta['id'],
                'name' => $meta['name'],
                'is_active' => $meta['is_active'],
                // 単価改定があった案件は min !== max になるので、フロントで範囲表示する。
                'day_cost_min' => $rates === [] ? null : round(min($rates), 2),
                'day_cost_max' => $rates === [] ? null : round(max($rates), 2),
                'monthly' => $monthly,
                'total_actual_hours' => round($totalActualHours, 2),
                'total_actual_cost' => round($totalActualCost, 2),
                'total_planned_days' => round($totalPlannedDays, 2),
                'total_planned_cost' => round($totalPlannedCost, 2),
            ];
        })->sortBy('id')->values();

        return response()->json([
            'months' => $months,
            'users' => $users,
            'total_actual_cost' => round((float) $users->sum('total_actual_cost'), 2),
            'total_planned_cost' => round((float) ProjectWorkItem::where('project_id', $project->id)->sum('planned_cost'), 2),
        ]);
    }

    public function syncUsers(Request $request, Project $project): JsonResponse
    {
        $request->validate([
            'user_ids' => 'present|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        // 無効化されたメンバーは担当者候補に出ないため、送られてくる user_ids に含まれない。
        // そのまま sync すると過去の実績を辿る手掛かりである project_user 行が消えるので明示的に残す。
        $inactiveIds = $project->users()->where('users.is_active', false)->pluck('users.id')->all();

        $project->users()->sync(array_unique([...$request->user_ids, ...$inactiveIds]));

        return response()->json($project->users()->select('users.id', 'users.name', 'users.email', 'users.is_active')->get());
    }

    /**
     * 案件一覧エクスポートで「案件×担当者」単位の実働工数を出力できるよう、
     * 各案件のusers(担当者)ごとにwork_hoursの合計を付与する。
     * あわせて、エクスポートを取込元ファイルと同じ明細行(案件×担当者×明細月)で出せるよう
     * 月ごとの内訳をmonthlyとして付与する。
     */
    private function attachActualHoursPerUser(Collection $projects): void
    {
        $projectIds = $projects->pluck('id');

        $hoursByProjectUser = DB::table('work_hours')
            ->select('project_id', 'user_id', DB::raw('SUM(hours) as hours'))
            ->whereIn('project_id', $projectIds)
            ->groupBy('project_id', 'user_id')
            ->get()
            ->groupBy('project_id');

        $monthly = $this->buildMonthlyHours($projectIds);

        $projects->each(function (Project $project) use ($hoursByProjectUser, $monthly) {
            $projectHours = $hoursByProjectUser->get($project->id, collect())->keyBy('user_id');
            $project->users->each(function (User $user) use ($project, $projectHours, $monthly) {
                $user->setAttribute('actual_hours', round((float) ($projectHours->get($user->id)?->hours ?? 0), 2));
                $user->setAttribute('monthly', $monthly[$project->id][$user->id] ?? []);
            });
        });
    }

    /**
     * 案件×担当者ごとの月別内訳を組み立てる。
     * 月の集合は計画明細(project_work_items.work_month = 取込元ファイルの「明細月」)と
     * 実績(work_hours.work_date)の和集合とし、実績が無い計画月も行として残す。
     *
     * @return array<int, array<int, list<array{month: string, actual_hours: float}>>>
     */
    private function buildMonthlyHours(Collection $projectIds): array
    {
        // SUBSTR(date, 1, 7) はMySQL・SQLiteのどちらでも 'YYYY-MM' を返すためDB側で月に丸める。
        $actualRows = DB::table('work_hours')
            ->select('project_id', 'user_id', DB::raw('SUBSTR(work_date, 1, 7) as ym'), DB::raw('SUM(hours) as hours'))
            ->whereIn('project_id', $projectIds)
            ->groupBy('project_id', 'user_id', DB::raw('SUBSTR(work_date, 1, 7)'))
            ->get();

        $planRows = DB::table('project_work_items')
            ->select('project_id', 'user_id', DB::raw('SUBSTR(work_month, 1, 7) as ym'))
            ->whereIn('project_id', $projectIds)
            ->whereNotNull('user_id')
            ->distinct()
            ->get();

        $hoursByMonth = [];
        foreach ($actualRows as $row) {
            $hoursByMonth[$row->project_id][$row->user_id][$row->ym] = round((float) $row->hours, 2);
        }
        foreach ($planRows as $row) {
            $hoursByMonth[$row->project_id][$row->user_id][$row->ym] ??= 0.0;
        }

        $result = [];
        foreach ($hoursByMonth as $projectId => $byUser) {
            foreach ($byUser as $userId => $byMonth) {
                ksort($byMonth);
                foreach ($byMonth as $month => $hours) {
                    $result[$projectId][$userId][] = ['month' => $month, 'actual_hours' => $hours];
                }
            }
        }

        return $result;
    }
}
