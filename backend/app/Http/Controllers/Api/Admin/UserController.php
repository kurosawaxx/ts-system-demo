<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::select(['id', 'name', 'email', 'role', 'day_cost', 'employee_code', 'is_active', 'deactivated_at'])
            ->when($request->user()->role === 'director', fn ($q) => $q->where('role', 'user'))
            // 無効(退職等)メンバーは一覧の末尾にまとめる。将来ページネーションを入れても
            // 並び順が崩れないよう、フロント側で並べ替えずDBのORDER BYで決めておく。
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }

    /**
     * 案件一覧の「アカウントディレクター」絞り込みの選択肢を返す。
     * ディレクターに加え、管理者アカウントをアカウントディレクターとして使っている場合があるため
     * role=admin も含める。さらに、どちらのロールでもないが実際に
     * projects.account_director に名前が入っているユーザーも取りこぼさないようにする。
     * ID と名前のみを返すので、ディレクターに他ユーザーの詳細情報は渡らない。
     */
    public function accountDirectors(): JsonResponse
    {
        $directorNames = Project::whereNotNull('account_director')->distinct()->pluck('account_director');

        $users = User::select(['id', 'name'])
            ->where(fn ($q) => $q->whereIn('role', ['admin', 'director'])->orWhereIn('name', $directorNames))
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', Password::min(8)],
            'role' => 'required|in:admin,user,director',
            'day_cost' => 'nullable|numeric|min:0',
            'employee_code' => 'nullable|string|max:20',
        ]);

        $user = User::create([
            ...$data,
            'password' => Hash::make($data['password']),
            'is_active' => true,
        ]);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'day_cost', 'employee_code', 'is_active']), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user->only(['id', 'name', 'email', 'role', 'day_cost', 'employee_code', 'is_active', 'deactivated_at']));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => "sometimes|email|unique:users,email,{$user->id}",
            'password' => ['sometimes', Password::min(8)],
            'role' => 'sometimes|in:admin,user,director',
            'day_cost' => 'sometimes|numeric|min:0',
            'employee_code' => 'nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
        ]);

        // 自分自身を無効化すると即座にログインできなくなり、自力で戻す手段が無くなるため防ぐ。
        if (array_key_exists('is_active', $data) && ! $data['is_active'] && $user->id === $request->user()->id) {
            abort(422, '自分自身を無効にはできません。');
        }

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $wasActive = (bool) $user->is_active;

        $user->fill($data);

        // 無効化した日時を退職日として残す。有効化したらクリアする。
        // deactivated_at は fillable に入れずここで明示代入する(リクエストから直接セットさせない)。
        if (array_key_exists('is_active', $data) && (bool) $data['is_active'] !== $wasActive) {
            $user->deactivated_at = $data['is_active'] ? null : now();
        }

        $user->save();

        // 無効化した時点でアクセスを断つ。発行済みトークンが生きていると、
        // ログインを塞いでも工数入力を続けられてしまう。
        if ($wasActive && ! $user->is_active) {
            $user->tokens()->delete();
        }

        return response()->json($user->only(['id', 'name', 'email', 'role', 'day_cost', 'employee_code', 'is_active']));
    }
}
