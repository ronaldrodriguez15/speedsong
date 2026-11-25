<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PointOfSaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_administrators_can_read_configuration_status(): void
    {
        $this->getJson('/api/points-of-sale')->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->getJson('/api/points-of-sale')->assertForbidden();
    }

    public function test_five_points_report_configuration_without_exposing_keys_or_making_requests(): void
    {
        Http::fake();
        $points = config('points_of_sale');
        $this->assertSame(['bodega', 'villa', 'local', 'bmanga', 'cucuta'], array_keys($points));
        foreach ($points as $id => $point) {
            config(["points_of_sale.$id.api_key" => 'private-test-key']);
        }
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $response = $this->actingAs($admin)->getJson('/api/points-of-sale')
            ->assertOk()->assertJsonCount(5, 'data');
        foreach ($response->json('data') as $point) {
            $this->assertTrue($point['configured']);
            $this->assertTrue($point['consumption_enabled']);
            $this->assertFalse($point['connection_verified']);
            $this->assertArrayNotHasKey('api_key', $point);
            $this->assertArrayNotHasKey('url', $point);
        }
        $response->assertDontSee('private-test-key');
        Http::assertNothingSent();
    }

    public function test_missing_key_and_invalid_url_are_reported_as_unconfigured(): void
    {
        Http::fake();
        config([
            'points_of_sale.bodega.api_key' => '',
            'points_of_sale.villa.api_key' => 'test-key',
            'points_of_sale.villa.url' => 'http://sp831.com/villa',
        ]);
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin)->getJson('/api/points-of-sale')
            ->assertOk()
            ->assertJsonPath('data.0.configured', false)
            ->assertJsonPath('data.1.configured', false);
        Http::assertNothingSent();
    }
}
