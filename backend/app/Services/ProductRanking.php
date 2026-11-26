<?php

namespace App\Services;

use RuntimeException;

class ProductRanking
{
    private array $items = [];

    public function add(array $sale): void
    {
        if (!isset($sale['cart_items']) || !is_array($sale['cart_items']) || (!$sale['cart_items'] && (float) $sale['total'] !== 0.0)) {
            throw new RuntimeException('Falta el detalle de productos de una venta. No se puede calcular un ranking completo.');
        }
        foreach ($sale['cart_items'] as $item) {
            if (!is_array($item)) throw new RuntimeException('La API devolvió un detalle de producto inválido.');
            $id = isset($item['item_kit_id']) ? 'kit:'.$item['item_kit_id'] : (isset($item['item_id']) ? 'item:'.$item['item_id'] : null);
            $quantity = $item['quantity'] ?? null;
            if (!$id || !isset($item['name']) || trim((string) $item['name']) === '' || !is_numeric($quantity) || !is_finite((float) $quantity)) {
                throw new RuntimeException('La API devolvió un producto incompleto o una cantidad inválida.');
            }
            if (!isset($this->items[$id])) $this->items[$id] = [
                'id' => $id, 'name' => (string) $item['name'], 'sku' => trim((string) ($item['product_id'] ?? '')),
                'category' => (string) ($item['category_name'] ?? ''), 'quantity_micros' => 0,
            ];
            $this->items[$id]['quantity_micros'] += (int) round((float) $quantity * 1000000);
        }
    }

    public function result(): array
    {
        $items = array_values(array_filter($this->items, fn ($item) => $item['quantity_micros'] > 0));
        usort($items, fn ($a, $b) => $b['quantity_micros'] <=> $a['quantity_micros'] ?: strcmp($a['name'], $b['name']) ?: strcmp($a['id'], $b['id']));
        $top = array_slice($items, 0, 10);
        $topQuantity = array_sum(array_column($top, 'quantity_micros'));
        foreach ($top as $index => &$item) {
            $item['rank'] = $index + 1;
            $item['units'] = $item['quantity_micros'] / 1000000;
            $item['share'] = $topQuantity > 0 ? round($item['quantity_micros'] / $topQuantity * 100, 1) : 0;
            unset($item['quantity_micros']);
        }
        unset($item);
        return ['products' => $top, 'product_count' => count($items), 'top_units' => $topQuantity / 1000000, 'all_items' => array_values($this->items)];
    }
}
