<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReportRateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        foreach (array_keys(config('points_of_sale')) as $point) {
            config(["points_of_sale.$point.api_key" => 'test']);
        }
        Http::fake([
            '*/reports/store_account_outstanding*' => Http::response(['limit' => 500, 'data' => ['rows' => []]]),
            '*' => Http::response([]),
        ]);
    }

    public function test_repeated_consolidated_refreshes_do_not_block_sales(): void
    {
        for ($refresh = 0; $refresh < 5; $refresh++) {
            foreach (array_keys(config('points_of_sale')) as $point) {
                foreach (['sales', 'receivables', 'top-products'] as $report) {
                    $this->getJson("/api/points-of-sale/$point/$report")->assertOk();
                }
            }
        }
        $this->getJson('/api/points-of-sale/villa/sales')->assertOk();
    }

    public function test_limits_remain_active_and_are_isolated_by_store_report_and_user(): void
    {
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/points-of-sale/villa/sales')->assertOk();
        }
        $this->getJson('/api/points-of-sale/villa/sales')->assertStatus(429)->assertHeader('Retry-After');
        $this->getJson('/api/points-of-sale/bodega/sales')->assertOk();
        $this->getJson('/api/points-of-sale/villa/top-products')->assertOk();
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $this->getJson('/api/points-of-sale/villa/sales')->assertOk();
        $this->travel(61)->seconds();
        $this->getJson('/api/points-of-sale/villa/sales')->assertOk();
    }
}
