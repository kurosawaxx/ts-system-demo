<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $projects = Project::whereHas('users', fn ($q) => $q->where('user_id', $user->id))
            ->with(['users:id,name'])
            ->select(['id', 'ts_project_code', 'project_name', 'client_name', 'probability', 'billing_month', 'work_status', 'start_month', 'end_month'])
            ->when($request->billing_month_from, fn ($q, $v) => $q->where('billing_month', '>=', $v . '-01'))
            ->when($request->billing_month_to, fn ($q, $v) => $q->where('billing_month', '<=', Carbon::parse($v . '-01')->endOfMonth()->format('Y-m-d')))
            ->orderByDesc('billing_month')
            ->get();

        $this->attachTotalPlannedHours($projects);
        $this->attachTotalActualHours($projects);

        return response()->json($projects);
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();

        // ディレクターは案件一覧で全案件を見られるため、詳細も担当・非担当を問わず参照できる。
        $hasAccess = $user->role === 'director'
            || $project->users()->where('user_id', $user->id)->exists();

        abort_unless($hasAccess, 403, 'この案件にアクセスする権限がありません。');

        $project->load('users:id,name');

        return response()->json([
            ...$project->only(['id', 'project_name', 'client_name', 'probability', 'billing_month', 'acceptance_month', 'start_month', 'end_month', 'work_status']),
            'users' => $project->users,
        ]);
    }

    /**
     * 案件単位の予定工数を付与する。
     * インポート時に作られる計画明細(project_work_items)の計画額をその担当者の人日単価で割って人日に換算し、
     * 1人日あたりの時間を掛けて時間に直す(案件詳細の「担当者別・月次稼働」が出している「予定」と同じ計算)。
     * 明細名が職種名のみで担当者が特定できない行は単価が決まらないため対象外(同画面と同じ挙動)。
     */
    private function attachTotalPlannedHours(Collection $projects): void
    {
        $hoursPerDay = (int) config('work.hours_per_day');

        // planned_cost / day_cost は SQLite だと整数除算になり端数が落ちるため、明示的に浮動小数で割る。
        // 単価はインポート時点のスナップショット(project_work_items.day_cost)優先、未設定なら現在値にフォールバック。
        $daysByProject = DB::table('project_work_items')
            ->join('users', 'users.id', '=', 'project_work_items.user_id')
            ->select('project_work_items.project_id', DB::raw('SUM(project_work_items.planned_cost * 1.0 / COALESCE(project_work_items.day_cost, users.day_cost)) as days'))
            ->where('users.role', 'user')
            ->whereRaw('COALESCE(project_work_items.day_cost, users.day_cost) > 0')
            ->whereIn('project_work_items.project_id', $projects->pluck('id'))
            ->groupBy('project_work_items.project_id')
            ->get()
            ->keyBy('project_id');

        $projects->each(fn (Project $project) => $project->setAttribute(
            'total_planned_hours',
            round((float) ($daysByProject->get($project->id)?->days ?? 0) * $hoursPerDay, 2)
        ));
    }

    /**
     * 案件単位の実働工数(work_hours の入力時間合計)を付与する。
     * メンバー(role=user)の入力分のみを対象とし、ディレクター/管理者は作業者として数えない
     * (管理者側の実働工数出力・実働工数画面と同じ扱い)。
     */
    private function attachTotalActualHours(Collection $projects): void
    {
        $hoursByProject = DB::table('work_hours')
            ->join('users', 'users.id', '=', 'work_hours.user_id')
            ->select('work_hours.project_id', DB::raw('SUM(work_hours.hours) as hours'))
            ->where('users.role', 'user')
            ->whereIn('work_hours.project_id', $projects->pluck('id'))
            ->groupBy('work_hours.project_id')
            ->get()
            ->keyBy('project_id');

        $projects->each(fn (Project $project) => $project->setAttribute(
            'total_actual_hours',
            round((float) ($hoursByProject->get($project->id)?->hours ?? 0), 2)
        ));
    }
}
