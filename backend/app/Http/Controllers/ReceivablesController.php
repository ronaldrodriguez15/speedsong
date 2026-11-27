<?php

namespace App\Http\Controllers;

use App\Services\PointOfSaleReceivables;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class ReceivablesController extends Controller
{
    public function index(Request $request, string $point, PointOfSaleReceivables $service): JsonResponse
    {
        $points = config('points_of_sale');
        abort_unless(array_key_exists($point, $points), 404);
        abort_unless($request->user()->canAccessPoint($point), 403);
        $data = $request->validate(['search' => ['nullable', 'string', 'max:150'], 'page' => ['nullable', 'integer', 'min:1']]);
        $configuration = $points[$point];
        if (empty($configuration['api_key']) || !filter_var($configuration['url'], FILTER_VALIDATE_URL)
            || parse_url($configuration['url'], PHP_URL_SCHEME) !== 'https') {
            return response()->json(['message' => 'La configuración de esta sede está incompleta.'], 503);
        }
        $fingerprint = hash('sha256', $configuration['url'].$configuration['api_key']);
        $day = now('America/Bogota')->toDateString();
        try {
            $snapshot = Cache::remember("pos-receivables-v2:$point:$day:$fingerprint", 60, function () use ($service, $configuration, $point) {
                try {
                    $result = $service->outstanding($configuration);
                    $result['snapshot_id'] = (string) Str::uuid();
                    Cache::put("pos-receivables-records-v2:$point:{$result['snapshot_id']}", $result, 900);
                    return $result;
                } catch (RuntimeException $e) {
                    if ($e->getCode() === 501) return ['unavailable' => $e->getMessage()];
                    throw $e;
                }
            });
            if (isset($snapshot['unavailable'])) return response()->json(['message' => $snapshot['unavailable'], 'code' => 'report_unavailable'], 501);
            $search = Str::lower(Str::ascii(trim($data['search'] ?? '')));
            $customers = collect($snapshot['customers'])->filter(fn ($customer) => $search === '' || str_contains(Str::lower(Str::ascii($customer['name'])), $search))->values();
            $page = (int) ($data['page'] ?? 1);
            return response()->json([
                'data' => $customers->slice(($page - 1) * 20, 20)->map(function ($customer) { unset($customer['credits']); return $customer; })->values(),
                'total' => $customers->count(), 'current_page' => $page, 'last_page' => max(1, (int) ceil($customers->count() / 20)),
                'summary' => ['customer_count' => $snapshot['customer_count'], 'sale_count' => $snapshot['sale_count'], 'amount' => $snapshot['amount']],
                'snapshot_id' => $snapshot['snapshot_id'], 'updated_at' => $snapshot['updated_at'], 'as_of' => $snapshot['as_of'],
            ]);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'No fue posible conectar con la sede. Revisa la conexión y reintenta.'], 502);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function credits(Request $request, string $point, string $customer): JsonResponse
    {
        abort_unless($request->user()->canAccessPoint($point), 403);
        abort_unless(array_key_exists($point, config('points_of_sale')), 404);
        $data = $request->validate(['snapshot' => ['required', 'uuid'], 'page' => ['nullable', 'integer', 'min:1'],
            'tab' => ['nullable', 'in:amount,over_60,over_90,over_120,paid']]);
        $snapshot = Cache::get("pos-receivables-records-v2:$point:{$data['snapshot']}");
        if (!$snapshot) return response()->json(['message' => 'Esta consulta venció. Cierra el detalle y actualiza la cartera.'], 410);
        $record = collect($snapshot['customers'])->first(fn ($row) => (string) $row['id'] === $customer);
        abort_unless($record, 404);
        $page = (int) ($data['page'] ?? 1);
        $tab = $data['tab'] ?? 'amount';
        $credits = $record['credits'];
        $paidError = null;
        if ($tab === 'paid') {
            $balances = $this->balances($point, $record, $data['snapshot']);
            $value = $balances['paid'];
            $paidError = $balances['paid_error'];
            $credits = [];
        } else {
            $value = $record[$tab];
            if ($tab !== 'amount') {
                $days = (int) substr($tab, 5);
                $credits = array_values(array_filter($credits, fn ($credit) => $credit['age_days'] > $days));
            }
        }
        $total = count($credits);
        return response()->json(['data' => array_slice($credits, ($page - 1) * 20, 20),
            'customer' => ['id' => $record['id'], 'name' => $record['name']], 'tab' => $tab, 'value' => $value,
            'paid_error' => $paidError, 'customer_credit_count' => $record['sale_count'],
            'total' => $total, 'current_page' => $page, 'last_page' => max(1, (int) ceil($total / 20)),
            'as_of' => $snapshot['as_of'], 'updated_at' => $snapshot['updated_at']]);
    }

    public function report(Request $request, string $point, string $customer): JsonResponse
    {
        abort_unless($request->user()->canAccessPoint($point), 403);
        abort_unless(array_key_exists($point, config('points_of_sale')), 404);
        $data = $request->validate(['snapshot' => ['required', 'uuid']]);
        $snapshot = Cache::get("pos-receivables-records-v2:$point:{$data['snapshot']}");
        if (!$snapshot) return response()->json(['message' => 'Esta consulta venció. Cierra el detalle y actualiza la cartera antes de descargar el PDF.'], 410);
        $record = collect($snapshot['customers'])->first(fn ($row) => (string) $row['id'] === $customer);
        abort_unless($record, 404);
        return response()->json(['data' => [
            'point' => ['id' => $point, 'name' => config("points_of_sale.$point.name")],
            'customer' => ['id' => $record['id'], 'name' => $record['name']],
            'credits' => $record['credits'], 'amount' => $record['amount'], 'total' => $record['sale_count'],
            ...$this->balances($point, $record, $data['snapshot']),
            'as_of' => $snapshot['as_of'], 'updated_at' => $snapshot['updated_at'],
            'generated_at' => now('America/Bogota')->toIso8601String(),
        ]])->header('Cache-Control', 'private, no-store');
    }

    private function balances(string $point, array $record, string $snapshot): array
    {
        $balances = array_intersect_key($record, array_flip(['over_60', 'over_90', 'over_120']));
        try {
            $balances['paid'] = Cache::remember("pos-receivables-paid:$point:$snapshot:{$record['id']}", 900,
                fn () => app(PointOfSaleReceivables::class)->paid(config("points_of_sale.$point"), $record));
            $balances['paid_error'] = null;
        } catch (ConnectionException | RuntimeException $e) {
            $balances['paid'] = null;
            $balances['paid_error'] = 'No fue posible verificar los pagos. Actualiza la cartera y vuelve a intentarlo.';
        }
        return $balances;
    }
}
