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
    private function paged($request, array $items)
    {
        $field = $request['sort_col'] ?? 'product_id';
        usort($items, fn ($a, $b) => strcasecmp((string) ($a[$field] ?? ''), (string) ($b[$field] ?? '')) ?: $a['item_id'] <=> $b['item_id']);
        return Http::response(array_slice($items, (int) $request['offset'], (int) $request['limit']), 200, ['x-total-records' => (string) count($items)]);
    }
    public function test_authentication_and_validation(): void
    {
        $this->getJson('/api/inventory?field=product_id')->assertUnauthorized();
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]))->getJson('/api/inventory?field=item_id')->assertUnprocessable();
        Http::assertNothingSent();
    }
    public function test_matching_references_not_local_ids_pagination_and_cache(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(function ($request) {
            $id = str_contains($request->url(), '/villa/') ? 99 : 1;
            $offset = (int) ($request['offset'] ?? 0);
            return Http::response([['item_id' => $id + $offset, 'name' => 'Product', 'product_id' => $offset ? 'SG 129C' : null, 'locations' => ['1' => ['quantity' => 10], '2' => ['quantity' => -1.5]]]], 200, ['x-total-records' => '2']);
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
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn ($r) => str_contains($r->url(), '/villa/') ? Http::response([], 500) : Http::response([], 200));
        $this->getJson('/api/inventory?field=product_id&search=SG')->assertStatus(502)->assertJsonMissingPath('data.rows');
    }
    public function test_barcode_and_missing_quantity(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn () => Http::response([['item_id' => 1, 'name' => 'Product', 'item_number' => '00123', 'locations' => ['1' => ['quantity' => '2.5']]]], 200));
        $this->getJson('/api/inventory?field=item_number&search=00123')->assertOk()->assertJsonPath('data.rows.0.reference', '00123')->assertJsonPath('data.rows.0.total', 12.5);
        Http::assertSent(fn ($r) => $r['search_field'] === 'item_number' && $r['search'] === '00123');
    }
    public function test_missing_quantities_are_rejected(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn () => Http::response([['item_id' => 1, 'name' => 'Product', 'locations' => []]], 200));
        $this->getJson('/api/inventory?field=product_id')->assertStatus(502);
    }
    public function test_empty_search_lists_only_selected_store_and_keeps_individual_products(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
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
    public function test_hidden_records_are_filtered_before_pagination_and_export(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        $items = array_map(fn ($id) => ['item_id' => $id, 'name' => 'Product', 'product_id' => "SKU $id", 'locations' => ['1' => ['quantity' => 2]]], range(1, 26));
        $items[] = ['item_id' => 27, 'name' => ' Ninguno ', 'product_id' => 'OTHER'];
        $items[] = ['item_id' => 28, 'name' => 'Placeholder', 'product_id' => 'NINGUNO'];
        $items[] = ['item_id' => 29, 'name' => '', 'product_id' => null, 'category' => 'Ninguno'];
        $items[] = ['item_id' => 30, 'name' => "\u{00a0}\u{200b}", 'product_id' => '', 'category' => 'Ninguno'];
        $items[] = ['item_id' => 31, 'name' => '<span>&nbsp;</span>', 'category' => 'Ninguno'];
        Http::fake(fn ($request) => $this->paged($request, $items));
        foreach (['', 'SKU', 'SKU, OTHER'] as $search) {
            foreach (['villa', 'all'] as $point) {
                $query = http_build_query(['field' => 'product_id', 'point' => $point, 'search' => $search]);
                $this->getJson('/api/inventory?'.$query)->assertOk()->assertJsonPath('data.total', null)->assertJsonCount(10, 'data.rows')->assertDontSee('Placeholder')->assertDontSee('Ninguno');
                $this->getJson('/api/inventory?'.$query.'&page=3')->assertOk()->assertJsonCount(6, 'data.rows')->assertJsonPath('data.total', 26);
                $this->getJson('/api/inventory?'.$query.'&export=1')->assertOk()->assertJsonCount(26, 'data.rows');
            }
        }
    }
    public function test_unreported_quantity_is_not_treated_as_zero(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn () => Http::response([['item_id' => 1, 'name' => 'Product', 'product_id' => 'SG', 'locations' => ['1' => ['quantity' => null]]]], 200));
        $this->getJson('/api/inventory?field=product_id')->assertOk()->assertJsonPath('data.rows.0.total', null)->assertJsonPath('data.rows.0.quantities.bodega', null);
    }
    public function test_consolidated_pages_use_cached_complete_totals_and_export_all_rows(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn ($request) => $this->paged($request, array_map(fn ($n) => ['item_id' => $n, 'name' => "Product $n", 'product_id' => "SKU $n", 'locations' => ['1' => ['quantity' => 2]]], range(1, 30))));
        $this->getJson('/api/inventory?field=product_id')->assertOk()->assertJsonCount(10, 'data.rows')->assertJsonPath('data.total', null)->assertJsonPath('data.rows.0.total', 10);
        $this->getJson('/api/inventory?field=product_id&page=2')->assertOk()->assertJsonCount(10, 'data.rows');
        $this->getJson('/api/inventory?field=product_id&export=1')->assertOk()->assertJsonCount(30, 'data.rows');
        Http::assertSentCount(20);
    }

    public function test_multiple_references_merge_overlapping_results_without_double_counting(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(function ($request) {
            $ids = $request['search'] === 'SG' ? range(1, 30) : [1];
            return $this->paged($request, array_map(fn ($id) => ['item_id' => $id, 'name' => "Product $id", 'product_id' => "SG $id", 'locations' => ['1' => ['quantity' => 2]]], $ids));
        });
        $query = http_build_query(['field' => 'product_id', 'search' => "SG, SG 1\nsg; SG 1"]);
        $this->getJson('/api/inventory?'.$query)->assertOk()->assertJsonPath('data.total', null)
            ->assertJsonPath('data.search', 'SG, SG 1')->assertJsonPath('data.rows.0.total', 10)->assertJsonCount(10, 'data.rows');
        $this->getJson('/api/inventory?'.$query.'&page=2')->assertOk()->assertJsonCount(10, 'data.rows');
        $this->getJson('/api/inventory?'.$query.'&export=1')->assertOk()->assertJsonCount(30, 'data.rows');
        Http::assertSentCount(30);
        $this->getJson('/api/inventory?'.$query.'&point=bodega')->assertOk()->assertJsonPath('data.total', null)->assertJsonPath('data.rows.0.total', 2);
        $this->getJson('/api/inventory?'.$query.'&point=bodega&page=2')->assertOk()->assertJsonCount(10, 'data.rows');
        $this->getJson('/api/inventory?'.$query.'&point=bodega&export=1')->assertOk()->assertJsonCount(30, 'data.rows');
        Http::assertSentCount(36);
    }

    public function test_multiple_barcodes_preserve_leading_zeroes_and_reject_oversized_lists(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn ($request) => Http::response([['item_id' => $request['search'], 'name' => 'Product', 'item_number' => $request['search'], 'locations' => ['1' => ['quantity' => 1]]]], 200, ['x-total-records' => '1']));
        $this->getJson('/api/inventory?field=item_number&point=local&search=00123,00456')->assertOk()->assertJsonCount(2, 'data.rows')->assertJsonPath('data.rows.0.reference', '00123');
        Http::assertSent(fn ($request) => $request['search'] === '00456' && $request['search_field'] === 'item_number');
        $this->getJson('/api/inventory?'.http_build_query(['field' => 'product_id', 'search' => implode(',', range(1, 21))]))->assertUnprocessable();
        $this->getJson('/api/inventory?'.http_build_query(['field' => 'product_id', 'search' => str_repeat('A', 101)]))->assertUnprocessable();
        Http::assertSentCount(2);
    }

    public function test_failure_of_one_reference_does_not_return_partial_results(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        Http::fake(fn ($request) => $request['search'] === 'B' ? Http::response([], 503) : Http::response([], 200));
        $this->getJson('/api/inventory?field=product_id&point=local&search=A,B')->assertStatus(502)->assertJsonMissingPath('data');
    }

    public function test_first_page_reads_small_blocks_and_cached_pages_make_no_requests(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        $items = array_map(fn ($id) => ['item_id' => $id, 'name' => "Product $id", 'product_id' => sprintf('SKU %04d', $id), 'locations' => ['1' => ['quantity' => 2]]], range(1, 1000));
        Http::fake(fn ($request) => $this->paged($request, $items));
        $url = '/api/inventory?field=product_id';
        $first = $this->getJson($url)->assertOk()->assertJsonCount(10, 'data.rows')->assertJsonPath('data.has_more', true)
            ->assertJsonPath('data.total', null)->assertJsonPath('data.rows.0.total', 10)->json('data.rows');
        Http::assertSentCount(10);
        Http::assertNotSent(fn ($request) => $request['limit'] !== 10 || $request['offset'] > 10);
        $this->getJson($url)->assertOk()->assertJsonPath('data.rows', $first);
        Http::assertSentCount(10);
        $this->getJson($url.'&page=2')->assertOk()->assertJsonCount(10, 'data.rows')->assertJsonPath('data.rows.0.reference', 'SKU 0011');
        Http::assertSentCount(15);
        $this->getJson($url)->assertOk()->assertJsonPath('data.rows', $first);
        Http::assertSentCount(15);
    }

    public function test_reference_totals_include_duplicates_across_remote_page_boundaries(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => array_keys(config('points_of_sale'))]));
        $items = array_map(fn ($id) => ['item_id' => $id, 'name' => 'Product', 'product_id' => $id <= 12 ? 'A' : 'B', 'locations' => ['1' => ['quantity' => 1]]], range(1, 13));
        Http::fake(fn ($request) => $this->paged($request, $items));
        $this->getJson('/api/inventory?field=product_id')->assertOk()->assertJsonCount(2, 'data.rows')
            ->assertJsonPath('data.rows.0.total', 60)->assertJsonPath('data.rows.1.total', 5)->assertJsonPath('data.has_more', false)->assertJsonPath('data.total', 2);
    }
}
