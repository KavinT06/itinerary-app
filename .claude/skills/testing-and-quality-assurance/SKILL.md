---
name: testing-and-quality-assurance
description: How tests are written and run in this repository - node:test, test layout by layer, fakes and fixtures, no network, a regression test for every fix. Use when adding or changing any test under test/, when fixing a bug, when verifying someone else's change, or before claiming that work passes.
---

# Testing and quality assurance

Boundaries per layer (what is real and what is faked): `docs/architecture/LLD.md` section 9. Scenarios
required to close each milestone: `docs/engineering/MIGRATION_PLAN.md` section 2, "Evidence required".

## Non-negotiable rules

1. **Runner:** Node's built-in `node:test` with `node:assert/strict`. No Jest, no Vitest, no new test
   dependency. Browser scenarios use Playwright in `test/e2e` only.
2. **No network in tests.** Nothing run by `npm test` contacts Groq, Upstash or any other host. The only
   real provider call is `scripts/smoke-ai.mjs`, run by name with its confirmation variable, never by
   `npm test` or CI.
3. **A regression test for every fix.** Write the test first, watch it fail for the right reason, then
   fix. A fix without a test that failed before it is not done.
4. **Never weaken an assertion to make a test pass.** Do not loosen a matcher, delete a case, add
   `skip` or `todo`, widen a tolerance or change an expected value unless the specified behaviour
   changed in the LLD. If a test looks wrong, report it and stop.
5. **A claim that tests passed includes the command and its output.**
6. **The author of a change does not verify it.** When verifying, write your own cases from the LLD, not
   from the implementation.

## Commands

```bash
npm test                                                        # all unit and integration tests
node --conditions=react-server --test test/path/to/file.test.js # one file
npm run lint
npm run verify                                                  # lint + tests + build; run before saying "done"
```

`--conditions=react-server` makes `import 'server-only'` resolve to a no-op. Without it, any test that
imports `lib/infrastructure` or `lib/http` throws on import.

## Layout

```
test/domain/           pure unit tests; nothing faked
test/application/      use case with a scripted fake provider, memory store, injected now/random/sleep
test/infrastructure/   Groq adapter with stubbed fetch and recorded fixtures; store and wrapper tests
test/http/             real route handler and use case, injected container
test/fixtures/         recorded provider responses, sample itineraries
test/e2e/              browser tests, /api/trips mocked at the network layer
```

Files are `*.test.js`. Relative imports include the extension (`../../lib/domain/dates.js`); the runner
fails without it. Until a module moves to its layer directory, its test may sit at the path that
mirrors the module's current location.

## Fakes and fixtures

- **Provider:** a scripted fake implementing `AIProvider` (LLD 4.1) that returns or throws a queued
  list of results and records each call. Use it to assert call counts ("no second call on
  `quota_exhausted`").
- **Store:** the real memory store. To test outages, wrap it in a store whose chosen operation throws
  or hangs.
- **Time:** inject `now`, `random` and `sleep`. No real waiting, no `setTimeout` in tests, no
  dependence on the wall clock beyond "today".
- **HTTP to Groq:** stub `globalThis.fetch` and restore it in `afterEach`. Fixtures follow the shapes
  measured in `docs/architecture/HLD.md` sections 8.4 and 8.6: the 429 body with `retry-after: 15`,
  the `json_validate_failed` body with `failed_generation` (one with a misspelt key, one with a missing
  field), and a response to a 14-day request that contains only one day.
- Fixtures contain no real key, organisation ID or personal data.
- **Dates:** compute from today with `lib/domain/dates.js`. The API rejects past dates, so hard-coded
  dates rot.
- **Rate limiter state persists across tests in a file.** Use a unique `x-forwarded-for` per route
  test, or a fresh container.

## What a good test here checks

- Behaviour stated in the LLD, by its public contract: status, `code`, headers, body shape, call
  counts. Not private helpers.
- One rule per test for `validateItinerary` (LLD section 3): the accepting case, the reject or repair
  case, and the `rule` name on the error.
- Every row of the error-mapping table (HLD 8.4) and every `AppError` code (LLD 4.7).
- Failure paths as carefully as success: store down on each operation, timeout, abort, second refusal
  after a wait, malformed JSON, oversized body.
- Negative assertions that matter: a log line contains no destination, name or key; the provider
  request contains no traveller name; the cached value contains no personal data.

## Checklist before reporting

1. New behaviour has tests; a fix has a test that failed before the fix.
2. No `only`, `skip` or `todo` left behind; no assertion loosened.
3. No test reaches the network (stub `fetch` to throw on any unexpected URL).
4. Tests pass when run alone and in the full suite, twice in a row.
5. `npm run verify` passes.

## Deliverable

The test files, then a report: the commands run and their output (pass and fail counts), what is
covered, what is deliberately not covered and why, and any defect found, stated as expected versus
actual with the failing test's name. Defects in application code are reported, not fixed, unless the
task says otherwise.
