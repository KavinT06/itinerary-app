# Production Readiness Report — Itinera (AI travel planner)

- **Date:** 2026-11-16
- **Branch:** `feat/groq-migration`, based on `main` at `89a996d`
- **Verdict:** **Ready for a preview deployment. Ready for production once the owner completes the four
  account steps in section 9.** Nothing in the code blocks a release. Two areas are PARTIAL because they can
  only be verified on a real deployment.

Statuses: **PASS** verified by a test that was run or by inspection · **PARTIAL** implemented, not fully
verified · **FAIL** not implemented or failed verification.

---

## 1. Summary

| Area | Status | Evidence |
|---|---|---|
| Architecture | PASS | HLD and LLD approved 2026-11-16. Layer boundaries enforced by ESLint; independent architecture review: no P0 or P1 findings; its P2/P3 findings fixed or recorded (section 6) |
| AI integration | PASS | Groq adapter tested through the real SDK with a stubbed `fetch` for every row of the error-mapping table. Real generations through the full stack: 3 days in 4.1 s, 14 days in 23.8 s with one recovered rejection and one retry |
| Quota protection | PASS | Tests for cache hit and miss, joining, per-client request and token limits, global daily budget, circuit, retry policy, charging of failed generations, store outage |
| Backend | PASS | Route tests for every status and error code, body cap, guards, health, usage, logging hygiene |
| Frontend | PASS | 30 browser tests at desktop and 375 px: success, validation, loading, cancel, duplicate submission, each error presentation, overflow, text-not-markup, headers |
| Security | PASS, one owner action | `SECURITY_AUDIT.md`: 8 findings, 7 fixed with regression tests, 1 (old Google key in history) needs the owner |
| Performance | PARTIAL | Latency, tokens and cache measured against the real provider on one machine; no load test against a deployment (section 5) |
| Reliability | PASS | Failure-handling tests: provider errors, timeouts, cancellation, store outage and hang, malformed output, retry exhaustion |
| Deployment | PARTIAL | Production build passes; CI workflow written; deployment guide and rollback written. Not yet deployed or run on GitHub |
| Documentation | PASS | `CLAUDE.md` rewritten from the verified state; README, HLD, LLD, deployment, security and status documents current |

---

## 2. Original problems and what was done

| Audit finding | Root cause | Resolution | Status |
|---|---|---|---|
| F-01 Google key in git history | Key once hard-coded | Owner to confirm deletion; history not rewritten | Open (owner) |
| F-02 No tests | Never committed | 203 automated tests (173 unit and integration, 30 browser) | PASS |
| F-03 Lint broken | `next lint` deprecated, ESLint absent | ESLint 9 flat config with layer rules | PASS |
| F-04 No CI | — | `.github/workflows/ci.yml`: lint, tests, audit, build, browser tests on every PR | PARTIAL: not yet run on GitHub |
| F-05 Rate limit per instance, no global cap | In-memory counters | Store port, Upstash adapter with memory fallback, per-client request and token limits, global daily budget | PASS (code); Upstash not yet provisioned |
| F-06 Identical requests regenerate | No cache | Content-addressed 24 h cache and in-flight joining | PASS |
| F-07 Quota exhaustion shown as "wait a minute" | One error kind for two conditions | `AI_BUSY` vs `AI_QUOTA_EXHAUSTED`, provider `retry-after` honoured, circuit | PASS |
| F-08 Provider wired into the route | No seam | `AIProvider` port, Groq adapter, composition root | PASS |
| F-09 One long request, no recovery | No retry | One bounded retry; recovery of rejected generations from `failed_generation` | PASS |
| F-10 Output validation gaps | Lenient normalisation | Strict reject/repair rules, including date agreement, time format, minimum activities | PASS |
| F-11 Errors not machine-readable | Free-text errors | Additive coded contract with `code`, `retryable`, `retryAfter`, `field`, `requestId` | PASS |
| F-12 No structured logs or IDs | `console.log` | One JSON line per request; request IDs; usage counters | PASS |
| F-13 No body cap | — | 4 KB streamed cap | PASS |
| F-14 Scattered configuration | — | One validated config module | PASS |
| F-15–F-28 | Various P2/P3 | Addressed or recorded in `PROJECT_STATUS.md` | — |

---

## 3. Groq migration

