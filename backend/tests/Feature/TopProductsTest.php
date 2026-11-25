<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TopProductsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp(); Cache::flush(); Http::preventStrayRequests();
        foreach (array_keys(config('points_of_sale')) as $point) config(["points_of_sale.$point.api_key" => 'secret-test-key']);
    }
    private function sale(int $id, array $items, array $extra = []): array
    {
        return [...['sale_id' => $id, 'total' => '100', 'payments' => [], 'cart_items' => $items, 'deleted' => false, 'suspended' => '0', 'store_account_payment' => false], ...$extra];
    }
    private function item(int $id, mixed $quantity, string $name = 'Producto'): array
    {
        return ['item_id' => $id, 'name' => $name, 'quantity' => $quantity, 'product_id' => "SKU-$id"];
    }
    public function test_authentication_and_period_validation(): void
    {
        Http::fake();
        $this->getJson('/api/points-of-sale/bodega/top-products')->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/points-of-sale/unknown/top-products')->assertNotFound();
        $this->getJson('/api/points-of-sale/bodega/top-products?period=invalid')->assertUnprocessable();
        Http::assertNothingSent();
    }
    public function test_quantities_returns_variants_exclusions_and_cached_pagination(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fakeSequence()->push([
            $this->sale(1, [$this->item(1, 5, 'Zeta'), $this->item(2, 4, 'Alfa'), [...$this->item(1, 2, 'Zeta'), 'variation_id' => 99]]),
            $this->sale(2, [$this->item(3, 100)], ['suspended' => '2']),
            $this->sale(3, [$this->item(3, 100)], ['deleted' => true]),
        ], 200, ['x-total-records' => '6'])->push([
            $this->sale(4, [$this->item(1, -3, 'Zeta')], ['total' => '-100']),
            $this->sale(5, [$this->item(3, 100)], ['store_account_payment' => true]),
            $this->sale(6, [$this->item(3, 1.5, 'Fracción')]),
        ], 200, ['x-total-records' => '6']);
        $url = '/api/points-of-sale/local/top-products?period=last7';
        $this->getJson($url)->assertOk()->assertJsonPath('data.products.0.id', 'item:2')->assertJsonPath('data.products.0.units', 4)
            ->assertJsonPath('data.products.1.id', 'item:1')->assertJsonPath('data.products.1.units', 4)
            ->assertJsonPath('data.products.2.units', 1.5)->assertJsonPath('data.product_count', 3)->assertJsonPath('data.sale_count', 3)
            ->assertJsonPath('data.top_units', 9.5)->assertDontSee('secret-test-key');
        $this->getJson($url)->assertOk();
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => $request['offset'] === 3);
    }
    public function test_top_ten_and_kits_are_distinct_from_regular_products(): void
    {
        $this->actingAs(User::factory()->create());
        $items = array_map(fn ($id) => $this->item($id, $id), range(1, 12));
        $items[] = ['item_kit_id' => 12, 'name' => 'Kit', 'quantity' => 50];
        Http::fake(['*' => Http::response([$this->sale(1, $items)], 200, ['x-total-records' => '1'])]);
        $this->getJson('/api/points-of-sale/bodega/top-products')->assertOk()->assertJsonCount(10, 'data.products')
            ->assertJsonPath('data.product_count', 13)->assertJsonPath('data.products.0.id', 'kit:12')->assertJsonPath('data.products.1.id', 'item:12')->assertJsonPath('data.products.9.rank', 10);
    }
    public function test_empty_or_refunded_products_and_invalid_details(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fakeSequence()->push([$this->sale(1, [$this->item(1, -2)])], 200)
            ->push([$this->sale(1, [$this->item(1, 'not-numeric')])], 200)
            ->push([$this->sale(1, [])], 200)->push([], 200);
        $this->getJson('/api/points-of-sale/bodega/top-products')->assertOk()->assertJsonCount(0, 'data.products');
        $this->getJson('/api/points-of-sale/local/top-products')->assertStatus(502)->assertJsonMissingPath('data');
        $this->getJson('/api/points-of-sale/local/top-products')->assertStatus(502)->assertJsonMissingPath('data');
        $this->getJson('/api/points-of-sale/villa/top-products')->assertOk()->assertJsonPath('data.product_count', 0);
    }
    public function test_periods_and_sedes_are_isolated(): void
    {
        $this->actingAs(User::factory()->create());
        $this->travelTo(\Carbon\Carbon::parse('2026-11-25 04:00:00', 'UTC'));
        Http::fake(['*' => Http::response([], 200)]);
        foreach (['today' => '2026-11-24', 'yesterday' => '2026-11-23', 'last7' => '2026-11-18', 'last30' => '2026-10-26'] as $period => $start) {
            $this->getJson("/api/points-of-sale/bodega/top-products?period=$period")->assertOk()->assertJsonPath('data.start_date', $start);
        }
        foreach (['villa', 'local', 'bmanga', 'cucuta'] as $point) $this->getJson("/api/points-of-sale/$point/top-products?period=today")->assertOk()->assertJsonPath('data.point', $point);
        Http::assertSentCount(8); $this->travelBack();
    }
}
