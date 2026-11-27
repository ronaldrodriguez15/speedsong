<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PointPermissionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        foreach (array_keys(config('points_of_sale')) as $id) config(["points_of_sale.$id.api_key" => 'test']);
    }

    public function test_permissions_are_saved_validated_and_cleared_for_admins(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $data = ['name' => 'Store user', 'email' => 'stores@example.com', 'password' => 'Password123', 'password_confirmation' => 'Password123', 'is_admin' => false, 'point_ids' => ['bodega', 'villa']];
        $id = $this->postJson('/api/users', $data)->assertCreated()->assertJsonPath('point_ids', ['bodega', 'villa'])->json('id');
        foreach ([[], ['unknown'], ['villa', 'villa']] as $invalid) {
            $this->putJson("/api/users/$id", [...$data, 'point_ids' => $invalid])->assertUnprocessable();
        }
        $this->putJson("/api/users/$id", [...$data, 'point_ids' => ['local']])->assertOk()->assertJsonPath('point_ids', ['local']);
        $this->putJson("/api/users/$id", [...$data, 'is_admin' => true])->assertOk()->assertJsonPath('point_ids', []);
        $this->putJson("/api/users/$id", [...$data, 'point_ids' => ['villa']])->assertOk()->assertJsonPath('point_ids', ['villa']);
    }

    public function test_direct_requests_and_snapshots_cannot_bypass_permissions(): void
    {
        $user = User::factory()->create(['point_ids' => ['bodega', 'villa']]);
        $this->actingAs($user)->getJson('/api/points-of-sale')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.id', 'villa');
        foreach (['sales', 'sales/records', 'receivables', 'receivables/1/credits', 'receivables/1/report', 'top-products'] as $endpoint) {
            $this->getJson('/api/points-of-sale/local/'.$endpoint)->assertForbidden();
        }
        $this->getJson('/api/inventory?field=product_id&point=local')->assertForbidden();
        $this->getJson('/api/inventory?field=product_id&point=local&export=1')->assertForbidden();
        $this->getJson('/api/users')->assertForbidden();
        $this->postJson('/api/users', ['is_admin' => true])->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_aggregates_and_exports_only_request_assigned_points(): void
    {
        $this->actingAs(User::factory()->create(['point_ids' => ['bodega', 'villa']]));
        Http::fake(fn () => Http::response([]));
        foreach (['', '&export=1'] as $export) {
            $this->getJson('/api/inventory?field=product_id'.$export)->assertOk()->assertJsonCount(2, 'data.points');
        }
        $this->getJson('/api/points-of-sale/stores/top-products')->assertOk();
        $this->getJson('/api/points-of-sale/villa/sales')->assertOk();
        Http::assertSent(fn ($request) => str_contains($request->url(), '/villa/'));
        Http::assertNotSent(fn ($request) => !str_contains($request->url(), '/villa/') && !str_contains($request->url(), '/bodega/'));
    }

    public function test_cached_results_do_not_grant_access_after_revocation(): void
    {
        $user = User::factory()->create(['point_ids' => ['villa']]);
        Http::fake(fn () => Http::response([]));
        $this->actingAs($user)->getJson('/api/points-of-sale/villa/sales')->assertOk();
        $user->forceFill(['point_ids' => []])->save();
        $this->getJson('/api/points-of-sale/villa/sales')->assertForbidden();
        $this->getJson('/api/inventory?field=product_id')->assertForbidden();
        $this->getJson('/api/points-of-sale/stores/top-products')->assertForbidden();
    }
}
