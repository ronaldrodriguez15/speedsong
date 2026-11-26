<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReceivablesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo(Carbon::parse('2026-11-25 12:00:00', 'America/Bogota'));
        foreach (array_keys(config('points_of_sale')) as $point) config(["points_of_sale.$point.api_key" => 'private-key']);
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        parent::tearDown();
    }

    private function row(int $id, int $age, string $amount = '100.10', string $name = 'Ana Pérez'): array
    {
        return ['Serie y número' => "POS $id", 'Nombre del cliente' => $name,
            'Fecha de venta' => now('America/Bogota')->subDays($age)->format('d-m-Y'),
            'Días desde el cargo' => (string) $age, 'Cargo total' => $amount, 'Comentario' => 'Abono aplicado'];
    }

    private function fake(array $rows): void
    {
        Http::fake([
            '*/reports/store_account_outstanding*' => Http::response(['limit' => 500, 'data' => ['rows' => $rows]]),
            '*/sales/*' => fn ($request) => Http::response(['sale_id' => basename(parse_url($request->url(), PHP_URL_PATH)), 'customer_id' => 7, 'total' => '150.50']),
            '*/customers*' => Http::response([['person_id' => 7, 'first_name' => 'Ana', 'last_name' => 'Pérez', 'email' => 'private@example.com']], 200, ['x-total-records' => '1']),
        ]);
    }

    public function test_authentication_and_invalid_input_do_not_call_remote(): void
    {
        Http::fake();
        $this->getJson('/api/points-of-sale/bodega/receivables')->assertUnauthorized();
        $this->getJson('/api/points-of-sale/bodega/receivables/7/credits')->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/points-of-sale/unknown/receivables')->assertNotFound();
        $this->getJson('/api/points-of-sale/bodega/receivables?page=0')->assertUnprocessable();
        $this->getJson('/api/points-of-sale/bodega/receivables/7/credits?snapshot=invalid')->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_all_positive_pending_credits_are_counted_and_details_match(): void
    {
        $this->actingAs(User::factory()->create());
        $this->fake([$this->row(1, 59), $this->row(2, 60), $this->row(3, 61, '100.10'), $this->row(4, 90, '20.20'), $this->row(5, 100, '0'), $this->row(6, 100, '-10')]);
        $summary = $this->getJson('/api/points-of-sale/bodega/receivables')->assertOk()
            ->assertJsonPath('summary.customer_count', 1)->assertJsonPath('summary.sale_count', 4)->assertJsonPath('summary.amount', 320.5)
            ->assertJsonPath('data.0.sale_count', 4)->assertJsonPath('data.0.id', '7')->assertJsonPath('data.0.amount', 320.5)
            ->assertJsonMissingPath('data.0.credits')->assertDontSee('private-key')->assertDontSee('private@example.com');
        Http::assertSent(fn ($request) => str_contains($request->url(), 'store_account_outstanding') && $request['show_paid'] === 0);
        $snapshot = $summary->json('snapshot_id');
        $this->getJson("/api/points-of-sale/bodega/receivables/7/credits?snapshot=$snapshot")->assertOk()
            ->assertJsonPath('value', 320.5)->assertJsonPath('total', 4)->assertJsonPath('data.0.id', '4')->assertJsonPath('data.1.age_days', 61)
            ->assertJsonMissingPath('paid')->assertJsonMissingPath('over_60');
        Http::assertSentCount(2);
        $this->getJson("/api/points-of-sale/bodega/receivables/7/credits?snapshot=$snapshot&tab=paid")->assertOk()
            ->assertJsonPath('value', 281.5)->assertJsonCount(0, 'data');
        $this->getJson('/api/points-of-sale/bodega/receivables?search=perez')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/points-of-sale/bodega/receivables?search=missing')->assertOk()->assertJsonPath('total', 0);
        $this->getJson("/api/points-of-sale/villa/receivables/7/credits?snapshot=$snapshot")->assertStatus(410);
        $this->getJson("/api/points-of-sale/bodega/receivables/99/credits?snapshot=$snapshot")->assertNotFound();
        Http::assertSentCount(6);
        $this->travel(16)->minutes();
        $this->getJson("/api/points-of-sale/bodega/receivables/7/credits?snapshot=$snapshot")->assertStatus(410);
    }

    public function test_namesakes_are_resolved_by_sale_customer_id(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake([
            '*/reports/store_account_outstanding*' => Http::response(['limit' => 500, 'data' => ['rows' => [$this->row(1, 61), $this->row(2, 62)]]]),
            '*/customers*' => Http::response([['person_id' => 7, 'first_name' => 'Ana', 'last_name' => 'Pérez'], ['person_id' => 8, 'first_name' => 'Ana', 'last_name' => 'Pérez']], 200, ['x-total-records' => '2']),
            '*/sales/1' => Http::response(['sale_id' => 1, 'customer_id' => 7]),
            '*/sales/2' => Http::response(['sale_id' => 2, 'customer_id' => 8]),
        ]);
        $this->getJson('/api/points-of-sale/bodega/receivables')->assertOk()->assertJsonPath('summary.customer_count', 2)->assertJsonPath('data.0.sale_count', 1)->assertJsonPath('data.1.sale_count', 1);
        Http::assertSentCount(4);
    }

    public function test_report_pagination_and_credit_pagination(): void
    {
        $this->actingAs(User::factory()->create());
        $rows = array_map(fn ($id) => $this->row($id, 61 + $id, '10'), range(1, 25));
        Http::fake([
            '*/sales/*' => fn ($request) => Http::response(['sale_id' => basename(parse_url($request->url(), PHP_URL_PATH)), 'customer_id' => 7, 'total' => '15']),
            '*/reports/store_account_outstanding*' => fn ($request) => Http::response(['limit' => 20, 'data' => ['rows' => array_slice($rows, (int) $request['offset'], 20)]]),
            '*/customers*' => Http::response([['person_id' => 7, 'first_name' => 'Ana', 'last_name' => 'Pérez']], 200, ['x-total-records' => '1']),
        ]);
        $snapshot = $this->getJson('/api/points-of-sale/local/receivables')->assertOk()->assertJsonPath('summary.sale_count', 25)->assertJsonPath('summary.amount', 250)->json('snapshot_id');
        $this->getJson("/api/points-of-sale/local/receivables/7/credits?snapshot=$snapshot&page=2")->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('last_page', 2);
        $this->getJson("/api/points-of-sale/local/receivables/7/credits?snapshot=$snapshot&tab=over_60&page=2")->assertOk()
            ->assertJsonCount(5, 'data')->assertJsonPath('total', 25)->assertJsonPath('value', 250);
        Http::assertSentCount(3);
    }

    public function test_age_balances_are_cumulative_strict_and_available_for_every_point(): void
    {
        $this->actingAs(User::factory()->create());
        $this->fake(array_map(fn ($age, $id) => $this->row($id, $age, '10.10'), [0, 60, 61, 90, 91, 120, 121], range(1, 7)));
        foreach (array_keys(config('points_of_sale')) as $point) {
            $snapshot = $this->getJson("/api/points-of-sale/$point/receivables")->assertOk()->assertJsonPath('summary.amount', 70.7)->json('snapshot_id');
            $before = count(Http::recorded());
            foreach (['amount' => [70.7, 7], 'over_60' => [50.5, 5], 'over_90' => [30.3, 3], 'over_120' => [10.1, 1]] as $tab => [$value, $count]) {
                $this->getJson("/api/points-of-sale/$point/receivables/7/credits?snapshot=$snapshot&tab=$tab")->assertOk()
                    ->assertJsonPath('value', $value)->assertJsonPath('total', $count)->assertJsonCount($count, 'data');
            }
            Http::assertSentCount($before);
            $this->getJson("/api/points-of-sale/$point/receivables/7/credits?snapshot=$snapshot&tab=invalid")->assertUnprocessable();
            $this->getJson("/api/points-of-sale/$point/receivables/7/credits?snapshot=$snapshot&tab=paid")->assertOk()
                ->assertJsonPath('value', 982.8)->assertJsonPath('paid_error', null)->assertJsonCount(0, 'data');
            $this->getJson("/api/points-of-sale/$point/receivables/7/credits?snapshot=$snapshot&tab=paid")->assertOk()->assertJsonPath('value', 982.8);
            $this->getJson("/api/points-of-sale/$point/receivables/7/report?snapshot=$snapshot")->assertOk()
                ->assertJsonPath('data.over_120', 10.1)->assertJsonPath('data.paid', 982.8);
        }
        Http::assertSentCount(45);
    }

    public function test_unavailable_payments_do_not_hide_balances_or_claim_zero_paid(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake([
            '*/reports/store_account_outstanding*' => Http::response(['limit' => 500, 'data' => ['rows' => [$this->row(1, 121)]]]),
            '*/customers*' => Http::response([['person_id' => 7, 'first_name' => 'Ana', 'last_name' => 'Pérez']]),
            '*/sales/*' => Http::response('', 503),
        ]);
        $snapshot = $this->getJson('/api/points-of-sale/local/receivables')->assertOk()->json('snapshot_id');
        $this->getJson("/api/points-of-sale/local/receivables/7/credits?snapshot=$snapshot")->assertOk()
            ->assertJsonPath('value', 100.1);
        Http::assertSentCount(2);
        $this->getJson("/api/points-of-sale/local/receivables/7/credits?snapshot=$snapshot&tab=paid")->assertOk()
            ->assertJsonPath('value', null)->assertJsonPath('paid_error', 'No fue posible verificar los pagos. Actualiza la cartera y vuelve a intentarlo.');
    }

    public function test_unavailable_reports_and_malformed_data_are_not_shown_as_zero(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fakeSequence()->push('', 404)->push(['data' => ['rows' => 'invalid']])->push(['data' => ['rows' => [$this->row(1, 90, 'not-money')]], 'limit' => 500]);
        $this->getJson('/api/points-of-sale/villa/receivables')->assertStatus(501)->assertJsonPath('code', 'report_unavailable')->assertJsonMissingPath('summary');
        $this->getJson('/api/points-of-sale/villa/receivables')->assertStatus(501);
        Http::assertSentCount(1);
        $this->getJson('/api/points-of-sale/local/receivables')->assertStatus(502)->assertJsonMissingPath('summary');
        $this->getJson('/api/points-of-sale/local/receivables')->assertStatus(502)->assertJsonMissingPath('summary');
    }

    public function test_empty_cartera_and_sixty_second_cache(): void
    {
        $this->actingAs(User::factory()->create());
        $this->fake([]);
        $this->getJson('/api/points-of-sale/bodega/receivables')->assertOk()->assertJsonPath('summary.amount', 0);
        $this->travel(59)->seconds();
        $this->getJson('/api/points-of-sale/bodega/receivables')->assertOk();
        Http::assertSentCount(1);
        $this->travel(2)->seconds();
        $this->getJson('/api/points-of-sale/bodega/receivables')->assertOk();
        Http::assertSentCount(2);
    }

    public function test_report_includes_every_credit_not_only_the_current_page(): void
    {
        $this->getJson('/api/points-of-sale/bodega/receivables/7/report')->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->fake(array_map(fn ($id) => $this->row($id, 61 + $id, '10.10'), range(1, 27)));
        $snapshot = $this->getJson('/api/points-of-sale/bodega/receivables')->assertOk()->json('snapshot_id');
        $this->getJson("/api/points-of-sale/bodega/receivables/7/report?snapshot=$snapshot")->assertOk()
            ->assertJsonCount(27, 'data.credits')->assertJsonPath('data.total', 27)->assertJsonPath('data.amount', 272.7)
            ->assertJsonPath('data.customer.name', 'Ana Pérez')->assertJsonPath('data.point.name', 'Bodega')
            ->assertJsonPath('data.as_of', '2026-11-25')->assertDontSee('private-key')->assertDontSee('private@example.com');
        $this->getJson("/api/points-of-sale/local/receivables/7/report?snapshot=$snapshot")->assertStatus(410);
        $this->getJson("/api/points-of-sale/bodega/receivables/999/report?snapshot=$snapshot")->assertNotFound();
        $this->getJson('/api/points-of-sale/bodega/receivables/7/report?snapshot=invalid')->assertUnprocessable();
        $this->travel(16)->minutes();
        $this->getJson("/api/points-of-sale/bodega/receivables/7/report?snapshot=$snapshot")->assertStatus(410);
        Http::assertSentCount(29);
    }
}
