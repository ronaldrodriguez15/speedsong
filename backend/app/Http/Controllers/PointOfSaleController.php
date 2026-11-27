<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\PointOfSaleSales;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Client\ConnectionException;
use RuntimeException;
use Illuminate\Support\Str;

class PointOfSaleController extends Controller
{
    public function sales(Request $request, string $point, PointOfSaleSales $sales): JsonResponse
    {
        $points = config('points_of_sale');
        abort_unless(array_key_exists($point, $points), 404);
        abort_unless($request->user()->canAccessPoint($point), 403);
        $today = now('America/Bogota')->startOfDay();
        $data = $request->validate([
            'date' => ['nullable', 'prohibits:period', 'date_format:Y-m-d', 'before_or_equal:'.$today->toDateString()],
            'period' => ['nullable', 'prohibits:date', 'in:today,yesterday,last7,last30'],
        ]);
        $period = $data['period'] ?? 'today';
        $end = $period === 'yesterday' ? $today->copy()->subDay() : $today->copy();
        $start = match ($period) {
            'last7' => $today->copy()->subDays(6),
            'last30' => $today->copy()->subDays(29),
            default => $end->copy(),
        };
        $startDate = $data['date'] ?? $start->toDateString();
        $endDate = $data['date'] ?? $end->toDateString();
        $configuration = $points[$point];
        if (empty($configuration['api_key']) || !filter_var($configuration['url'], FILTER_VALIDATE_URL)
            || parse_url($configuration['url'], PHP_URL_SCHEME) !== 'https') {
            return response()->json(['message' => 'La configuración de este punto de venta está incompleta.'], 503);
        }
        try {
            $fingerprint = hash('sha256', $configuration['url'].$configuration['api_key']);
            $summary = Cache::remember("pos-sales-v3:$point:$startDate:$endDate:$fingerprint", 60, function () use ($sales, $configuration, $startDate, $endDate, $point) {
                $summary = $sales->daily($configuration, $startDate, $endDate);
                $snapshot = (string) Str::uuid();
                Cache::put("pos-records:$point:$snapshot", $summary, 900);
                unset($summary['records']);
                return [...$summary, 'snapshot_id' => $snapshot];
            });
            return response()->json(['data' => ['point' => $point, 'name' => $configuration['name'], ...$summary]]);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'No fue posible conectar con este punto de venta. Revisa la conexión y la configuración HTTPS del servidor.'], 502);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function records(Request $request, string $point): JsonResponse
    {
        abort_unless($request->user()->canAccessPoint($point), 403);
        abort_unless(array_key_exists($point, config('points_of_sale')), 404);
        $data = $request->validate([
            'snapshot' => ['required', 'uuid'],
            'method' => ['required', 'in:all,cash,transfer,nequi,credit,other'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $snapshot = Cache::get("pos-records:$point:{$data['snapshot']}");
        if (!$snapshot) return response()->json(['message' => 'Esta consulta venció. Cierra el detalle y actualiza el resumen para ver los registros.'], 410);
        $method = $data['method'];
        $records = collect($snapshot['records'])->filter(fn ($record) => $method === 'all' || array_key_exists($method, $record['payments']))
            ->map(fn ($record) => [...$record, 'amount' => $method === 'all' ? $record['total'] : $record['payments'][$method]])->values();
        $page = (int) ($data['page'] ?? 1);
        return response()->json([
            'data' => $records->slice(($page - 1) * 20, 20)->values(),
            'total' => $records->count(), 'current_page' => $page,
            'last_page' => max(1, (int) ceil($records->count() / 20)),
            'amount' => $method === 'all' ? $snapshot['total'] : $snapshot['payments'][$method],
            'updated_at' => $snapshot['updated_at'],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        // Report local configuration only. Never expose keys or contact a POS.
        $points = collect($request->user()->accessiblePoints())->map(function (array $point, string $id) {
            $url = trim((string) ($point['url'] ?? ''));
            $configured = filter_var($url, FILTER_VALIDATE_URL) !== false
                && parse_url($url, PHP_URL_SCHEME) === 'https'
                && trim((string) ($point['api_key'] ?? '')) !== '';

            return [
                'id' => $id,
                'name' => $point['name'],
                'configured' => $configured,
                'consumption_enabled' => true,
                'connection_verified' => false,
            ];
        })->values();

        return response()->json(['data' => $points]);
    }
}
