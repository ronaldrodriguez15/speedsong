<?php

namespace App\Http\Controllers;

use App\Services\TopProductsLoader;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\ConnectionException;
use RuntimeException;

class TopProductsController extends Controller
{
    public function index(Request $request, string $point, TopProductsLoader $loader): JsonResponse
    {
        $points = config('points_of_sale');
        abort_unless($point === 'stores' || array_key_exists($point, $points), 404);
        $points = $request->user()->accessiblePoints();
        abort_unless($point === 'stores' || isset($points[$point]), 403);
        $data = $request->validate(['refresh' => ['nullable', 'boolean'], 'period' => ['nullable', 'in:today,yesterday,last7,last30'], 'search' => ['nullable', 'string', 'max:2200']]);
        $terms = collect(preg_split('/[,;\r\n]+/', $data['search'] ?? ''))->map(fn ($term) => mb_strtoupper(trim($term)))->filter(fn ($term) => $term !== '')->unique()->values()->all();
        if (count($terms) > 20 || array_filter($terms, fn ($term) => mb_strlen($term) > 100)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['search' => 'Ingresa hasta 20 referencias, de máximo 100 caracteres cada una.']);
        }
        $period = $data['period'] ?? 'last30';
        $today = now('America/Bogota')->startOfDay();
        $end = $period === 'yesterday' ? $today->copy()->subDay() : $today->copy();
        $start = match ($period) { 'last7' => $today->copy()->subDays(6), 'last30' => $today->copy()->subDays(29), default => $end->copy() };
        $startDate = $start->toDateString();
        $endDate = $end->toDateString();
        $selected = $point === 'stores' ? array_diff_key($points, ['bodega' => true]) : [$point => $points[$point]];
        abort_unless($selected, 403, 'No tienes puntos de venta asignados.');
        foreach ($selected as $configuration) {
        if (empty($configuration['api_key']) || !filter_var($configuration['url'], FILTER_VALIDATE_URL) || parse_url($configuration['url'], PHP_URL_SCHEME) !== 'https') {
            return response()->json(['message' => 'La configuración de esta sede está incompleta.'], 503);
        }
        }
        try {
            $items = []; $saleCount = 0; $updatedAt = null;
            $results = $loader->load($selected, $startDate, $endDate, $request->boolean('refresh'));
            foreach ($selected as $id => $configuration) {
            $result = $results[$id];
            $saleCount += $result['sale_count'];
            $updatedAt = $updatedAt === null || $result['updated_at'] < $updatedAt ? $result['updated_at'] : $updatedAt;
            foreach ($result['all_items'] as $item) {
                $sku = mb_strtoupper(trim($item['sku']));
                $key = $point !== 'stores' ? $item['id'] : ($sku !== '' && $sku !== 'NINGUNO' ? explode(':', $item['id'])[0].':ref:'.$sku : $id.':'.$item['id']);
                if (!isset($items[$key])) $items[$key] = [...$item, 'id' => $key, 'quantity_micros' => 0];
                $items[$key]['quantity_micros'] += $item['quantity_micros'];
            }
            }
            $items = array_values(array_filter($items, function ($item) use ($terms) {
                if (!$terms) return $item['quantity_micros'] > 0;
                foreach ($terms as $term) if (str_contains(mb_strtoupper($item['sku']), $term)) return true;
                return false;
            }));
            usort($items, fn ($a, $b) => $b['quantity_micros'] <=> $a['quantity_micros'] ?: strcmp($a['name'], $b['name']) ?: strcmp($a['id'], $b['id']));
            $count = count($items);
            $products = $terms ? $items : array_slice($items, 0, 10);
            $quantity = array_sum(array_column($products, 'quantity_micros'));
            $positive = array_sum(array_map(fn ($item) => max(0, $item['quantity_micros']), $products));
            foreach ($products as $index => &$item) {
                $item['rank'] = $index + 1;
                $item['units'] = $item['quantity_micros'] / 1000000;
                $item['share'] = $positive ? round(max(0, $item['quantity_micros']) / $positive * 100, 1) : 0;
                unset($item['quantity_micros']);
            }
            unset($item);
            return response()->json(['data' => ['point' => $point, 'name' => $point === 'stores' ? 'Otros puntos de venta' : $configuration['name'],
                'products' => $products, 'product_count' => $count, 'sale_count' => $saleCount, 'top_units' => $quantity / 1000000,
                'search' => implode(', ', $terms), 'start_date' => $startDate, 'end_date' => $endDate, 'updated_at' => $updatedAt]]);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'No fue posible conectar con la sede. Reintenta la consulta de productos.'], 502);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}
