# Security Audit — Groq migration

- **Date:** 2026-11-16
- **Scope:** branch `feat/groq-migration` (working tree on top of `89a996d`): `app/`, `lib/`, `test/`,
  `next.config.mjs`, `package.json`, `.gitignore`, `.env.local.example`, and the full git history.
- **Reviewer:** the `security-reviewer` agent, independent of the code's author. Fixes were made afterwards by
  the lead and checked with the regression tests named below.
- **Not tested:** anything that needs the live deployment or a real provider call — HSTS on the deployed site,
  Vercel's handling of client-IP headers and IPv6, Groq's daily-limit 429, and how the model actually responds
  to injected destinations. `.env.local` was not read.

## Summary

| ID | Finding | Priority | Status |
|---|---|---|---|
| S-01 | Google API key in public git history (audit F-01) | P0 until confirmed | **Open — owner action:** confirm deletion in Google AI Studio |
| S-02 | One client, within its own limits, could spend the whole global daily budget | P1 | **Fixed** |
| S-03 | Provider calls that failed after generating were not counted against the daily budget | P2 | **Fixed** |
| S-04 | Client identity: IPv6 rotation inside a /64 and spoofable `x-forwarded-for` gave fresh buckets | P2 | **Fixed** (Vercel behaviour itself not verified) |
| S-05 | The memory store could evict the daily-budget and circuit counters under key pressure | P2 | **Fixed** |
| S-06 | Invisible format and tag characters survived text cleaning | P3 | **Fixed** |
| S-07 | The log line for an unexpected error included the error's message | P3 | **Fixed** |
| S-08 | `ADMIN_TOKEN` had no minimum length and guesses are not limited | P3 | **Fixed** (minimum length); guesses still unlimited |
| — | `.env.local.example` was matched by `.env*` and could not be committed | Informational | **Fixed** |

No finding allows the API key to leak, model output to execute in the browser, or one visitor to receive
content produced from another visitor's different input.

## What was checked and passed

| Area | Result | Evidence |
|---|---|---|
| Secrets in code | Pass | `process.env` read only in `lib/infrastructure/config.js` (lint now enforces it). No `NEXT_PUBLIC_` AI variable. No key pattern in `.next/static` or `.next/server` |
| Secrets in git | Pass apart from S-01 | No `gsk_` pattern anywhere in history. One `AIza…` key in commits `71e5d95`, `3a89ae3`, `c425a5b`. MongoDB strings in history are placeholders |
| `.env*` files | Pass | `.env.local` ignored; `.env.local.example` contains placeholders only and is now trackable |
| Key and provider text in responses and logs | Pass | Route tests assert that the key, the organisation ID in provider messages, the destination, the name and the IP appear in neither |
| Admin endpoints | Pass | SHA-256 then `timingSafeEqual`; `/api/usage` is 404 when no token is configured |
| Cross-site and content type | Pass | 403 for `Sec-Fetch-Site: cross-site`, 415 for non-JSON, no CORS headers |
| Body size | Pass | `Content-Length` check and a streamed cap of 4 KB, including an understated `Content-Length` |
| Prompt injection | Pass | Destination is JSON-quoted; the name is never sent; the output is constrained by a schema and then rebuilt field by field by `validateItinerary`; identity, dates and day numbers never come from the model |
| Model output in the browser | Pass | No `dangerouslySetInnerHTML`, no links, images or redirects built from model output; a browser test confirms markup is shown as text |
| Text recovered from `failed_generation` | Pass | Goes through the same `validateItinerary` as normal output |
| Cache sharing | Pass | Key = normalised destination, dates, provider, model, prompt version. No code point is kept by cleaning but erased by key normalisation (all 1,114,112 checked), so one input cannot be planted under another. Cache entries are now validated on read |
| Headers | Pass | CSP (production), `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies, no `X-Powered-By` |
| `'unsafe-inline'` in `script-src` (audit F-20) | Accepted | No HTML sink exists; React escapes text; `connect-src`, `object-src`, `frame-ancestors` and `base-uri` are restricted |
| SSRF | Pass | Outbound calls go only to Groq and Upstash at configured URLs |
| Dependencies | Pass | `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities |

## Findings and fixes

### S-01 · Google API key in public git history — Open

- **Where:** `app/index.js` and `app/api/trips/utils.js` in commits `71e5d95`, `3a89ae3` and `c425a5b` (removal).
  Not in the current tree.
