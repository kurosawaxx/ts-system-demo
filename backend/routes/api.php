<?php

use App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\WorkHourController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // 一般ユーザー向けルート
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::get('/projects/{project}/work-hours', [WorkHourController::class, 'index']);
    Route::post('/projects/{project}/work-hours', [WorkHourController::class, 'store']);
    Route::put('/projects/{project}/work-hours/{workHour}', [WorkHourController::class, 'update']);
    Route::delete('/projects/{project}/work-hours/{workHour}', [WorkHourController::class, 'destroy']);

    // 管理者向けルート
    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        // ユーザー管理
        Route::post('/users', [Admin\UserController::class, 'store']);
        Route::get('/users/{user}', [Admin\UserController::class, 'show']);
        Route::put('/users/{user}', [Admin\UserController::class, 'update']);

        // 案件管理
        Route::get('/projects/{project}', [Admin\ProjectController::class, 'show']);
        Route::put('/projects/{project}', [Admin\ProjectController::class, 'update']);
        Route::delete('/projects/{project}', [Admin\ProjectController::class, 'destroy']);

        // CSVインポート・TS同期 (Phase 4-5)
        Route::post('/projects/import-csv', [Admin\CsvImportController::class, 'import']);
        Route::post('/projects/sync-ts', [Admin\TsSyncController::class, 'sync']);

    });

    // 管理者・ディレクター共通ルート（担当者設定・工数集計）
    Route::middleware('role:admin,director')->prefix('admin')->group(function (): void {
        Route::get('/users', [Admin\UserController::class, 'index']);
        Route::get('/account-directors', [Admin\UserController::class, 'accountDirectors']);
        Route::get('/projects', [Admin\ProjectController::class, 'index']);
        Route::get('/projects/{project}/users', [Admin\ProjectController::class, 'assignedUsers']);
        Route::put('/projects/{project}/users', [Admin\ProjectController::class, 'syncUsers']);
        Route::get('/projects/{project}/users-hours', [Admin\ProjectController::class, 'usersHours']);
    });
});
