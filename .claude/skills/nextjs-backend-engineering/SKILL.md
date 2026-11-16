---
name: nextjs-backend-engineering
description: Server-side coding standards for this Next.js 15 App Router app on Vercel - thin route handlers, server-only modules, runtime and maxDuration settings, the single config module, the composition root and structured logging. Use when writing or changing anything under app/api, lib/http, lib/application or lib/infrastructure.
---

# Next.js backend engineering

Target layout and contracts: `docs/architecture/LLD.md` sections 1, 4.2, 5, 6, 7. Files that have not
moved yet are listed in the LLD table "Where today's code goes".

## Module rules

- `package.json` has `"type": "module"`. Relative imports include the extension (`./x.js`). The
  `node:test` runner fails without it.
- Plain JavaScript with JSDoc typedefs. No TypeScript, no new dependency beyond the table in
  `docs/engineering/MIGRATION_PLAN.md` section 2.
- Every file in `lib/infrastructure` and `lib/http` starts with `import 'server-only'`. `lib/domain`
  must not: it is bundled into the browser.
- Import directions follow the dependency rule in LLD section 1; the `architecture-audit` skill lists
  the checks.

## Route handlers

- A route is an HTTP adapter only: create the request context, guard, read the body, call the use case,
  respond. `app/api/trips/route.js` matches the shape in LLD section 5 (about 30 lines).
- No validation, limits, cache, provider or error-mapping logic in a route. That lives in
  `lib/application/generate-trip.js`.
- Routes get dependencies from `container()` in `lib/infrastructure/container.js`. They never construct
  a provider or a store, and never import `groq-sdk`.
- All errors go through `respondError`, which maps `AppError` to status and fixed message and writes
  the one log line. Do not build error responses by hand.
- Pass `request.signal` into the context so a closed tab cancels the provider call.

## Runtime settings

- `export const runtime = 'nodejs'` on API routes. `groq-sdk` and `node:crypto` need Node; do not use
  the Edge runtime.
- `export const maxDuration = 60` on `app/api/trips/route.js`. `AI_TIMEOUT_MS` (default 50,000) must
  stay below it; `loadConfig` validates this.
- `export const dynamic = 'force-dynamic'` on the `GET` routes (`health`, `usage`), so they are never
  prerendered. Every API response carries `Cache-Control: no-store`.
- Node 22 or later (`engines` in `package.json`).

## Configuration

- `process.env` is read only in `lib/infrastructure/config.js`. Everything else receives `config`.
- `loadConfig(env)` returns a frozen object or throws `ConfigError` listing every problem at once. It is
  called on first use and memoised, not at import time, so a missing key does not crash the build or
  the process: health reports `not_configured` and the trips route returns `SERVICE_UNAVAILABLE`.
- A new variable needs: a row in LLD section 6, validation in `config.js`, a line in
  `.env.local.example`, and a config test. Never prefix an AI or store variable with `NEXT_PUBLIC_`.
- `GROQ_MODEL` has no default in code.

## Use case and dependencies

- `createGenerateTrip({ provider, store, logger, config, now, random, sleep })`. Do not call
  `Date.now()`, `Math.random()` or `setTimeout` directly in `lib/application`; use the injected ones so
  tests are deterministic.
- Module-level state is allowed only for the in-flight map and the memoised container. It is per
  instance and lost on cold start; nothing may depend on it for correctness.
- Shared state goes through the `Store` port (LLD 4.1). A store error never fails a request (HLD
  section 9).

## Logging

- One JSON line per `/api/trips` request, event `trip_request`, with the fields in LLD section 7,
  written through `logger`. No `console.log` in `lib/` or `app/api`.
- Never logged: API key, headers, destination, traveller name, raw IP, prompt, model output, provider
  free-text messages. Log `code`, `providerKind`, `status` and `requestId` instead.

## Checklist

1. Route file contains only HTTP concerns and exports `runtime`, plus `maxDuration` (trips) or
   `dynamic` (health, usage).
2. No `process.env` outside `config.js`; no adapter import outside `container.js`.
3. `import 'server-only'` present where required, absent from `lib/domain` and `lib/client`.
4. Relative imports have extensions.
5. Tests added or updated per the `testing-and-quality-assurance` skill.
6. `npm run verify` passes; paste the command and the tail of its output.

## Deliverable

The code change with tests, the `npm run verify` output, and a list of any LLD section that had to
change as a result.
