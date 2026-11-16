---
name: ai-quota-optimization
description: Rules for protecting this app's shared Groq free-plan quota - the protection layers, cache-key rules, per-client limits, daily budgets, the provider circuit and the retry policy. Use when working on lib/application/cache-key.js, limits.js, retry.js, generate-trip.js, the store adapters, or any change that could add a provider request or change how tokens are counted.
---

# AI quota optimisation

Design: `docs/architecture/HLD.md` section 9 (layers, shared store, store failure) and 8.5 (capacity),
`docs/architecture/LLD.md` sections 4.2 (step order), 4.4 (cache key), 4.5 (limits), 4.6 (retry).

## Why this matters here

The free-plan limits are per organisation, so every visitor shares them: 8,000 tokens per minute and
200,000 per day. A 14-day trip costs 5,800–6,700 tokens. That is about one long trip per minute and
about 30 long trips (or 90 three-day trips) per day in total. One wasted generation is a visible share
of the day.

## Order of protection

The use case runs these in the order in LLD 4.2. Do not reorder them.

1. Validate input (a request that cannot succeed costs nothing).
2. Per-client limit, **before** the cache, so cache hits cannot be used to probe without limit.
3. Cache lookup.
4. Join an in-flight generation for the same key in this instance.
5. Provider circuit.
6. Global daily budgets.
7. Generate, with the bounded retry.
8. Cache write, then usage counters.

Global counters increase only for real generations. Cache hits and joined requests cost nothing and
must not consume budget.

## Cache-key rules

- Key is `tripCacheKey` as specified in LLD 4.4. Included: `PROMPT_VERSION`, provider name, model,
  normalised destination (NFKC, lower-case, collapsed whitespace), `startDate`, `endDate`.
- Never in the key or the value: traveller name, client IP, request ID. The cached value is a
  `GeneratedItinerary` with no personal data; request fields are attached after the lookup.
- Exact dates stay in the key. Do not coarsen it to raise the hit rate.
- Only an itinerary that passed `validateItinerary` is written.
- A prompt, schema or instruction change increments `PROMPT_VERSION`. A model change needs nothing
  extra: the model is in the key.
- TTL is `CACHE_TTL_SECONDS` (default 86,400; `0` disables). A read error is a miss; a write error is
  logged and ignored.

## Limits and budgets

Defaults and keys are in LLD 4.5; all are configuration, fixed-window counters on `Store.incr`.

- Daily budgets sit 10 percent under the provider's limits (900 of 1,000 requests, 180,000 of 200,000
  tokens) to leave room for in-flight requests.
- There is **no** application per-minute token counter. Groq refuses an over-limit request in about
  250 ms at no cost and states the wait; do not duplicate that check.
- The token counter also counts generations Groq rejected for a schema error: they are charged.
- `clientId` is a hash of the IP. Raw addresses are never stored.
- When the provider reports `quota_exhausted`, set the circuit for the stated interval, bounded to
  between one minute and one hour, and stop calling until it clears.

## When to retry

At most one retry (two attempts), under one overall deadline of `AI_TIMEOUT_MS`. The SDK's own retries
are off. The full table is LLD 4.6.

| Retry once | Never retry |
|---|---|
| Connection error, provider 5xx (not charged) | `quota_exhausted`: it cannot succeed and spends more |
| `rate_limited`, after waiting the provider's `retry-after`, only if the wait plus a minimum attempt fits the deadline | `timeout`: the deadline is spent |
| `invalid_output`, only after recovery from `failed_generation` has failed | `auth`, `model_not_found`, `invalid_request`, `context_length` |
| `ItineraryFormatError` from a reject rule | `truncated`, `refused`, `aborted` |

A second `rate_limited` refusal becomes `AI_BUSY` with the provider's interval as the countdown.
Measured waits were 14–15 s after a long trip.

## Never estimate token counts

- Budgets, logs and usage counters use the provider's reported numbers only. If usage is absent, record
  `null` and do not add to the token budget; never substitute a character-count guess.
- The output cap `1000 + 600 × days` is a safety limit against runaway output, not a forecast.
- In reports, label every number Measured (with the command or source) or Estimate.

## Store failure

Follow the table in HLD section 9: counters fall back to the memory store for that request, a failed
circuit read is closed, a failed cache read is a miss, writes are skipped. Each fallback logs
`store_degraded`. No store failure may produce a user-visible error or stop a generation.

## Checklist

1. Does the change add a provider call on any path? If yes, justify it against the daily capacity above.
2. Step order in LLD 4.2 unchanged, or the LLD updated with the reason.
3. Tests exist for: cache hit, cache miss, joined request, each limit, circuit open, no retry on
   quota exhaustion, retry exhaustion, store failure on every operation.
4. Clock, random and sleep are injected in tests; no test waits in real time or uses the network.
5. No name, raw IP or key in any store key or value.

## Deliverable

The change and its tests, plus one line stating the effect on provider requests and tokens per user
action (for example "identical request within 24 h: 0 requests"), labelled Measured or Estimate.
