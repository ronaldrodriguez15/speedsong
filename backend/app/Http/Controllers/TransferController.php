<?php

namespace App\Http\Controllers;

use App\Services\InventoryPage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class TransferController extends Controller
{
    public function products(Request $request, InventoryPage $inventory)
    {
        abort_unless($request->user()->is_admin, 403, 'Solo los administradores pueden consultar transferencias.');
        $points = config('points_of_sale');
        $data = $request->validate([
            'point' => ['required', 'string', Rule::in(array_keys($points))],
            'other_point' => ['nullable', 'string', 'different:point', Rule::in(array_keys($points))],
            'search' => ['required', 'string', 'max:100', 'not_regex:/[,;\r\n]/'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $point = $points[$data['point']];
        if (empty($point['api_key']) || !filter_var($point['url'], FILTER_VALIDATE_URL) || parse_url($point['url'], PHP_URL_SCHEME) !== 'https') {
            return response()->json(['message' => 'La configuración de esta sede está incompleta.'], 503);
        }
        try {
            return response()->json(['data' => $inventory->get([$data['point'] => $point], [trim($data['search'])], 'product_id', (int) ($data['page'] ?? 1))]);
        } catch (RuntimeException $error) {
            return response()->json(['message' => $error->getMessage()], 502);
        }
    }
}
