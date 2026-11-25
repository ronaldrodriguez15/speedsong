<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CashClosingController;
use App\Http\Controllers\PointOfSaleController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::apiResource('users', UserController::class);
    Route::get('/cash-closings', [CashClosingController::class, 'index']);
    Route::get('/points-of-sale', [PointOfSaleController::class, 'index']);
    Route::get('/points-of-sale/{point}/sales', [PointOfSaleController::class, 'sales'])->middleware('throttle:30,1');
    Route::get('/points-of-sale/{point}/sales/records', [PointOfSaleController::class, 'records'])->middleware('throttle:60,1');
    Route::post('/cash-closings', [CashClosingController::class, 'store']);
});
