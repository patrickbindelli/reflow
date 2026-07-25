# Reflow

Local-first API explorer and REST client. A free, zero-build alternative to Swagger UI, Scalar, and ReDoc — embedded directly in your backend as a "home" route.

Built for developers, by developers: minimum clicks to fire a request. Payloads come pre-filled with smart mock data generated from your OpenAPI schema's types and constraints ("Smart Pre-fill") — edit and send, no manual JSON authoring.

## Why

Existing API doc tools either cost money (Scalar), require a build pipeline, or leave you writing request bodies by hand every time you test an endpoint. Reflow runs entirely client-side against your existing OpenAPI spec, has no build step, and pre-fills every request body so testing an endpoint is one click plus "Send".

## Features

- **Smart Pre-fill** — generates realistic mock JSON from your schema: respects `type`, `format` (email, uuid, date-time...), `enum`, `minimum`/`maximum`, `minLength`/`maxLength`, resolves `$ref` (including nested/circular), fills required *and* optional fields.
- **Native REST client** — path/query params, JSON body editor, real `fetch()` against your live API, response viewer. No proxy, no server round-trip beyond your own API.
- **JSON and YAML specs** — both supported from day one.
- **Zero build** — vanilla JS + Alpine.js via CDN. Drop the `ui/` and `core/` folders into any static file server.
- **Framework-agnostic core** — the parser and mock generator only need an `/openapi.json` (or `.yaml`) URL to work. The Laravel adapter is a thin shell; other backends can follow the same pattern.
- **Off by default in production** — see [Security](#security) below.

## Quick start (Laravel)

```bash
composer require reflow/laravel
php artisan vendor:publish --tag=reflow-config
```

Add to `.env`:

```
REFLOW_ENABLED=true
```

Visit `/reflow` on your app. It redirects to the panel and loads whatever spec `REFLOW_SPEC_URL` points to (default `/openapi.json`) — pair it with a spec generator already in your project, e.g. [dedoc/scramble](https://github.com/dedoc/scramble) or [l5-swagger](https://github.com/DarkaOnLine/L5-Swagger). Reflow only *consumes* the spec, it doesn't generate one.

## Security

The panel exposes your API's schema and example payloads — treat it like any other introspection endpoint.

- Disabled by default. Nothing is registered unless `REFLOW_ENABLED=true`.
- In production (`app()->environment('production')`), a second explicit flag `REFLOW_ALLOW_PRODUCTION=true` is required on top of `REFLOW_ENABLED`. A stray `.env` value alone won't expose it in prod.
- Never flip `REFLOW_ALLOW_PRODUCTION` on unless you specifically intend the panel to be reachable in production.

## Trying it standalone (no backend)

```bash
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000/packages/reflow/ui/index.html?spec=/examples/fixtures/openapi.json
```

Swap the `spec` query param for `.../openapi.yaml` to test the YAML path, or point it at your own spec URL.

## Project structure

```
reflow-api/
├── examples/
│   └── fixtures/               # sample OpenAPI specs (JSON + YAML) for local testing
└── packages/
    └── reflow/
        ├── core/                # framework-agnostic: parser + Smart Pre-fill generator
        ├── ui/                  # zero-build panel (Alpine.js via CDN)
        └── adapters/
            └── laravel/         # Laravel service provider, config, routes
```

See [CLAUDE.md](CLAUDE.md) for current project status and detailed context.

## Roadmap

- `examples/laravel-demo` — minimal Laravel app wired to the adapter end-to-end.
- Additional backend adapters (Express, etc.) following the same opt-in-only security pattern.

## License

MIT.
