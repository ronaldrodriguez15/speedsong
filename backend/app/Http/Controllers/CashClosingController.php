<?php
namespace App\Http\Controllers;
use App\Models\CashClosing;
use Illuminate\Http\Request;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;
class CashClosingController extends Controller {
    public function __construct() {
        $this->middleware(function ($request, $next) {
            abort_unless($request->user()?->is_admin, 403, 'Solo los administradores pueden consultar y registrar cierres.');
            return $next($request);
        });
    }
    public function index(Request $request) {
        $data = $request->validate(['date' => 'nullable|date_format:Y-m-d', 'page' => 'nullable|integer|min:1']);
        return CashClosing::query()->when($data['date'] ?? null, fn ($query, $date) => $query->where('date', $date))
            ->orderByDesc('date')->paginate(10);
    }
    public function store(Request $request) {
        $money = ['required', 'numeric', 'min:0', 'max:9999999999.99', 'regex:/^\\d+(\\.\\d{1,2})?$/'];
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('America/Bogota')->toDateString(), 'unique:cash_closings,date'],
            'opening_balance' => $money, 'cash_income' => $money,
            'cash_expenses' => $money, 'counted_cash' => $money,
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $cents = fn ($value) => (int) round((float) $value * 100);
        $expected = $cents($data['opening_balance']) + $cents($data['cash_income']) - $cents($data['cash_expenses']);
        if ($expected < 0) throw ValidationException::withMessages(['cash_expenses' => 'Los egresos no pueden superar el saldo inicial más los ingresos.']);
        $data['expected_cash'] = $expected / 100;
        $data['difference'] = ($cents($data['counted_cash']) - $expected) / 100;
        $data['user_id'] = $request->user()->id;
        $data['responsible_name'] = $request->user()->name;
        try { $closing = CashClosing::create($data); }
        catch (UniqueConstraintViolationException $e) {
            throw ValidationException::withMessages(['date' => 'Ya existe un cierre para esta fecha.']);
        }
        return response()->json($closing, 201);
    }
}
