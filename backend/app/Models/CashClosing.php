<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CashClosing extends Model {
    protected $guarded = ['id'];
    protected $casts = [
        'opening_balance' => 'decimal:2', 'cash_income' => 'decimal:2',
        'cash_expenses' => 'decimal:2', 'expected_cash' => 'decimal:2',
        'counted_cash' => 'decimal:2', 'difference' => 'decimal:2',
    ];
}
