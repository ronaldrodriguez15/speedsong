<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            abort_unless($request->user()?->is_admin, 403, 'Solo los administradores pueden gestionar usuarios.');
            return $next($request);
        });
    }
    public function index(Request $request)
    {
        $request->validate(['search' => 'nullable|string|max:255', 'page' => 'nullable|integer|min:1']);
        return User::query()->when($request->filled('search'), function ($query) use ($request) {
            $query->where(function ($query) use ($request) {
                $query->where('name', 'like', '%'.$request->search.'%')->orWhere('email', 'like', '%'.$request->search.'%');
            });
        })->orderByDesc('id')->paginate(10);
    }
    public function show(User $user) { return $user; }
    public function store(Request $request)
    {
        $data = $this->validated($request);
        $user = new User($data);
        $user->is_admin = $data['is_admin'];
        $user->point_ids = $data['is_admin'] ? [] : $data['point_ids'];
        $user->save();
        return response()->json($user, 201);
    }
    public function update(Request $request, User $user)
    {
        $data = $this->validated($request, $user);
        abort_if($request->user()->id === $user->id && ! $data['is_admin'], 422, 'No puedes quitarte tu permiso de administrador.');
        if (empty($data['password'])) unset($data['password']);
        $user->fill($data);
        $user->is_admin = $data['is_admin'];
        $user->point_ids = $data['is_admin'] ? [] : $data['point_ids'];
        $user->save();
        return $user;
    }
    public function destroy(Request $request, User $user)
    {
        abort_if($request->user()->id === $user->id, 422, 'No puedes eliminar tu propia cuenta.');
        $user->tokens()->delete();
        $user->delete();
        return response()->noContent();
    }
    private function validated(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'max:255', Password::min(8), 'confirmed'],
            'is_admin' => ['required', 'boolean'],
            'point_ids' => [Rule::requiredIf(!$request->boolean('is_admin')), 'array', 'max:5'],
            'point_ids.*' => ['required', 'string', 'distinct', Rule::in(array_keys(config('points_of_sale')))],
        ]);
    }
}
