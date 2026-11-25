<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class PointOfSaleReceivables
{
    private int $requests = 0;
    private float $started;

    public function overdue(array $point): array
    {
        $this->started = microtime(true);
        $this->requests = 0;
        $today = CarbonImmutable::now('America/Bogota')->startOfDay();
        $credits = [];
        $seen = [];
        $offset = 0;
        $complete = false;
        for ($page = 0; $page < 40; $page++) {
            $response = $this->get($point, 'reports/store_account_outstanding', ['show_paid' => 0, 'limit' => 500, 'offset' => $offset]);
            $rows = $response->json('data.rows');
            if (!is_array($rows) || !array_is_list($rows)) throw new RuntimeException('El reporte de cartera no tiene el formato esperado.');
            foreach ($rows as $row) {
                $fields = [];
                foreach ($row as $name => $value) $fields[$this->normalize($name)] = $this->clean($value);
                $reference = $fields['serie y numero'] ?? $fields['sale id'] ?? '';
                if (!preg_match('/(\d+)\s*$/', $reference, $match)) throw new RuntimeException('No se pudo identificar una venta del reporte de cartera.');
                $saleId = $match[1];
                if (isset($seen[$saleId])) throw new RuntimeException('El reporte cambió durante la consulta. Actualiza la cartera.');
                $seen[$saleId] = true;
                $amount = $fields['cargo total'] ?? $fields['total charge'] ?? null;
                if (!is_numeric($amount) || !is_finite((float) $amount)) throw new RuntimeException('El reporte contiene un saldo inválido.');
                $cents = (int) round((float) $amount * 100);
                if ($cents <= 0) continue;
                $date = $this->date($fields['fecha de venta'] ?? $fields['sale date'] ?? $fields['fecha'] ?? $fields['date'] ?? '');
                $days = (int) $date->diffInDays($today, false);
                if ($days <= 60) continue;
                $name = $fields['nombre del cliente'] ?? $fields['customer name'] ?? '';
                if ($name === '') throw new RuntimeException('Un crédito pendiente no identifica al cliente.');
                $credits[] = ['sale_id' => $saleId, 'reference' => $reference, 'name' => $name,
                    'sale_date' => $date->toDateString(), 'age_days' => $days, 'cents' => $cents,
                    'comment' => $fields['comentario'] ?? $fields['comment'] ?? ''];
            }
            $offset += count($rows);
            $limit = (int) ($response->json('limit') ?? 500);
            if ($limit <= 0) throw new RuntimeException('El reporte devolvió una paginación inválida.');
            if (count($rows) < $limit) { $complete = true; break; }
        }
        if (!$complete) throw new RuntimeException('La cartera supera el límite de consulta. No se muestran resultados parciales.');
        $customers = [];
        if ($credits) {
            $fingerprint = hash('sha256', $point['url'].$point['api_key']);
            $directory = Cache::remember("pos-credit-customers:$fingerprint", 600, fn () => $this->directory($point));
            foreach ($credits as $credit) {
                $candidates = $directory[$this->normalize($credit['name'])] ?? [];
                if (count($candidates) === 1) {
                    $customerId = (string) $candidates[0];
                } else {
                    // Never merge different customers merely because their names match.
                    $sale = $this->get($point, 'sales/'.$credit['sale_id'])->json();
                    if (!isset($sale['sale_id'], $sale['customer_id']) || (string) $sale['sale_id'] !== $credit['sale_id'] || !ctype_digit((string) $sale['customer_id'])) {
                        throw new RuntimeException('No se pudo confirmar el cliente de un crédito. Actualiza la cartera.');
                    }
                    $customerId = (string) $sale['customer_id'];
                }
                if (!isset($customers[$customerId])) $customers[$customerId] = ['id' => $customerId, 'name' => $credit['name'], 'sale_count' => 0, 'cents' => 0, 'credits' => []];
                $customers[$customerId]['sale_count']++;
                $customers[$customerId]['cents'] += $credit['cents'];
                $customers[$customerId]['credits'][] = [
                    'id' => $credit['sale_id'], 'reference' => $credit['reference'], 'sale_date' => $credit['sale_date'],
                    'age_days' => $credit['age_days'], 'amount' => $credit['cents'] / 100, 'comment' => $credit['comment'],
                ];
            }
        }
        $total = array_sum(array_column($customers, 'cents'));
        foreach ($customers as &$customer) {
            $customer['amount'] = $customer['cents'] / 100;
            unset($customer['cents']);
            usort($customer['credits'], fn ($a, $b) => [$a['sale_date'], $a['id']] <=> [$b['sale_date'], $b['id']]);
        }
        unset($customer);
        uasort($customers, fn ($a, $b) => $b['amount'] <=> $a['amount'] ?: strcmp($a['name'], $b['name']));
        return ['customers' => array_values($customers), 'customer_count' => count($customers),
            'sale_count' => count($credits), 'amount' => $total / 100, 'as_of' => $today->toDateString(),
            'updated_at' => CarbonImmutable::now('America/Bogota')->toIso8601String()];
    }

    private function directory(array $point): array
    {
        $directory = [];
        $seen = [];
        $offset = 0;
        for ($page = 0; $page < 40; $page++) {
            $response = $this->get($point, 'customers', ['limit' => 100, 'offset' => $offset]);
            $rows = $response->json();
            if (!is_array($rows) || !array_is_list($rows)) throw new RuntimeException('No se pudo leer el directorio de clientes.');
            foreach ($rows as $row) {
                if (!isset($row['person_id']) || isset($seen[$row['person_id']])) throw new RuntimeException('El directorio de clientes está incompleto o cambió durante la consulta.');
                $seen[$row['person_id']] = true;
                $name = $this->normalize(trim(($row['first_name'] ?? '').' '.($row['last_name'] ?? '')));
                $directory[$name][] = $row['person_id'];
            }
            $offset += count($rows);
            $total = $response->header('x-total-records');
            if ($total !== '' && ctype_digit($total)) {
                if ($offset >= (int) $total) return $directory;
                if (!$rows) throw new RuntimeException('El directorio de clientes está incompleto.');
            } elseif (count($rows) < 100) return $directory;
        }
        throw new RuntimeException('El directorio supera el límite de consulta.');
    }

    private function get(array $point, string $path, array $query = []): Response
    {
        if (++$this->requests > 45 || microtime(true) - $this->started > 45) throw new RuntimeException('La consulta está tardando demasiado. Intenta nuevamente en un minuto.');
        $response = Http::acceptJson()->withHeaders(['x-api-key' => $point['api_key']])->connectTimeout(5)->timeout(12)
            ->withOptions(['verify' => config('pos.ca_bundle') ?: true, 'allow_redirects' => false])
            ->get(rtrim($point['url'], '/').'/index.php/api/v1/'.$path, $query);
        if ($response->status() === 404 && $path === 'reports/store_account_outstanding') {
            throw new RuntimeException('Esta sede aún no ofrece el reporte de créditos pendientes. Debe habilitarse o actualizarse su API para consultar la cartera.', 501);
        }
        if (!$response->successful()) throw new RuntimeException(in_array($response->status(), [401, 403])
            ? 'La sede rechazó la consulta de cartera. Revisa los permisos de la API o reintenta en un minuto.'
            : 'No fue posible obtener la cartera del punto de venta. Intenta nuevamente.');
        return $response;
    }

    private function clean(mixed $value): string
    {
        if (!is_scalar($value) && $value !== null) throw new RuntimeException('El reporte contiene un campo inválido.');
        return trim(html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    private function normalize(string $value): string
    {
        return Str::lower(Str::ascii(preg_replace('/\s+/u', ' ', $this->clean($value))));
    }

    private function date(string $value): CarbonImmutable
    {
        $value = explode(' ', $value)[0];
        foreach (['Y-m-d', 'd-m-Y', 'm/d/Y'] as $format) {
            try {
                $date = CarbonImmutable::createFromFormat('!'.$format, $value, 'America/Bogota');
                if ($date && $date->format($format) === $value) return $date;
            } catch (\Throwable $e) { /* Try the next known POS date format. */ }
        }
        throw new RuntimeException('No se pudo verificar la fecha de un crédito pendiente.');
    }
}
