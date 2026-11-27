<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TransfersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        foreach (array_keys(config('points_of_sale')) as $point) config(["points_of_sale.$point.api_key" => 'test']);
    }

    public function test_only_admins_can_search_transfer_products(): void
    {
        $url = '/api/transfers/products?point=bodega&search=REF';
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs(User::factory()->create(['point_ids' => ['bodega', 'villa']]))->getJson($url)->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_search_requires_a_reference_and_distinct_valid_points(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        foreach ([['point' => 'bodega', 'other_point' => 'bodega', 'search' => 'REF'],
            ['point' => 'all', 'search' => 'REF'], ['point' => 'bodega', 'search' => ' '],
            ['point' => 'bodega', 'other_point' => 'invalid', 'search' => 'REF'],
            ['point' => 'bodega', 'search' => 'REF;OTHER']] as $query) {
            $this->getJson('/api/transfers/products?'.http_build_query($query))->assertUnprocessable();
        }
        Http::assertNothingSent();
    }

    public function test_search_keeps_each_store_product_identity_and_stock(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        Http::fake(fn ($request) => Http::response([
            ['item_id' => 7, 'product_id' => 'REF', 'name' => 'Producto', 'locations' => ['1' => ['quantity' => str_contains($request->url(), '/bodega/') ? 12 : 3]]],
        ], 200, ['x-total-records' => '1']));
        $this->getJson('/api/transfers/products?point=bodega&other_point=villa&search=REF')->assertOk()
            ->assertJsonPath('data.rows.0.id', 'bodega:7')->assertJsonPath('data.rows.0.total', 12);
        $this->getJson('/api/transfers/products?point=villa&other_point=bodega&search=REF')->assertOk()
            ->assertJsonPath('data.rows.0.id', 'villa:7')->assertJsonPath('data.rows.0.total', 3);
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => $request['search'] === 'REF' && $request['search_field'] === 'product_id');
        Http::assertNotSent(fn ($request) => $request->method() !== 'GET');
    }

    public function test_remote_failure_is_not_reported_as_an_empty_search(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        Http::fake(fn () => Http::response([], 503));
        $this->getJson('/api/transfers/products?point=villa&search=REF')->assertStatus(502)->assertJsonMissingPath('data');
    }
}
