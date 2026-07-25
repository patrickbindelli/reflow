<?php

return [
    // Opt-in only. Never true by default — an unset env var means Reflow
    // stays off, including in production, even if this file ships as-is.
    'enabled' => (bool) env('REFLOW_ENABLED', false),

    // Second gate: even with REFLOW_ENABLED=true, production requires this
    // explicit extra flag too. Defense in depth against a stray .env value
    // surviving a deploy.
    'allow_in_production' => (bool) env('REFLOW_ALLOW_PRODUCTION', false),

    'route' => env('REFLOW_ROUTE', '/reflow'),

    // Path (relative to the app) or URL Reflow should fetch the OpenAPI
    // spec from. Point this at whatever already generates your spec
    // (dedoc/scramble, l5-swagger, etc.) — Reflow only consumes it.
    'spec_url' => env('REFLOW_SPEC_URL', '/openapi.json'),
];
