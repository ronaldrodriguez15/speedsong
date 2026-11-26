<?php

namespace App\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class InventoryPage
{
    public static function text(mixed $value): string
    {
        return trim(preg_replace('/[\s\x{00a0}\x{200b}\x{feff}]+/u', ' ', html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }

    public static function hidden(array $item): bool
    {
        $name = mb_strtolower(self::text($item['name'] ?? ''));
        $reference = mb_strtolower(self::text($item['product_id'] ?? ''));
        return $name === 'ninguno' || $reference === 'ninguno'
            || ($name === '' && in_array($reference, ['', 'sin referencia'], true))
            || filter_var($item['deleted'] ?? false, FILTER_VALIDATE_BOOLEAN)
            || filter_var($item['is_service'] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    private function order(array $item, string $field): string
    {
        return Str::lower(Str::ascii(self::text($item[$field] ?? '')));
    }

    public function get(array $points, array $terms, string $field, int $page): array
    {
        $key = 'inventory-pages-v1:'.hash('sha256', json_encode([$points, $terms, $field]));
        $state = Cache::get($key);
        if (!$state) {
            $streams = [];
            foreach ($points as $id => $point) foreach ($terms ?: [''] as $term) {
                $streams[] = ['point' => $id, 'term' => $term, 'offset' => 0, 'done' => false, 'buffer' => [], 'seen' => [], 'last_order' => null];
            }
            $state = ['streams' => $streams, 'seen' => [], 'pages' => [], 'count' => 0,
                'updated_at' => now('America/Bogota')->toIso8601String(), 'expires_at' => time() + 300];
        }
        $started = microtime(true);
        while (!isset($state['pages'][$page])) {
            $nextPage = count($state['pages']) + 1;
            if ($nextPage > 1 && !$state['pages'][$nextPage - 1]['has_more']) {
                throw new RuntimeException('Esta página no existe. Vuelve a consultar el inventario.');
            }
            $rows = [];
            while (count($rows) < 10) {
                $this->fill($state['streams'], $points, $field, $started);
                $selected = $this->first($state['streams'], $field);
                if ($selected === null) break;
                $first = $state['streams'][$selected]['buffer'][0];
                $reference = self::text($first[$field] ?? '');
                $group = $this->order($first, $field);
                $row = null;
                // Drain matching references across every stream, including across remote page boundaries.
                do {
                    $stream = &$state['streams'][$selected];
                    $item = array_shift($stream['buffer']);
                    $pointId = $stream['point'];
                    unset($stream);
                    $identity = $pointId.':'.$item['item_id'];
                    if (!isset($state['seen'][$identity])) {
                        $state['seen'][$identity] = true;
                        $quantity = $this->quantity($item);
                        $row ??= ['id' => count($points) === 1 || $reference === '' ? $identity : 'ref:'.mb_strtoupper($reference),
                            'reference' => $reference, 'name' => self::text($item['name'] ?? ''),
                            'category' => self::text($item['category'] ?? $item['category_name'] ?? ''),
                            'quantities' => array_fill_keys(array_keys($points), 0), 'total' => 0];
                        $row['quantities'][$pointId] = $quantity === null || $row['quantities'][$pointId] === null ? null : round($row['quantities'][$pointId] + $quantity, 6);
                    }
                    $this->fill($state['streams'], $points, $field, $started);
                    $selected = $this->first($state['streams'], $field);
                    if (count($points) === 1 || $reference === '') break;
                } while ($selected !== null && $this->order($state['streams'][$selected]['buffer'][0], $field) === $group);
                if ($row !== null) {
                    $row['total'] = in_array(null, $row['quantities'], true) ? null : round(array_sum($row['quantities']), 6);
                    $rows[] = $row;
                }
            }
            // Remove overlap between search terms before deciding whether another page exists.
            do {
                $this->fill($state['streams'], $points, $field, $started);
                $selected = $this->first($state['streams'], $field);
                if ($selected === null) break;
                $stream = &$state['streams'][$selected];
                $duplicate = isset($state['seen'][$stream['point'].':'.$stream['buffer'][0]['item_id']]);
                if ($duplicate) array_shift($stream['buffer']);
                unset($stream);
            } while ($duplicate);
            $hasMore = $selected !== null;
            $state['count'] += count($rows);
            $state['pages'][$nextPage] = ['rows' => $rows, 'has_more' => $hasMore, 'total' => $hasMore ? null : $state['count'],
                'page' => $nextPage, 'last_page' => $hasMore ? null : $nextPage, 'per_page' => 10];
            Cache::put($key, $state, max(1, $state['expires_at'] - time()));
        }
        return [...$state['pages'][$page], 'points' => array_map(fn ($id, $point) => ['id' => $id, 'name' => $point['name']], array_keys($points), array_values($points)),
            'search' => implode(', ', $terms), 'field' => $field, 'updated_at' => $state['updated_at']];
    }

    private function first(array $streams, string $field): ?int
    {
        $selected = null;
        foreach ($streams as $index => $stream) {
            if (!$stream['buffer']) continue;
            if ($selected === null || strcmp($this->order($stream['buffer'][0], $field), $this->order($streams[$selected]['buffer'][0], $field)) < 0) $selected = $index;
        }
        return $selected;
    }

    private function fill(array &$streams, array $points, string $field, float $started): void
    {
        while (true) {
            $pending = array_filter($streams, fn ($stream) => !$stream['done'] && !$stream['buffer']);
            if (!$pending) return;
            if (microtime(true) - $started > 45) throw new RuntimeException('La consulta está tardando demasiado. Intenta buscar una referencia.');
            $responses = Http::pool(function (Pool $pool) use ($pending, $points, $field) {
                $requests = [];
                foreach ($pending as $index => $stream) {
                    $point = $points[$stream['point']];
                    $requests[] = $pool->as((string) $index)->acceptJson()->withHeaders(['x-api-key' => $point['api_key']])
                        ->connectTimeout(5)->timeout(15)->withOptions(['allow_redirects' => false, 'verify' => config('pos.ca_bundle') ?: true])
                        ->get(rtrim($point['url'], '/').'/index.php/api/v1/items', ['search' => $stream['term'], 'search_field' => $field,
                            'limit' => 10, 'offset' => $stream['offset'], 'sort_col' => $field, 'sort_dir' => 'asc']);
                }
                return $requests;
            });
            foreach ($pending as $index => $pendingStream) {
                $response = $responses[$index] ?? null;
                if (!$response instanceof Response || !$response->successful()) throw new RuntimeException('No se pudo consultar '.$points[$pendingStream['point']]['name'].'. Reintenta para obtener un inventario completo.');
                $items = $response->json();
                if (!is_array($items) || !array_is_list($items)) throw new RuntimeException('La sede devolvió un inventario inválido.');
                $stream = &$streams[$index];
                foreach ($items as $item) {
                    if (!is_array($item) || !isset($item['item_id']) || isset($stream['seen'][$item['item_id']])) throw new RuntimeException('El inventario cambió durante la consulta. Intenta nuevamente.');
                    $stream['seen'][$item['item_id']] = true;
                    if (self::hidden($item)) continue;
                    $order = $this->order($item, $field);
                    if ($stream['last_order'] !== null && strcmp($order, $stream['last_order']) < 0) throw new RuntimeException('La sede no entregó el inventario ordenado. Intenta nuevamente.');
                    $stream['last_order'] = $order;
                    $stream['buffer'][] = $item;
                }
                $stream['offset'] += count($items);
                $total = $response->header('x-total-records');
                $stream['done'] = ctype_digit($total) ? $stream['offset'] >= (int) $total : count($items) < 10;
                if (!$items && !$stream['done']) throw new RuntimeException('La API devolvió un inventario incompleto.');
                unset($stream);
            }
        }
    }

    private function quantity(array $item): ?float
    {
        $locations = $item['locations'] ?? null;
        if (!is_array($locations) || !$locations) throw new RuntimeException('Faltan cantidades. No se muestran totales parciales.');
        $quantity = 0;
        foreach ($locations as $location) {
            $value = $location['quantity'] ?? null;
            if ($value === null || $value === '') return null;
            if (!is_numeric($value) || !is_finite((float) $value)) throw new RuntimeException('Una cantidad de inventario no es válida.');
            $quantity += (float) $value;
        }
        return $quantity;
    }
}
