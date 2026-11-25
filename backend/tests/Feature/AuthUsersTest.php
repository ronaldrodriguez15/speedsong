<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
class AuthUsersTest extends TestCase
{
    use RefreshDatabase;
    private function admin(): User {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true])->save();
        return $user;
    }
    public function test_login_session_and_logout(): void {
        $user = User::factory()->create(['password' => 'ExamplePass123']);
        $this->withHeader('Origin', 'http://localhost:5173');
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'bad'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'ExamplePass123'])->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonMissingPath('user.password');
        $this->getJson('/api/user')->assertOk();
        $this->postJson('/api/logout')->assertNoContent();
        $this->assertGuest('web');
    }
    public function test_guests_and_non_admins_cannot_manage_users(): void {
        $this->getJson('/api/users')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/users')->assertForbidden();
    }
    public function test_admin_crud_search_validation_and_self_protection(): void {
        $admin = $this->admin();
        $this->actingAs($admin);
        $data = ['name' => 'Nuevo usuario', 'email' => 'nuevo@example.com', 'password' => 'ExamplePass123', 'password_confirmation' => 'ExamplePass123', 'is_admin' => false];
        $id = $this->postJson('/api/users', $data)->assertCreated()->assertJsonMissingPath('password')->json('id');
        $this->assertTrue(Hash::check('ExamplePass123', User::findOrFail($id)->password));
        $this->getJson('/api/users?search=nuevo')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/users/'.$id)->assertOk();
        $this->postJson('/api/users', $data)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->putJson('/api/users/'.$id, [...$data, 'name' => 'Editado', 'password' => '', 'password_confirmation' => ''])->assertOk()->assertJsonPath('name', 'Editado');
        $this->assertTrue(Hash::check('ExamplePass123', User::findOrFail($id)->password));
        $this->putJson('/api/users/'.$id, [...$data, 'password_confirmation' => 'different'])->assertUnprocessable();
        $this->deleteJson('/api/users/'.$admin->id)->assertUnprocessable();
        $this->putJson('/api/users/'.$admin->id, [...$data, 'email' => $admin->email])->assertUnprocessable();
        $this->deleteJson('/api/users/'.$id)->assertNoContent();
        $this->getJson('/api/users/'.$id)->assertNotFound();
    }
    public function test_seeder_is_repeatable_without_resetting_password(): void {
        config(['initial_admin.password' => 'InitialPass123']);
        $this->seed();
        $user = User::where('email', config('initial_admin.email'))->firstOrFail();
        $user->update(['password' => 'ChangedPass123']);
        $this->seed();
        $this->assertSame(1, User::count());
        $this->assertTrue($user->is_admin);
        $this->assertTrue(Hash::check('ChangedPass123', $user->fresh()->password));
    }
}
