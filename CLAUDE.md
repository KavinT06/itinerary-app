# Itinera (AI travel planner) — engineering guide

A stateless Next.js app. A visitor enters a name, dates and a destination; `POST /api/trips` asks Groq for a
structured itinerary, validates it, and returns it. No database, no accounts. Deployed on Vercel.

Design and state of the project, in order of authority:

- `docs/architecture/HLD.md` — why the system is shaped this way; provider facts and live measurements (8.6)
- `docs/architecture/LLD.md` — folder layout, contracts, error codes, limits, configuration
- `docs/engineering/PROJECT_STATUS.md` — what is done, what is open, what is unverified
- `docs/engineering/DEPLOYMENT.md` — environment variables, deploying, rollback

Read the relevant section before changing behaviour, and update it in the same change.

## Stack

- Next.js 15.5 App Router, React 19, plain JavaScript with JSDoc types (no TypeScript), Tailwind CSS 4
- Groq via the official `groq-sdk`; model from `GROQ_MODEL` (currently `openai/gpt-oss-120b`, free plan)
- Optional shared store: Upstash Redis via `@upstash/redis`. Without it, an in-memory store is used
- Tests: Node's built-in `node:test`; browser tests with Playwright. Lint: ESLint 9 flat config
- `package.json` has `"type": "module"`: relative imports must include the file extension

## Commands

```bash
npm run dev          # dev server on :3000
npm test             # unit and integration tests: fast, no network, no API key
npm run lint
npm run build
npm run test:e2e     # browser tests against the production build (run `npm run build` first)
npm run verify       # lint + test + build + browser tests. Run before saying work is done
SMOKE_AI=1 npm run smoke:ai -- 3     # one REAL 3-day generation. Spends Groq quota; never in CI
```

One test file: `node --conditions=react-server --test test/http/routes.test.js`.
The `--conditions=react-server` flag makes `import 'server-only'` a no-op outside Next.js.

## Layout and layer rules

```
app/                      presentation
  page.jsx                server component: nav, hero, planner, "How it works", footer
  not-found.jsx           designed 404
  components/             Planner (the client island) + presentational TripForm, GenerationStatus,
                          ItineraryView, DayNav, SiteNav, Hero, InfoSections, SiteFooter, icons
  hooks/useTripGeneration submit state machine, cooldown, cancel
  api/trips|health|usage  route handlers: HTTP adapters only, no business logic
lib/domain/               PURE: dates, request validation, itinerary validation, error codes.
                          Runs in the browser and on the server. Imports nothing outside lib/domain
lib/application/          use cases: generate-trip, prompt + schema, cache key, retry, limits, errors, ports.
                          Imports lib/domain only; adapters are passed in as arguments
lib/infrastructure/       adapters (server-only): config, container, logger, ai/groq-provider, store/*
lib/http/                 route helpers (server-only): request context, guards, body reader, responses
lib/client/               browser fetch wrapper
test/                     domain/ application/ infrastructure/ http/ client/ e2e/ + fixtures.js
scripts/smoke-ai.mjs      explicit real-provider check
```

ESLint enforces the import directions (`eslint.config.mjs`). If lint rejects an import, the code is in the
wrong layer; do not disable the rule.

- Only `lib/infrastructure/config.js` reads `process.env`.
- Only `lib/infrastructure/ai/` knows about Groq. Business logic sees the `AIProvider` port (`lib/application/ports.js`).
- Only `lib/infrastructure/container.js` decides which adapters are used. Tests inject fakes through it.

## Rules that must not be broken

- **Secrets.** `GROQ_API_KEY` is read only in `config.js` and passed to the Groq adapter. Never log it, return
  it, or add a `NEXT_PUBLIC_` AI variable. A key was once committed to this public repository; do not repeat that.
- **No fabricated data.** If generation fails, return the coded error. Never add a sample or fallback itinerary.
- **Trust boundary.** Destination, dates, traveller name, day numbers and day dates in a response come from the
  validated request, never from the model. All model output passes through `validateItinerary`, which rebuilds
  the result field by field.
- **The traveller's name** is never sent to the provider, never logged, and never part of a cache key or value.
- **Logs are metadata only** (`lib/http/respond.js`): no destination, name, IP, headers, prompt or model output.
  Provider error messages contain the Groq organisation ID and are never logged or shown.
- **Errors to users** are a code and a fixed message from `lib/domain/error-codes.js`. HTTP 429 means the
  visitor's own request rate; provider limits are 503 with `AI_BUSY` or `AI_QUOTA_EXHAUSTED`.
- **One retry policy** (`lib/application/retry.js`). The SDK's own retries are off (`maxRetries: 0`); keep them off.
- **Dates** are `YYYY-MM-DD` calendar days handled in UTC by `lib/domain/dates.js`. Never `new Date('YYYY-MM-DD')`
  with local getters.
- **Rendering** must not depend on the current time (the page is prerendered; see `today` in `page.jsx`).
- **No new infrastructure or dependencies** without recording the reason in the HLD.

## Changing the AI integration

- Prompt or schema: edit `lib/application/itinerary-prompt.js` and **increment `PROMPT_VERSION`** (it is part of
  the cache key). Keep the schema in the strict subset: every property required, `additionalProperties: false`,
  no array-length keywords.
- Model or request parameters: read the current Groq documentation first (models, structured outputs, rate
  limits, deprecations). Model IDs are retired with as little as three weeks' notice. The model is
  configuration (`GROQ_MODEL`), never a constant in code.
- New failure mode: add the mapping in `groq-provider.js`, a row in HLD 8.4, an adapter test from a realistic
  response body, and a route test.
- Strict JSON mode is **not** a guarantee on Groq: about 1 in 5 measured generations were rejected for a schema
  error. The adapter recovers the itinerary from `error.failed_generation`; do not remove that path.

## UI and design

- Source of truth: `docs/design/DESIGN_SYSTEM.md` (tokens, type, components) and `docs/design/UX_RESEARCH.md`
  (why). Tokens are in the `@theme` block of `app/globals.css`. Skill: `ui-design-system`; agents:
  `ui-engineer` (builds), `ui-ux-researcher` (research and critique).
- No emoji, gradients outside the hero, heavy shadows or raw Tailwind palette colours. Saffron (the accent)
  only for the primary button, the hero's key words and markers; never as text on a light background.
- No fabricated claims: no logos, user counts, ratings or testimonials. Only what the product does.
- Fonts through `next/font`, icons as inline SVG; nothing loaded from another host (CSP).
- Screenshots of every screen at 1440 and 375 px, with `/api/trips` mocked:
  `npx next start -p 3300` then `node scripts/screenshots.mjs --base http://localhost:3300 --out <dir>`.

## Testing

- Tests never touch the network. The Groq adapter is tested through the real SDK with a stubbed `fetch`.
- Route tests install a container with a scripted provider (`test/fixtures.js`); each request uses a new client
  IP unless the test is about rate limiting.
- Use dates relative to today (`daysFromNow`): the API rejects past dates.
- Every bug fix gets a regression test. Never weaken an assertion to make a test pass.
- UI changes: run the browser tests; they cover desktop and 375 px.

## Common mistakes

- Importing without `.js` / `.jsx` → the Node test runner fails.
- Reading `process.env` outside `config.js`, or importing an adapter into `lib/application` → lint fails.
- Assuming HTTP 200 from the provider means a usable itinerary: check `finish_reason`, then `validateItinerary`.
- Copying a model name from a tutorial: most name models that Groq has withdrawn from self-serve plans.
- Estimating token counts. Use the provider's reported usage or record `null`.
