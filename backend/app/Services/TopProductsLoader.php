<?php

namespace App\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class TopProductsLoader
{
    public function load(array $points, string $start, string $end, bool $refresh = false): array
    {
        $results = []; $pending = [];
        foreach ($points as $id => $point) {
            $fingerprint = hash('sha256', $point['url'].$point['api_key']);
            $key = "pos-top-products-v3:$id:$start:$end:$fingerprint";
            $cached = $refresh ? null : Cache::get($key);
            if ($cached !== null) { $results[$id] = $cached; continue; }
            $pending[$id] = ['key' => $key, 'offset' => 0, 'seen' => [], 'count' => 0, 'ranking' => new ProductRanking()];
        }
        // Each round fetches the next page of every uncached store concurrently.
        for ($page = 0; $page < 80 && $pending; $page++) {
            $responses = Http::pool(function (Pool $pool) use ($pending, $points, $start, $end) {
                $requests = [];
                foreach ($pending as $id => $state) {
                    $point = $points[$id];
                    $requests[] = $pool->as($id)->acceptJson()->withHeaders(['x-api-key' => $point['api_key']])
                        ->connectTimeout(5)->timeout(15)
                        ->withOptions(['allow_redirects' => false, 'verify' => config('pos.ca_bundle') ?: true])
                        ->get(rtrim($point['url'], '/').'/index.php/api/v1/sales', [
                            'start_date' => $start.' 00:00:00', 'end_date' => $end.' 23:59:59',
                            'limit' => 250, 'offset' => $state['offset'], 'verbosity' => 'full',
                        ]);
                }
                return $requests;
            });
            foreach (array_keys($pending) as $id) {
                $response = $responses[$id] ?? null;
                if (!$response instanceof Response || !$response->successful()) {
                    throw new RuntimeException('No se pudo consultar '.$points[$id]['name'].'. Reintenta para obtener el ranking completo.');
                }
                $sales = $response->json();
                if (!is_array($sales) || !array_is_list($sales)) throw new RuntimeException('El punto de venta devolvió un formato de ventas inesperado.');
                $state = &$pending[$id];
                foreach ($sales as $sale) {
                    if (!is_array($sale) || !isset($sale['sale_id'])) throw new RuntimeException('La respuesta contiene ventas incompletas.');
                    if (isset($state['seen'][$sale['sale_id']])) throw new RuntimeException('Las ventas cambiaron durante la consulta. Actualiza el resumen.');
                    $state['seen'][$sale['sale_id']] = true;
                    if (filter_var($sale['deleted'] ?? false, FILTER_VALIDATE_BOOLEAN)
                        || (int) ($sale['suspended'] ?? 0) !== 0
                        || filter_var($sale['store_account_payment'] ?? false, FILTER_VALIDATE_BOOLEAN)
                        || ($sale['mode'] ?? '') === 'store_account_payment') continue;
                    if (!is_numeric($sale['total'] ?? null) || !is_finite((float) $sale['total'])) throw new RuntimeException('La respuesta contiene una venta incompleta.');
                    $state['ranking']->add($sale);
                    $state['count']++;
                }
                $state['offset'] += count($sales);
                $total = $response->header('x-total-records');
                $complete = ctype_digit($total) ? $state['offset'] >= (int) $total : count($sales) < 250;
                if ($complete) {
                    $results[$id] = [...$state['ranking']->result(), 'sale_count' => $state['count'],
                        'start_date' => $start, 'end_date' => $end, 'updated_at' => now('America/Bogota')->toIso8601String()];
                    Cache::put($state['key'], $results[$id], 300);
                    unset($pending[$id]);
                } elseif (!$sales) {
                    throw new RuntimeException('La API devolvió un listado incompleto. Actualiza el resumen.');
                }
                unset($state);
            }
        }
        if ($pending) throw new RuntimeException('El volumen de ventas supera el límite de consulta. No se muestran totales parciales.');
        return $results;
    }
}
