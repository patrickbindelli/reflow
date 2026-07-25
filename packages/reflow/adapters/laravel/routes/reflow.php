<?php

use Illuminate\Support\Facades\Route;

/**
 * Registered only from ReflowServiceProvider::boot() when the enabled/
 * production gates pass — see that class for the kill-switch logic.
 *
 * Routes mirror the packages/reflow/{ui,core} directory tree 1:1, on
 * purpose: index.html and app.js use plain relative imports/references
 * (e.g. "app.js", "../core/openapi-parser.js"), so the URL structure has
 * to match the filesystem structure for those to resolve correctly in
 * the browser. Trailing slash on /ui/ matters for the same reason.
 */

$root = config('reflow.route');
$uiDir = realpath(__DIR__ . '/../ui');
$coreDir = realpath(__DIR__ . '/../core');

Route::get($root, fn () => redirect("{$root}/ui/"))->name('reflow.home');

Route::get("{$root}/ui/", function () use ($uiDir) {
    return response()->file($uiDir . '/index.html');
})->name('reflow.panel');

Route::get("{$root}/ui/{file}", function (string $file) use ($uiDir) {
    return reflow_serve_file($uiDir, $file);
})->name('reflow.ui-assets');

Route::get("{$root}/core/{file}", function (string $file) use ($coreDir) {
    return reflow_serve_file($coreDir, $file);
})->name('reflow.core-assets');

/**
 * realpath + prefix check blocks path traversal (e.g. {file}=../../.env)
 * through the wildcard segment.
 */
if (! function_exists('reflow_serve_file')) {
    function reflow_serve_file(string $baseDir, string $file)
    {
        $path = realpath($baseDir . '/' . $file);

        if ($path === false || ! str_starts_with($path, $baseDir)) {
            abort(404);
        }

        return response()->file($path);
    }
}