- **Impact:** anyone can read the key from GitHub and use it if it is still active.
- **Action:** the owner confirms in Google AI Studio that the key is **deleted**, not only restricted. Rewriting
  history is not recommended: the repository is public and the key must be treated as known regardless.

### S-02 · One client could spend the global daily budget — Fixed

- **Was:** 30 requests per client per day × about 6,300 tokens for a 14-day trip ≈ the whole 180,000-token
  budget. Measured: one client succeeded 29 times, after which every visitor got `AI_QUOTA_EXHAUSTED`.
- **Fix:** a per-client daily token allowance, `RATE_LIMIT_TOKENS_PER_DAY` (default 30,000), charged with the
  provider's reported usage of every generation the client started and checked with the other client limits
  (`lib/application/limits.js`). At least six clients are now needed to exhaust the budget.
- **Test:** `test/application/security-regressions.test.js` "S-02".

### S-03 · Failed generations were not counted — Fixed

- **Was:** the budget was charged only when a generation succeeded. Truncated, refused and rejected generations,
  which Groq charges for, were invisible to it, and recovered generations counted no tokens.
- **Fix:** the Groq adapter marks every failure that happened after generation (`generated: true`) and attaches
  the reported usage when there is one. The use case charges the budget for every such attempt; when the provider
  reports no usage it charges a conservative upper bound (output cap + 800). Reported-usage counters stay
  provider-reported only, with a separate `unreported_usage` count.
- **Tests:** `test/application/review-regressions.test.js` "R-01".

### S-04 · Client identity — Fixed

- **Was:** the client key was the raw `x-real-ip`, falling back to `x-forwarded-for`. Eight addresses in one
  IPv6 /64 got eight buckets, and off Vercel a rotating `x-forwarded-for` was never limited.
- **Fix:** only `x-real-ip` is used (Vercel sets it and clients cannot override it); IPv6 addresses are grouped
  by /64 before hashing (`lib/http/request.js`, `normalizeClientIp`). Off Vercel, a proxy must set `x-real-ip`,
  or every visitor shares one bucket — documented in `DEPLOYMENT.md`.
- **Test:** "S-04". **Not verified:** that Vercel always overwrites `x-real-ip`, including for IPv6 clients.

### S-05 · Memory store evicted budget counters — Fixed

- **Was:** when the memory store reached 10,000 keys it evicted the oldest, which included the day's budget and
  circuit counters. Without Upstash, about 10,000 distinct cheap requests could reset an instance's budget.
- **Fix:** keys beginning `gen:`, `tok:`, `circuit:` and `usage:` are never evicted. There are only a few per day.
- **Test:** "S-05".

### S-06 · Invisible characters — Fixed

- **Was:** only a handful of zero-width and bidirectional characters were removed. Tag characters (used to hide
  instructions in text a person cannot see), LRM/RLM, the soft hyphen and C1 controls reached the prompt and
  the page.
- **Fix:** every Unicode format character (`\p{Cf}`) is removed except the zero-width joiner and non-joiner,
  which Indic and Persian scripts need; C1 controls become spaces; Hangul fillers are removed; truncation never
  splits a surrogate pair; budgets above 10¹⁰ are discarded.
- **Tests:** both "S-06" tests.

### S-07 · Error message in logs — Fixed

- **Fix:** an unexpected error is logged with its name and stack frames only; the first stack line, which
  repeats the message, is dropped. Store failures are logged by error name only.
- **Test:** "S-07".

### S-08 · Admin token strength — Fixed in part

- **Fix:** an `ADMIN_TOKEN` shorter than 32 characters is ignored (the owner endpoints stay disabled) and a
  `config_warning` is logged. It does not disable the rest of the service.
- **Remaining:** the owner endpoints are not rate-limited. With a 32-character random token, guessing is not
  practical, and a successful guess discloses only usage counters.
- **Test:** "S-08".

## Residual risks

| Risk | Why it is accepted |
|---|---|
| The browser-origin check does not stop scripts | It is a CSRF-style guard for browsers. Scripts are limited by the per-client and global limits |
| Without Upstash, limits are per server instance | Documented; Upstash is recommended for production |
| Several concurrent requests can pass the daily-budget check together | The overshoot is bounded by the number of requests in flight; the budget is set 10 % below the provider's limit |
| The first visitor's random variation is what later visitors with identical input see for 24 hours | That output passed validation; this is the intended effect of the cache |
| AI-generated venues and prices are not verified | Stated on every itinerary |
