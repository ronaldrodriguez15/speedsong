<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;
use RuntimeException;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'field' => ['required', 'in:product_id,item_number'], 'page' => ['nullable', 'integer', 'min:1'], 'export' => ['nullable', 'boolean'], 'point' => ['nullable', \Illuminate\Validation\Rule::in(['all', ...array_keys(config('points_of_sale'))])]]);
        $search = trim($data['search'] ?? '');
        $field = $data['field'];
        $points = config('points_of_sale');
        $selected = $data['point'] ?? 'all';
        if ($selected !== 'all') $points = [$selected => $points[$selected]];
        $directPage = $selected !== 'all' && !$request->boolean('export') ? (int) ($data['page'] ?? 1) : 0;
        foreach ($points as $point) if (empty($point['api_key']) || parse_url($point['url'], PHP_URL_SCHEME) !== 'https') return response()->json(['message' => 'La configuración de las sedes está incompleta.'], 503);
        try {
            $result = Cache::remember('inventory-v3:'.hash('sha256', json_encode([$points, $search, $field, $directPage])), 300, function () use ($points, $search, $field, $directPage) {
                $offsets = array_fill_keys(array_keys($points), $directPage ? ($directPage - 1) * 25 : 0);
                $remoteTotal = null;
                $rows = []; $seen = []; $started = microtime(true);
                for ($page = 0; $page < 20 && $offsets; $page++) {
                    if (microtime(true) - $started > 45) throw new RuntimeException('La consulta es demasiado amplia. Busca una referencia más específica.');
                    $responses = Http::pool(function (Pool $pool) use ($offsets, $points, $search, $field, $directPage) {
                        $requests = [];
                        foreach ($offsets as $id => $offset) $requests[] = $pool->as($id)->acceptJson()->withHeaders(['x-api-key' => $points[$id]['api_key']])
                            ->connectTimeout(5)->timeout(15)->withOptions(['allow_redirects' => false, 'verify' => config('pos.ca_bundle') ?: true])
                            ->get(rtrim($points[$id]['url'], '/').'/index.php/api/v1/items', ['search' => $search, 'search_field' => $field, 'limit' => $directPage ? 25 : 1000, 'offset' => $offset, 'sort_col' => 'item_id', 'sort_dir' => 'asc']);
                        return $requests;
                    });
                    foreach ($offsets as $id => $offset) {
                        $response = $responses[$id] ?? null;
                        if (!$response instanceof \Illuminate\Http\Client\Response || !$response->successful()) throw new RuntimeException('No se pudo consultar '.$points[$id]['name'].'. Reintenta para obtener un inventario completo.');
                        $items = $response->json();
                        if (!is_array($items) || !array_is_list($items)) throw new RuntimeException('La sede devolvió un inventario inválido.');
                        foreach ($items as $item) {
                            if (!is_array($item) || !isset($item['item_id'], $item['name']) || isset($seen[$id][$item['item_id']])) throw new RuntimeException('El inventario cambió durante la consulta. Intenta nuevamente.');
                            $seen[$id][$item['item_id']] = true;
                            if (filter_var($item['deleted'] ?? false, FILTER_VALIDATE_BOOLEAN) || filter_var($item['is_service'] ?? false, FILTER_VALIDATE_BOOLEAN)) continue;
                            $reference = trim((string) ($item[$field] ?? ''));
                            // Missing references remain separate; local item IDs cannot identify products across stores.
                            $key = count($points) === 1 || $reference === '' ? "$id:{$item['item_id']}" : 'ref:'.mb_strtoupper($reference);
                            $locations = $item['locations'] ?? null;
                            if (!is_array($locations) || !$locations) throw new RuntimeException('Faltan cantidades en '.$points[$id]['name'].'. No se muestran totales parciales.');
                            $quantity = 0;
                            foreach ($locations as $location) {
                                $value = $location['quantity'] ?? null;
                                if ($value === null || $value === '') { $quantity = null; break; }
                                if (!is_numeric($value) || !is_finite((float) $value)) throw new RuntimeException('Una cantidad de inventario no es válida.');
                                $quantity += (float) $value;
                            }
                            $rows[$key] ??= ['id' => $key, 'reference' => $reference, 'name' => $item['name'], 'category' => $item['category'] ?? $item['category_name'] ?? '', 'description' => $item['description'] ?? '', 'barcode' => $item['item_number'] ?? '', 'quantities' => array_fill_keys(array_keys($points), 0), 'total' => 0];
                            $rows[$key]['quantities'][$id] = $quantity === null || $rows[$key]['quantities'][$id] === null ? null : round($rows[$key]['quantities'][$id] + $quantity, 6);
                            $rows[$key]['total'] = in_array(null, $rows[$key]['quantities'], true) ? null : round(array_sum($rows[$key]['quantities']), 6);
                        }
                        $next = $offset + count($items);
                        $total = $response->header('x-total-records');
                        if ($directPage) {
                            if (!ctype_digit($total)) throw new RuntimeException('La sede no indicó el total de productos. Reintenta la consulta.');
                            $remoteTotal = (int) $total;
                            unset($offsets[$id]); continue;
                        }
                        if (ctype_digit($total) ? $next >= (int) $total : count($items) < 1000) unset($offsets[$id]);
                        elseif (!$items) throw new RuntimeException('La API devolvió un inventario incompleto.');
                        else $offsets[$id] = $next;
                    }
                }
                if ($offsets) throw new RuntimeException('Hay demasiados resultados. Busca una referencia más específica.');
                $rows = array_values($rows);
                usort($rows, fn ($a, $b) => strnatcasecmp($a['reference'], $b['reference']) ?: strcasecmp($a['name'], $b['name']));
                return ['rows' => $rows, 'remote_total' => $remoteTotal, 'points' => array_map(fn ($id, $p) => ['id' => $id, 'name' => $p['name']], array_keys($points), array_values($points)), 'updated_at' => now('America/Bogota')->toIso8601String(), 'search' => $search, 'field' => $field];
            });
            $total = $result['remote_total'] ?? count($result['rows']);
            $page = (int) ($data['page'] ?? 1);
            if (!$request->boolean('export') && !$directPage) $result['rows'] = array_slice($result['rows'], ($page - 1) * 25, 25);
            return response()->json(['data' => [...$result, 'total' => $total, 'page' => $page, 'last_page' => max(1, (int) ceil($total / 25))]]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}
