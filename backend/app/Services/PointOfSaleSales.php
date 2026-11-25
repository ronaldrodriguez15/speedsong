<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class PointOfSaleSales
{
    public function daily(array $point, string $date, ?string $endDate = null, bool $includeProducts = false): array
    {
        $ranking = $includeProducts ? new ProductRanking() : null;
        $endDate ??= $date;
        $totals = ['cash' => 0, 'transfer' => 0, 'nequi' => 0, 'credit' => 0, 'other' => 0];
        $other = [];
        $records = [];
        $total = 0;
        $count = 0;
        $seen = [];
        $offset = 0;
        $complete = false;
        for ($page = 0; $page < 20; $page++) {
            $response = Http::acceptJson()->withHeaders(['x-api-key' => $point['api_key']])
                ->connectTimeout(5)->timeout(15)
                ->withOptions(['allow_redirects' => false, 'verify' => config('pos.ca_bundle') ?: true])
                ->get(rtrim($point['url'], '/').'/index.php/api/v1/sales', [
                    'start_date' => $date.' 00:00:00', 'end_date' => $endDate.' 23:59:59',
                    'limit' => 1000, 'offset' => $offset, 'verbosity' => 'full',
                ]);
            if (!$response->successful()) {
                throw new RuntimeException(in_array($response->status(), [401, 403])
                    ? 'El punto de venta rechazó la consulta. Revisa los permisos de la clave o espera un minuto antes de reintentar.'
                    : 'El punto de venta no pudo responder. Intenta nuevamente en unos momentos.');
            }
            $sales = $response->json();
            if (!is_array($sales) || !array_is_list($sales)) {
                throw new RuntimeException('El punto de venta devolvió un formato de ventas inesperado.');
            }
            foreach ($sales as $sale) {
                if (!is_array($sale) || !isset($sale['sale_id'])) throw new RuntimeException('La respuesta contiene ventas incompletas.');
                if (isset($seen[$sale['sale_id']])) throw new RuntimeException('Las ventas cambiaron durante la consulta. Actualiza el resumen.');
                $seen[$sale['sale_id']] = true;
                if (filter_var($sale['deleted'] ?? false, FILTER_VALIDATE_BOOLEAN)
                    || (int) ($sale['suspended'] ?? 0) !== 0
                    || filter_var($sale['store_account_payment'] ?? false, FILTER_VALIDATE_BOOLEAN)
                    || ($sale['mode'] ?? '') === 'store_account_payment') continue;
                if (!isset($sale['total']) || !isset($sale['payments']) || !is_array($sale['payments'])) {
                    throw new RuntimeException('Faltan importes o pagos en una venta. No se puede calcular un resumen completo.');
                }
                $total += $this->cents($sale['total']);
                $count++;
                $ranking?->add($sale);
                $recordPayments = [];
                $paymentNames = [];
                foreach ($sale['payments'] as $payment) {
                    if (!isset($payment['payment_type'], $payment['payment_amount'])) throw new RuntimeException('La respuesta contiene pagos incompletos.');
                    $name = trim($payment['payment_type']);
                    $type = match (Str::lower(Str::ascii($name))) {
                        'efectivo', 'cash' => 'cash',
                        'transferencia', 'transfer', 'bank transfer', 'consignacion' => 'transfer',
                        'nequi' => 'nequi',
                        'linea de credito', 'store account', 'credito' => 'credit',
                        default => 'other',
                    };
                    $amount = $this->cents($payment['payment_amount']);
                    $totals[$type] += $amount;
                    $recordPayments[$type] = ($recordPayments[$type] ?? 0) + $amount;
                    $paymentNames[] = $name;
                    if ($type === 'other') $other[$name] = ($other[$name] ?? 0) + $amount;
                }
                $records[] = [
                    'id' => $sale['sale_id'],
                    'date' => $sale['sale_time'] ?? '',
                    'customer' => trim(($sale['customer_first_name'] ?? '').' '.($sale['customer_last_name'] ?? '')) ?: 'Cliente general',
                    'total' => $this->cents($sale['total']) / 100,
                    'payments' => array_map(fn ($amount) => $amount / 100, $recordPayments),
                    'payment_names' => array_values(array_unique($paymentNames)),
                ];
            }
            $offset += count($sales);
            $recordCount = $response->header('x-total-records');
            if ($recordCount !== '' && ctype_digit($recordCount)) {
                if ($offset >= (int) $recordCount) { $complete = true; break; }
                if (!$sales) throw new RuntimeException('La API devolvió un listado incompleto. Actualiza el resumen.');
            } elseif (count($sales) < 1000) { $complete = true; break; }
        }
        if (!$complete) throw new RuntimeException('El volumen de ventas supera el límite de consulta. No se muestran totales parciales.');
        return [
            'date' => $date, 'start_date' => $date, 'end_date' => $endDate,
            'currency' => 'COP', 'timezone' => 'America/Bogota',
            'total' => $total / 100, 'sale_count' => $count,
            'payments' => array_map(fn ($amount) => $amount / 100, $totals),
            'other_methods' => array_map(fn ($amount) => $amount / 100, $other),
            'payment_difference' => ($total - array_sum($totals)) / 100,
            'records' => $records,
            'updated_at' => now('America/Bogota')->toIso8601String(),
            ...($ranking ? ['ranking' => $ranking->result()] : []),
        ];
    }

    private function cents(mixed $amount): int
    {
        if (!is_numeric($amount) || !is_finite((float) $amount)) throw new RuntimeException('La API devolvió un importe inválido.');
        return (int) round((float) $amount * 100);
    }
}
