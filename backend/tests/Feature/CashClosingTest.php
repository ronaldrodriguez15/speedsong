<?php
namespace Tests\Feature;
use App\Models\User;
use App\Models\CashClosing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class CashClosingTest extends TestCase {
    use RefreshDatabase;
    private function payload(): array {
        return ['date' => now('America/Bogota')->toDateString(), 'opening_balance' => '100.10', 'cash_income' => '50.20', 'cash_expenses' => '20.05', 'counted_cash' => '125.00', 'notes' => 'Faltante revisado'];
    }
    private function admin(): User {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true])->save();
        return $user;
    }
    public function test_permissions_protect_both_endpoints(): void {
        $this->getJson('/api/cash-closings')->assertUnauthorized();
        $this->postJson('/api/cash-closings', $this->payload())->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/cash-closings')->assertForbidden();
        $this->postJson('/api/cash-closings', $this->payload())->assertForbidden();
    }
    public function test_server_calculates_amounts_and_preserves_responsible(): void {
        $admin = $this->admin();
        $this->actingAs($admin)->postJson('/api/cash-closings', [...$this->payload(), 'expected_cash' => '999', 'difference' => '0', 'responsible_name' => 'False'])
            ->assertCreated()->assertJsonPath('expected_cash', '130.25')->assertJsonPath('difference', '-5.25')->assertJsonPath('responsible_name', $admin->name);
        $this->postJson('/api/cash-closings', $this->payload())->assertUnprocessable()->assertJsonValidationErrors('date');
        $this->getJson('/api/cash-closings?date='.$this->payload()['date'])->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/cash-closings?date=2000-01-01')->assertOk()->assertJsonPath('total', 0);
        $admin->delete();
        $this->assertSame($admin->name, CashClosing::first()->responsible_name);
        $this->assertNull(CashClosing::first()->user_id);
    }
    public function test_invalid_amounts_and_future_dates_are_rejected(): void {
        $this->actingAs($this->admin());
        foreach (['-1', '1.001', '10000000000', 'abc'] as $invalid) {
            $this->postJson('/api/cash-closings', [...$this->payload(), 'cash_income' => $invalid])->assertUnprocessable()->assertJsonValidationErrors('cash_income');
        }
        $this->postJson('/api/cash-closings', [...$this->payload(), 'cash_expenses' => '999'])->assertUnprocessable()->assertJsonValidationErrors('cash_expenses');
        $this->postJson('/api/cash-closings', [...$this->payload(), 'date' => now('America/Bogota')->addDay()->toDateString()])->assertUnprocessable()->assertJsonValidationErrors('date');
        $this->assertDatabaseCount('cash_closings', 0);
    }
    public function test_zero_balanced_and_surplus_closings(): void {
        $this->actingAs($this->admin());
        $data = $this->payload();
        foreach (['opening_balance', 'cash_income', 'cash_expenses', 'counted_cash'] as $field) $data[$field] = '0';
        $this->postJson('/api/cash-closings', $data)->assertCreated()->assertJsonPath('difference', '0.00');
        $this->postJson('/api/cash-closings', [...$this->payload(), 'date' => now('America/Bogota')->subDay()->toDateString(), 'counted_cash' => '140.25'])->assertCreated()->assertJsonPath('difference', '10.00');
    }
}
