<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CashClosingController;
use App\Http\Controllers\PointOfSaleController;
use App\Http\Controllers\ReceivablesController;
use App\Http\Controllers\TopProductsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/inventory', [\App\Http\Controllers\InventoryController::class, 'index'])->middleware('throttle:20,1');
    Route::get('/user', fn (Request $request) => $request->user());
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::apiResource('users', UserController::class);
    Route::get('/cash-closings', [CashClosingController::class, 'index']);
    Route::get('/points-of-sale', [PointOfSaleController::class, 'index']);
    Route::get('/points-of-sale/{point}/receivables', [ReceivablesController::class, 'index'])->middleware('throttle:pos-reports');
    Route::get('/points-of-sale/{point}/receivables/{customer}/credits', [ReceivablesController::class, 'credits'])->middleware('throttle:pos-reports');
    Route::get('/points-of-sale/{point}/receivables/{customer}/report', [ReceivablesController::class, 'report'])->middleware('throttle:pos-reports');
    Route::get('/points-of-sale/{point}/top-products', [TopProductsController::class, 'index'])->middleware('throttle:pos-reports');
    Route::get('/points-of-sale/{point}/sales', [PointOfSaleController::class, 'sales'])->middleware('throttle:pos-reports');
    Route::get('/points-of-sale/{point}/sales/records', [PointOfSaleController::class, 'records'])->middleware('throttle:pos-reports');
    Route::post('/cash-closings', [CashClosingController::class, 'store']);
});
