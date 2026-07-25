# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Keep Sections 6-7 Updated

**Every time the project state or file layout changes, update the Project Context and File Tree sections below in the same turn.**

- New file created/deleted, directory added, major decision made → update both sections before ending the turn.
- Don't let these drift from reality — a stale tree/context is worse than none, since it actively misleads.

## 6. Project Context

Reflow: local-first, zero-build OpenAPI explorer + REST client. Free alternative to Swagger UI/Scalar/ReDoc, embedded as a "home" route in a backend. Core (parser + Smart Pre-fill mock generator + UI) is pure vanilla JS/Alpine.js, no build step, no framework dependency — runs entirely client-side against an `/openapi.json` or `.yaml` endpoint, so it's portable beyond Laravel later.

Status: PoC complete (2026-07-25).

Key decisions locked in:
- YAML support from day one (js-yaml via CDN), not JSON-only.
- Production kill-switch is opt-in-only: Laravel adapter requires `REFLOW_ENABLED=true`, and if `app()->environment('production')`, also requires `REFLOW_ALLOW_PRODUCTION=true`. Any future adapter must follow the same pattern — never expose API schema/payloads in prod by default.
- Laravel routes mirror the `packages/reflow/{ui,core}` directory tree 1:1 (`/reflow/ui/...`, `/reflow/core/...`) because `index.html`/`app.js` use plain relative imports.

Next natural step (not started): `examples/laravel-demo`, a minimal Laravel app consuming the adapter for real.

## 7. File Tree

```
reflow-api/
├── CLAUDE.md
├── README.md
├── examples/
│   └── fixtures/
│       ├── openapi.json           # demo spec, JSON
│       └── openapi.yaml           # same demo spec, YAML
└── packages/
    └── reflow/
        ├── core/
        │   ├── openapi-parser.js  # loadSpec (JSON+YAML), parseSpec, groupByTag, resolveRef
        │   └── smart-prefill.js   # MockGenerator — Smart Pre-fill logic
        ├── ui/
        │   ├── index.html         # panel shell (Alpine.js via CDN)
        │   ├── app.js             # Alpine component: fetch spec, select endpoint, send request
        │   └── style.css
        └── adapters/
            └── laravel/
                ├── composer.json
                ├── config/reflow.php        # enabled/allow_in_production/route/spec_url
                ├── routes/reflow.php        # route registration, path-traversal guard
                └── src/ReflowServiceProvider.php  # kill-switch gating logic
```

## 8. Git Commits

- Conventional Commits format always: `type(scope): description` (feat, fix, docs, refactor, chore, test...).
- Never add `Co-Authored-By: Claude` or any AI self-attribution to commit messages.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
