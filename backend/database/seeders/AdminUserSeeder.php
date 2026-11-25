<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'ronalddanilo1234@gmail.com'],
            [
                'name'     => 'Ronald',
                'password' => Hash::make('Andes2027*'),
            ]
        );
    }
}