<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PointOfSaleSalesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        foreach (array_keys(config('points_of_sale')) as $point) config(["points_of_sale.$point.api_key" => 'private-test-key']);
    }

    private function admin(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true])->save();
        $this->actingAs($user);
    }

    private function sale(int $id, string $total, array $payments, array $extra = []): array
    {
        return array_merge(['sale_id' => $id, 'total' => $total, 'payments' => array_map(
            fn ($type, $amount) => ['payment_type' => $type, 'payment_amount' => $amount], array_keys($payments), array_values($payments)
        ), 'deleted' => false, 'suspended' => '0', 'store_account_payment' => false], $extra);
    }

    public function test_permissions_and_input_validation_do_not_contact_external_api(): void
    {
        Http::fake();
        $this->getJson('/api/points-of-sale/bodega/sales')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/points-of-sale/bodega/sales')->assertForbidden();
        $this->admin();
        $this->getJson('/api/points-of-sale/unknown/sales')->assertNotFound();
        $this->getJson('/api/points-of-sale/bodega/sales?date=invalid')->assertUnprocessable();
        $this->getJson('/api/points-of-sale/bodega/sales?date=2999-01-01')->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_paginated_split_payments_returns_exclusions_and_cache(): void
    {
        $this->admin();
        Http::fakeSequence()->push([
            $this->sale(1, '100.10', ['Efectivo' => '40.10', 'NEQUI' => '60']),
            $this->sale(2, '20.20', ['CONSIGNACIÓN' => '20.20']),
            $this->sale(3, '500', ['Efectivo' => '500'], ['store_account_payment' => true]),
            $this->sale(4, '500', ['Efectivo' => '500'], ['suspended' => '2']),
            $this->sale(5, '500', ['Efectivo' => '500'], ['deleted' => true]),
        ], 200, ['x-total-records' => '8'])->push([
            $this->sale(6, '30', ['Línea de crédito' => '30']),
            $this->sale(7, '-10', ['Efectivo' => '-10']),
            $this->sale(8, '5', ['Tarjeta regalo' => '5']),
        ], 200, ['x-total-records' => '8']);
        $response = $this->getJson('/api/points-of-sale/bodega/sales?date=2026-01-01')->assertOk()
            ->assertJsonPath('data.total', 145.3)->assertJsonPath('data.sale_count', 5)
            ->assertJsonPath('data.payments.cash', 30.1)->assertJsonPath('data.payments.transfer', 20.2)
            ->assertJsonPath('data.payments.nequi', 60)->assertJsonPath('data.payments.credit', 30)
            ->assertJsonPath('data.payments.other', 5)->assertJsonPath('data.payment_difference', 0);
        $response->assertDontSee('private-test-key');
        Http::assertSent(fn ($request) => $request->hasHeader('x-api-key', 'private-test-key')
            && $request['start_date'] === '2026-01-01 00:00:00' && $request['end_date'] === '2026-01-01 23:59:59'
            && $request['offset'] === 5);
        $this->getJson('/api/points-of-sale/bodega/sales?date=2026-01-01')->assertOk();
        Http::assertSentCount(2);
    }

    public function test_empty_sales_and_separate_point_configuration(): void
    {
        $this->admin();
        Http::fake(['*' => Http::response([], 200, ['x-total-records' => '0'])]);
        foreach (array_keys(config('points_of_sale')) as $point) {
            $this->getJson("/api/points-of-sale/$point/sales?date=2026-01-01")
                ->assertOk()->assertJsonPath('data.point', $point)->assertJsonPath('data.total', 0);
            Http::assertSent(fn ($request) => str_starts_with($request->url(), "https://sp831.com/$point/index.php/api/v1/sales"));
        }
        Http::assertSentCount(5);
    }

    public function test_errors_do_not_leak_response_or_display_partial_totals(): void
    {
        $this->admin();
        Http::fakeSequence()->push(['error' => 'private-test-key'], 403)
            ->push(['unexpected' => true], 200)
            ->push([$this->sale(1, 'invalid', ['Efectivo' => '1'])], 200)
            ->push([$this->sale(2, '10', ['Efectivo' => '10'])], 200, ['x-total-records' => '2'])
            ->push([], 200, ['x-total-records' => '2']);
        for ($i = 0; $i < 4; $i++) {
            $this->getJson('/api/points-of-sale/bodega/sales?date=2026-01-01')
                ->assertStatus(502)->assertJsonMissingPath('data.total')->assertDontSee('private-test-key');
        }
    }

    public function test_periods_use_colombia_dates_across_year_and_leap_month_boundaries(): void
    {
        $this->admin();
        Http::fake(['*' => Http::response([], 200, ['x-total-records' => '0'])]);
        $this->travelTo(\Carbon\Carbon::parse('2027-01-01 04:30:00', 'UTC'));
        foreach ([
            'today' => ['2026-12-31', '2026-12-31'],
            'yesterday' => ['2026-12-30', '2026-12-30'],
            'last7' => ['2026-12-25', '2026-12-31'],
            'last30' => ['2026-12-02', '2026-12-31'],
        ] as $period => [$start, $end]) {
            $this->getJson("/api/points-of-sale/bodega/sales?period=$period")->assertOk()
                ->assertJsonPath('data.start_date', $start)->assertJsonPath('data.end_date', $end);
            Http::assertSent(fn ($request) => $request['start_date'] === "$start 00:00:00" && $request['end_date'] === "$end 23:59:59");
        }
        $this->travelTo(\Carbon\Carbon::parse('2027-01-01 05:00:00', 'UTC'));
        $this->getJson('/api/points-of-sale/bodega/sales?period=today')->assertOk()->assertJsonPath('data.start_date', '2027-01-01');
        $this->travelTo(\Carbon\Carbon::parse('2028-03-01 12:00:00', 'America/Bogota'));
        $this->getJson('/api/points-of-sale/bodega/sales?period=last30')->assertOk()
            ->assertJsonPath('data.start_date', '2028-02-01')->assertJsonPath('data.end_date', '2028-03-01');
        $this->travelBack();
    }

    public function test_period_cache_expires_after_sixty_seconds_and_filters_cannot_be_combined(): void
    {
        $this->admin();
        $this->travelTo(\Carbon\Carbon::parse('2026-11-24 12:00:00', 'America/Bogota'));
        Http::fake(['*' => Http::response([
            $this->sale(1, '10', ['Efectivo' => '10']),
            $this->sale(2, '20', ['Nequi' => '20']),
        ], 200, ['x-total-records' => '2'])]);
        $url = '/api/points-of-sale/bodega/sales?period=last7';
        $this->getJson($url)->assertOk()->assertJsonPath('data.total', 30);
        $this->travel(59)->seconds();
        $this->getJson($url)->assertOk();
        Http::assertSentCount(1);
        $this->travel(2)->seconds();
        $this->getJson($url)->assertOk();
        Http::assertSentCount(2);
        $this->getJson('/api/points-of-sale/bodega/sales?period=last30')->assertOk();
        $this->getJson('/api/points-of-sale/villa/sales?period=last7')->assertOk();
        Http::assertSentCount(4);
        $this->getJson('/api/points-of-sale/bodega/sales?period=last7&date=2026-01-01')->assertUnprocessable();
        $this->getJson('/api/points-of-sale/bodega/sales?period=invalid')->assertUnprocessable();
        Http::assertSentCount(4);
        $this->travelBack();
    }

    public function test_records_match_the_summary_and_split_payments_without_new_external_requests(): void
    {
        $this->admin();
        Http::fake(['*' => Http::response([
            $this->sale(1, '100', ['Efectivo' => '40', 'Nequi' => '60'], ['sale_time' => '24-11-2026 10:00 am', 'customer_first_name' => 'Ana', 'customer_email' => 'private@example.com']),
            $this->sale(2, '-10', ['Efectivo' => '-10']),
            $this->sale(3, '10', ['Consignación' => '10']),
            $this->sale(4, '20', ['Efectivo' => '20'], ['suspended' => '2']),
        ], 200, ['x-total-records' => '4'])]);
        $summary = $this->getJson('/api/points-of-sale/bodega/sales?date=2026-01-01')->assertOk()
            ->assertJsonMissingPath('data.records');
        $snapshot = $summary->json('data.snapshot_id');
        $url = "/api/points-of-sale/bodega/sales/records?snapshot=$snapshot";
        $this->getJson($url.'&method=all')->assertOk()->assertJsonPath('total', 3)->assertJsonPath('amount', 100)
            ->assertJsonPath('data.0.customer', 'Ana')->assertDontSee('private@example.com')->assertDontSee('private-test-key');
        $this->getJson($url.'&method=cash')->assertOk()->assertJsonPath('total', 2)->assertJsonPath('amount', 30)
            ->assertJsonPath('data.0.amount', 40)->assertJsonPath('data.0.total', 100)->assertJsonPath('data.1.amount', -10);
        $this->getJson($url.'&method=transfer')->assertOk()->assertJsonPath('amount', 10)->assertJsonPath('total', 1);
        $this->getJson($url.'&method=credit')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('amount', 0);
        $this->getJson("/api/points-of-sale/villa/sales/records?snapshot=$snapshot&method=all")->assertStatus(410);
        $this->getJson($url.'&method=invalid')->assertUnprocessable();
        $this->getJson($url.'&method=all&page=0')->assertUnprocessable();
        $this->travel(16)->minutes();
        $this->getJson($url.'&method=all')->assertStatus(410);
        $this->travelBack();
        Http::assertSentCount(1);
    }

    public function test_records_require_admin_and_paginate_cached_snapshot(): void
    {
        Http::fake(['*' => Http::response(array_map(fn ($id) => $this->sale($id, '10', ['Efectivo' => '10']), range(1, 25)), 200)]);
        $this->getJson('/api/points-of-sale/bodega/sales/records')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/points-of-sale/bodega/sales/records')->assertForbidden();
        $this->admin();
        $snapshot = $this->getJson('/api/points-of-sale/bodega/sales?date=2026-01-01')->assertOk()->json('data.snapshot_id');
        $url = "/api/points-of-sale/bodega/sales/records?snapshot=$snapshot&method=cash";
        $this->getJson($url)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('total', 25)->assertJsonPath('last_page', 2)->assertJsonPath('amount', 250);
        $this->getJson($url.'&page=2')->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('data.0.id', 21)->assertJsonPath('amount', 250);
        Http::assertSentCount(1);
    }
}
