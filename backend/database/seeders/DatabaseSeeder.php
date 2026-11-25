<?php
namespace Database\Seeders;
use App\Models\User;
use Illuminate\Database\Seeder;
class DatabaseSeeder extends Seeder
{
    public function run(): void {
        $email = config('initial_admin.email');
        if (User::where('email', $email)->exists()) return;
        $password = config('initial_admin.password');
        if (! $password || strlen($password) < 8) {
            throw new \RuntimeException('Configura ADMIN_PASSWORD con al menos 8 caracteres.');
        }
        $user = new User(['name' => 'Administrador SpeedSong', 'email' => $email, 'password' => $password]);
        $user->is_admin = true;
        $user->save();
    }
}
