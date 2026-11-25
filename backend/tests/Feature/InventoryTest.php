<?php
namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp(): void
    {
        parent::setUp(); Cache::flush(); Http::preventStrayRequests();
        foreach (array_keys(config('points_of_sale')) as $id) config(["points_of_sale.$id.api_key" => 'test']);
    }
    public function test_authentication_and_validation(): void
    {
        $this->getJson('/api/inventory?field=product_id')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/inventory?field=item_id')->assertUnprocessable();
        Http::assertNothingSent();
    }
    public function test_matching_references_not_local_ids_pagination_and_cache(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(function ($request) {
            $id = str_contains($request->url(), '/villa/') ? 99 : 1;
            $offset = (int) ($request['offset'] ?? 0);
            return Http::response([['item_id' => $id + $offset, 'name' => 'Product', 'product_id' => $offset ? null : 'SG 129C', 'locations' => ['1' => ['quantity' => 10], '2' => ['quantity' => -1.5]]]], 200, ['x-total-records' => '2']);
        });
        $response = $this->getJson('/api/inventory?field=product_id')->assertOk();
        $rows = collect($response->json('data.rows'));
        $this->assertCount(6, $rows);
        $this->assertEquals(42.5, $rows->firstWhere('reference', 'SG 129C')['total']);
        $this->assertEquals(8.5, $rows->firstWhere('reference', 'SG 129C')['quantities']['villa']);
        Http::assertSentCount(10);
        $this->getJson('/api/inventory?field=product_id')->assertOk();
        Http::assertSentCount(10);
    }
    public function test_failed_store_never_yields_partial_totals(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn ($r) => str_contains($r->url(), '/villa/') ? Http::response([], 500) : Http::response([], 200));
        $this->getJson('/api/inventory?field=product_id&search=SG')->assertStatus(502)->assertJsonMissingPath('data.rows');
    }
    public function test_barcode_and_missing_quantity(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response([['item_id' => 1, 'name' => 'Product', 'item_number' => '00123', 'locations' => ['1' => ['quantity' => '2.5']]]], 200));
        $this->getJson('/api/inventory?field=item_number&search=00123')->assertOk()->assertJsonPath('data.rows.0.reference', '00123')->assertJsonPath('data.rows.0.total', 12.5);
        Http::assertSent(fn ($r) => $r['search_field'] === 'item_number' && $r['search'] === '00123');
    }
    public function test_missing_quantities_are_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response([['item_id' => 1, 'name' => 'Product', 'locations' => []]], 200));
        $this->getJson('/api/inventory?field=product_id')->assertStatus(502);
    }
    public function test_empty_search_lists_only_selected_store_and_keeps_individual_products(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response([
            ['item_id' => 1, 'name' => 'First', 'product_id' => 'SAME', 'locations' => ['1' => ['quantity' => 3]]],
            ['item_id' => 2, 'name' => 'Second', 'product_id' => 'SAME', 'locations' => ['1' => ['quantity' => 4]]],
        ], 200, ['x-total-records' => '2']));
        $this->getJson('/api/inventory?field=product_id&point=bmanga&search=')->assertOk()
            ->assertJsonCount(2, 'data.rows')->assertJsonCount(1, 'data.points')
            ->assertJsonPath('data.points.0.id', 'bmanga')->assertJsonPath('data.rows.0.total', 3);
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/bmanga/') && $r['search'] === '');
        $this->getJson('/api/inventory?field=product_id&point=invalid')->assertUnprocessable();
        $this->getJson('/api/inventory?field=product_id&point=villa')->assertOk()->assertJsonPath('data.points.0.id', 'villa');
        Http::assertSentCount(2);
    }
    public function test_remote_pagination_fetches_only_requested_page(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response([['item_id' => 26, 'name' => 'Product', 'category' => 'Audio', 'description' => 'Speaker', 'item_number' => '0123', 'product_id' => 'SG', 'locations' => ['1' => ['quantity' => 4]]]], 200, ['x-total-records' => '2000']));
        $this->getJson('/api/inventory?field=product_id&point=villa&page=2')->assertOk()
            ->assertJsonPath('data.total', 2000)->assertJsonPath('data.last_page', 80)->assertJsonPath('data.rows.0.category', 'Audio');
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r['limit'] === 25 && $r['offset'] === 25);
    }
    public function test_unreported_quantity_is_not_treated_as_zero(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response([['item_id' => 1, 'name' => 'Product', 'product_id' => 'SG', 'locations' => ['1' => ['quantity' => null]]]], 200));
        $this->getJson('/api/inventory?field=product_id')->assertOk()->assertJsonPath('data.rows.0.total', null)->assertJsonPath('data.rows.0.quantities.bodega', null);
    }
    public function test_consolidated_pages_use_cached_complete_totals_and_export_all_rows(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response(array_map(fn ($n) => ['item_id' => $n, 'name' => "Product $n", 'product_id' => "SKU $n", 'locations' => ['1' => ['quantity' => 2]]], range(1, 30)), 200, ['x-total-records' => '30']));
        $this->getJson('/api/inventory?field=product_id')->assertOk()->assertJsonCount(25, 'data.rows')->assertJsonPath('data.total', 30)->assertJsonPath('data.rows.0.total', 10);
        $this->getJson('/api/inventory?field=product_id&page=2')->assertOk()->assertJsonCount(5, 'data.rows');
        $this->getJson('/api/inventory?field=product_id&export=1')->assertOk()->assertJsonCount(30, 'data.rows');
        Http::assertSentCount(5);
    }
}
