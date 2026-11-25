<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
        if (! Auth::guard('web')->attempt($credentials)) {
            throw ValidationException::withMessages(['email' => ['El correo o la contraseña son incorrectos.']]);
        }
        $request->session()->regenerate();
        return response()->json(['user' => $request->user('web')]);
    }
    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->noContent();
    }
}
