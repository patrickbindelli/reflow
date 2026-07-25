<?php

namespace Reflow\Laravel;

use Illuminate\Support\ServiceProvider;

class ReflowServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/reflow.php', 'reflow');
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__ . '/../config/reflow.php' => config_path('reflow.php'),
        ], 'reflow-config');

        if ($this->shouldRegisterRoutes()) {
            $this->loadRoutesFrom(__DIR__ . '/../routes/reflow.php');
        }
    }

    /**
     * Opt-in, defense-in-depth kill-switch. Both checks must pass, so a
     * stray REFLOW_ENABLED=true left in a production .env still doesn't
     * expose the panel unless production is explicitly allowed too.
     */
    private function shouldRegisterRoutes(): bool
    {
        if (! config('reflow.enabled')) {
            return false;
        }

        if ($this->app->environment('production') && ! config('reflow.allow_in_production')) {
            return false;
        }

        return true;
    }
}
