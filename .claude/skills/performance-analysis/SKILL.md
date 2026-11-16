---
name: performance-analysis
description: How to measure and report performance for this app - request latency, token usage, cache effectiveness, concurrency behaviour and build size - without spending the shared Groq quota. Use when asked for latency, token, cache, concurrency or bundle figures, when writing a measurement script in scripts/, or when a change claims to be faster or cheaper.
---

# Performance analysis

Baselines: `docs/architecture/HLD.md` section 8.6 (provider latency and tokens) and
`docs/engineering/INITIAL_AUDIT.md` section 1 (build size). Capacity reasoning: HLD 8.5.

## Rules

1. **Label every number.** `Measured` (command, date, sample count), `Docs` (official page and date
   read), `Estimate` (the arithmetic shown) or `Claimed` (source named, not re-verified). Never mix them
   in one column without the label.
2. **Do not spend quota without approval.** The free plan allows about 30 long itineraries a day for
   all visitors. Concurrency and load tests run against a mock provider. State the number of real
   provider requests a plan needs and get approval first.
3. **Never estimate token counts.** Use the provider's reported usage from the log line or usage
   counters.
4. **Small samples are not rates.** Report the count ("6 of 7"), not a percentage, and say what the
   sample cannot establish.
5. **Measure the production build**, not `npm run dev`.
6. You may write to `scripts/` and reports only. Do not change application code; recommend instead.

## What to measure, and how

| Area | Measure | How | Baseline or target |
|---|---|---|---|
| Server overhead | Route latency excluding the provider | `npm run build && npx next start`, mock provider with zero delay, 50 sequential requests, read `durationMs` from the `trip_request` log lines | Report p50 and p95. Should be a few milliseconds |
| Cache | Latency and provider calls for an identical second request | Same setup; send a request twice | Second response has `cache: "hit"` and 0 provider calls |
| In-flight joining | Provider calls for N identical concurrent requests | Mock provider with a 2 s delay; send 10 at once | 1 provider call; 9 responses with `cache: "joined"` |
| Concurrency | Behaviour with distinct concurrent requests | Mock provider with realistic delays (2 s for 1 day to 13 s for 14 days); 20 distinct requests | No error other than the designed limits; memory stable |
| Limits | Requests admitted per client per minute | 10 requests in a minute from one client ID | 5 admitted, 5 `RATE_LIMITED` with `Retry-After` |
| Store degradation | Added latency when the store is unreachable | Point the Redis adapter at a dead host | Each store call gives up at 1 s; request still succeeds; `store_degraded` logged |
| Provider latency and tokens | Per trip length | From production or preview log lines and `/api/usage`, not new requests | HLD 8.6: 1.9 s and 1,251 tokens (1 day) to 11–13 s and 5,800–6,700 tokens (14 days) |
| Retry cost | Added wait after a per-minute refusal | Mock a 429 with `retry-after: 15` | One wait, one retry, inside the 50 s deadline |
| Build | Route sizes and first-load JS | `npm run build` output | Audit baseline: `/` 5.33 kB, 108 kB first-load JS. Flag any growth and name the import that caused it |
| Client bundle hygiene | Server code or SDKs in the browser bundle | Search `.next/static` for `groq-sdk`, `@upstash`, `GROQ_API_KEY` | No matches |

Latency percentiles need at least 30 samples; below that, list the raw values.

## Scripts

- Measurement scripts go in `scripts/`, are run by name, and are never part of `npm test` or CI.
- A script that can contact the real provider requires an explicit confirmation environment variable,
  prints the number of requests it will send before sending, and never prints the key.
- Scripts start their own mock provider or use the injected container; they do not edit application
  files to add timing code.
- Record the exact command, Node version, commit hash and date in the report.

## Interpreting results

- The binding constraint is the provider's token quota, not compute (HLD section 13). A change that
  saves milliseconds but adds a provider request is a regression.
- Compare against the same trip length. Token cost per day falls as trips get longer (about 600 output
  tokens per day short, about 370 long).
- The rule for revisiting single-request generation is in HLD 8.5: more than 1 in 20 long itineraries
  unusable after recovery and one retry. Report against that rule when data exists.

## Deliverable

A report (returned as text unless told to write a file) with:

1. **Environment:** commit, date, Node version, build mode, real or mock provider, real requests spent.
2. **Results table:** metric, value, label (Measured, Estimate, Claimed), sample count, command.
3. **Comparison** with the baseline above, and whether any difference is larger than run-to-run noise.
4. **Findings:** each with evidence and a recommended change. No recommendation without a measurement.
5. **Not measured:** what was left out and why.
