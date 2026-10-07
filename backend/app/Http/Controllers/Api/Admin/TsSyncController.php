<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class TsSyncController extends Controller
{
    public function sync(): JsonResponse
    {
        return response()->json(['message' => 'TS同期はPhase 5で実装予定です。'], 501);
    }
}
