<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('cash_closings', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->decimal('opening_balance', 14, 2);
            $table->decimal('cash_income', 14, 2);
            $table->decimal('cash_expenses', 14, 2);
            $table->decimal('expected_cash', 14, 2);
            $table->decimal('counted_cash', 14, 2);
            $table->decimal('difference', 14, 2);
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('responsible_name');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('cash_closings'); }
};