| Item | Value |
|---|---|
| Provider and plan | Groq, free plan (owner's decision) |
| Model | `openai/gpt-oss-120b` (production status). Chosen over `openai/gpt-oss-20b` after live tests: 6 of 7 usable against 1 of 3 |
| Integration | Official `groq-sdk` 1.6.0, SDK retries off, strict JSON schema, `reasoning_effort: low`, reasoning hidden, output cap 1,000 + 600 per day |
| Generation | One request per trip; measured 1.9 s (1 day) to 11–13 s (14 days) per call |
| Known provider behaviour | Strict mode is not a guarantee: 2 of 10 measured generations rejected for a schema error. The adapter recovers the itinerary from `failed_generation` |
| Free-plan capacity | About one 14-day or six 1-day itineraries per minute, and 30–90 per day, shared by all visitors |
| Gemini | Code and dependency removed. The previous production deployment remains the rollback target |

---

## 4. Test and build results

All run on 2026-11-16 on Windows 11, Node 24.15.0.

| Command | Result |
|---|---|
| `npm run verify` (lint, tests, build, browser tests in sequence) | Exit 0 |
| `npm run lint` | Pass, no warnings. Rejects deliberate layer and `process.env` violations (checked with temporary files) |
| `npm test` | **173 tests, 173 pass, 0 fail** |
| `npm run build` | Pass. `/` 6.8 kB, 110 kB first-load JS; `/api/trips`, `/api/health`, `/api/usage` dynamic |
| `npm run test:e2e` | **30 passed** (15 desktop, 15 at 375 px) |
| `npm audit` / `npm audit --omit=dev` | 0 vulnerabilities |
| Real provider through the built app (`next start`) | 3-day trip: 200 in 4.1 s, 645 input / 1,410 output tokens; repeat: cache hit in 5 ms; 400, 403, 413 and 404 paths verified |
| `SMOKE_AI=1 npm run smoke:ai -- 14` | 14 days, 5 activities on 12 days and 4 on 2, 23.8 s, 2 attempts, 1 recovered rejection |

Tests by area: domain 4 files, application 5, infrastructure 3, HTTP 2, client 1, browser 1. Tests never touch
the network; the real-provider check is a separate script that refuses to run without `SMOKE_AI=1`.

---

## 5. Performance

**Measured** (one machine, one destination, real Groq free plan):

| Measure | Value |
|---|---|
| Generation time by trip length | 1.9 s (1 day), 3.6 s (3), 6.7 s (7), 8.9–9.4 s (10), 11.2–12.6 s (14) |
| Full request, 3 days, through the built app | 4.1 s |
| Cache hit | 5 ms |
| Tokens per trip | 1,251 (1 day) to 5,776–6,700 (14 days); reasoning 35–116 |
| Rate-limit refusal from Groq | 0.25 s, `retry-after` 14–15 s, no cost |
| Concurrent identical requests | One provider call (tested with a scripted provider) |
| Page weight | 110 kB first-load JS |

**Estimated, not measured:** behaviour under real concurrent load on Vercel; cold-start time; latency from
Upstash (HTTP calls in the same region, expected to be single-digit milliseconds). A 14-day trip that needs a
retry can take 25–40 s, within the 60 s function limit.

---

## 6. Independent reviews

Four reviews were run by separate agents that did not write the code: code, architecture, security and QA.

| Review | Findings | Outcome |
|---|---|---|
| Code review | 1 blocking, 3 should-fix, 3 nits | All fixed: budget charging of failed generations; joining a cancelled generation; cost lost when the starter left; store timeouts adding up past the function limit; shared error object; disconnect during body read; doc drift. Regression tests in `test/application/review-regressions.test.js` |
| Architecture review | 0 P0/P1, 4 P2, 8 P3 | Fixed: lint coverage (SDKs, `process.env`, domain allow-list), cached values now validated, error text in one module, `server-only` on all adapters, start-date window shared with the form, container errors handled. Documents corrected. Not changed: the container is still rebuilt by hand in `test/fixtures.js` and the smoke script (acceptable duplication) |
| Security review | 8 findings | 7 fixed with regression tests (`test/application/security-regressions.test.js`); S-01 needs the owner |
| QA review | 3 defects, 19 coverage gaps proven by mutation, 6 weak assertions | Defects fixed; 66 tests added that kill all 19 mutants; always-true assertion removed; Upstash client retries turned off; pre-cancelled requests no longer reach the provider |

---

## 7. QA verification

The QA agent verified the implementation against the LLD and HLD rather than against the author's tests. It made
19 single-line mutations that all pre-existing tests survived, and added 66 tests (6 files) that catch every one.
Its tests are in `*-spec.test.js`, `itinerary-rules.test.js`, `error-codes-contract.test.js`
and `retry.test.js`. Three of them exposed real defects, all fixed:

- A request cancelled during the retry wait still started a second attempt.
- The `INTERNAL` log line could contain request data through the stack's first line.
- An undocumented 30-second cap on waiting out Groq's per-minute limit contradicted the design; the design's
  rule ("if it fits the deadline", with 15 s left for the attempt) is now implemented.

---

## 8. Remaining limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Free-plan capacity | About 30–90 itineraries a day for all visitors | Cache; per-visitor limits; Developer plan raises it without code changes |
| No monitoring or alerting | Failures are only visible in logs and the usage report | Log drain or a scheduled health check (not configured) |
| AI venues and prices are unverified | Some venues and addresses may be wrong; long trips may repeat venues despite the prompt rule | Stated on every itinerary; repeats measured at 6 of 70 activities in one 14-day trip |
| Rate limits without Upstash are per instance | Weaker protection | Provision Upstash (owner step 3) |
| Vercel Hobby plan | Non-commercial use only | Pro plan for a commercial launch |
| Owner endpoints not rate-limited | Guessing a 32-character token is impractical | Minimum length enforced |
| `PROJECT_STRUCTURE.md` and `prompt.md` | The owner's working files, untracked; the former describes the Gemini version | Not committed |

---

## 9. Owner actions before production

1. **Vercel environment variables** (Production and Preview): `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-120b`.
   Keep `GEMINI_API_KEY` until the new version has run for two weeks.
2. **Confirm the old Google key is deleted** in Google AI Studio (S-01).
3. **Recommended:** Upstash Redis from Vercel Storage (free); `ADMIN_TOKEN` of 32+ random characters;
   branch protection on `main` requiring the CI check.
4. Check the preview deployment: health, one short and one 14-day trip. Then merge.

## 10. External dependencies and cost

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby | $0 |
| Groq | Free | $0 (limits in section 3) |
| Upstash Redis | Free (optional) | $0 up to 500,000 commands a month; estimated use about 70,000 |
| GitHub Actions | Public repository | $0 |

New runtime dependencies: `groq-sdk`, `@upstash/redis`. Removed: `@google/genai`. New development
dependencies: `eslint`, `eslint-config-next`, `@eslint/eslintrc`, `@playwright/test`.

## 11. Deployment and rollback

See `DEPLOYMENT.md`. Rollback is "Promote to Production" on the previous deployment in Vercel; it works for
as long as `GEMINI_API_KEY` remains set.
