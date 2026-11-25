<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // A consolidated dashboard reads three reports across five stores.
            return Limit::perMinute($request->user() ? 600 : 60)
                ->by('api-v2:'.($request->user()?->id ?: $request->ip()));
        });

        RateLimiter::for('pos-reports', function (Request $request) {
            return Limit::perMinute(60)->by(implode(':', [
                $request->user()?->id ?: $request->ip(),
                $request->route()->uri(),
                $request->route('point'),
            ]));
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
