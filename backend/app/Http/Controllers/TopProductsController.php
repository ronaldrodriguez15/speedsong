<?php

namespace App\Http\Controllers;

use App\Services\PointOfSaleSales;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class TopProductsController extends Controller
{
    public function index(Request $request, string $point, PointOfSaleSales $sales): JsonResponse
    {
        $points = config('points_of_sale');
        abort_unless(array_key_exists($point, $points), 404);
        $data = $request->validate(['period' => ['nullable', 'in:today,yesterday,last7,last30']]);
        $period = $data['period'] ?? 'last30';
        $today = now('America/Bogota')->startOfDay();
        $end = $period === 'yesterday' ? $today->copy()->subDay() : $today->copy();
        $start = match ($period) { 'last7' => $today->copy()->subDays(6), 'last30' => $today->copy()->subDays(29), default => $end->copy() };
        $startDate = $start->toDateString();
        $endDate = $end->toDateString();
        $configuration = $points[$point];
        if (empty($configuration['api_key']) || !filter_var($configuration['url'], FILTER_VALIDATE_URL) || parse_url($configuration['url'], PHP_URL_SCHEME) !== 'https') {
            return response()->json(['message' => 'La configuración de esta sede está incompleta.'], 503);
        }
        try {
            $fingerprint = hash('sha256', $configuration['url'].$configuration['api_key']);
            $result = Cache::remember("pos-top-products-v1:$point:$startDate:$endDate:$fingerprint", 60, function () use ($sales, $configuration, $startDate, $endDate) {
                $summary = $sales->daily($configuration, $startDate, $endDate, true);
                return [...$summary['ranking'], 'sale_count' => $summary['sale_count'], 'start_date' => $startDate, 'end_date' => $endDate, 'updated_at' => $summary['updated_at']];
            });
            return response()->json(['data' => ['point' => $point, 'name' => $configuration['name'], ...$result]]);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'No fue posible conectar con la sede. Reintenta la consulta de productos.'], 502);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}
