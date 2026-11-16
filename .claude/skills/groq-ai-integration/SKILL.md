---
name: groq-ai-integration
description: Standards for this project's Groq integration - the AIProvider contract, request parameters, the measured token and latency figures, the error-mapping table and recovery from failed_generation. Use when writing or changing lib/infrastructure/ai/groq-provider.js, the prompt or JSON schema, the model ID or any request parameter, scripts/smoke-ai.mjs, or the adapter's tests and fixtures.
---

# Groq AI integration

Design: `docs/architecture/HLD.md` section 8 (facts 8.1, model 8.2, contract 8.3, error mapping 8.4,
strategy 8.5, measurements 8.6) and `docs/architecture/LLD.md` sections 4.1, 4.3, 4.6, 4.7.

## Check the official documentation first

Before changing the model, a request parameter, the schema dialect or an error mapping, re-read the
relevant page and note the date in your report. Groq changes models at short notice and most tutorials
are out of date.

- https://console.groq.com/docs/models
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/errors
- https://console.groq.com/docs/deprecations
- https://console.groq.com/docs/reasoning

Never use `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`: they left the Free and Developer plans on
2026-08-16. Never use a preview model.

## Contract

The adapter implements `AIProvider` (LLD 4.1): `name`, `model`, `generateStructured(req)`,
`checkAvailability({ signal })`. It returns `{ data, usage, provider, model, latencyMs }` and throws only
`AIProviderError(kind, message, { status, retryAfterSeconds, cause })`. It does not validate the
itinerary, retry, cache or log; those belong to the use case.

## Request standards

| Setting | Value |
|---|---|
| SDK | `groq-sdk`, constructed with `maxRetries: 0` and an explicit timeout. The SDK default of 2 unbounded retries must never be active |
| Model | `GROQ_MODEL` from config. Selected: `openai/gpt-oss-120b`. No default in code |
| Structured output | `response_format` of type `json_schema`, `strict: true`. Schema from `lib/application/itinerary-prompt.js` |
| Schema subset | Every property in `required`; `additionalProperties: false` on every object; no array-length keywords |
| Reasoning | `reasoning_effort` from `GROQ_REASONING_EFFORT` (default `low`), `include_reasoning: false` |
| Output cap | `max_completion_tokens` always set: `1000 + 600 × days`, capped by `AI_MAX_OUTPUT_TOKENS`. The provider default is 1,024 |
| Streaming | Off. It is not supported with structured outputs |
| Deadline | `timeoutMs` from the caller; the caller's `signal` is passed through |
| Prompt | Destination inserted JSON-quoted. The traveller's name is never sent |
| Key | From `lib/infrastructure/config.js` only. Never logged, returned or put in an error message |

Any change to the system instruction, prompt or schema increments `PROMPT_VERSION`.

## Measured facts (HLD 8.6, 2026-11-16, free plan, one destination)

- Free-plan limits per model: 8,000 tokens/min, 200,000 tokens/day, 30 requests/min, 1,000 requests/day.
- `openai/gpt-oss-120b` totals: 1 day 1,251 tokens in 1.9 s; 3 days 2,190 in 3.6 s; 7 days 3,681 in
  6.7 s; 10 days 4,780–4,906 in about 9 s; 14 days 5,776–6,700 in 11–13 s.
- Input is 575–680 tokens including the schema. Reasoning at `low` is 35–116 tokens.
- A day costs about 600 output tokens in a short trip and about 370 in a long one.
- Strict mode is not a guarantee: 2 of 10 generations were rejected by Groq with a schema error (a
  misspelt key; a missing field). 120b was usable in 6 of 7 runs, 20b in 1 of 3 (one returned 1 day
  instead of 14).
- Per-minute refusal: HTTP 429 in about 250 ms, `code: rate_limit_exceeded`, `type: tokens`,
  `retry-after: 15`, no cost, not counted against daily requests.
- `max_completion_tokens` is not charged at admission. The allowance refills continuously at about
  133 tokens/s. Each model has its own counters.
- Not measured: failure rates, other destinations or languages, the per-day 429. Do not state these as
  facts.

## Error mapping

Implement HLD 8.4 exactly; do not copy the table into code comments. Rules that are easy to get wrong:

- Classify by HTTP status first. Use `error.code` only to refine. An unknown shape falls to the safe
  default for that status.
- 400 with `code: json_validate_failed`: parse `error.failed_generation` and return it as `data` so
  `validateItinerary` can repair it. Throw `invalid_output` only if that text is absent or not JSON.
  The field is undocumented; its absence must not throw anything else.
- 429: `quota_exhausted` if the message names a per-day limit, or `retry-after` is over 60 s, or
  `x-ratelimit-remaining-requests` is `0`. Otherwise `rate_limited` with `retryAfterSeconds`.
- `finish_reason: "length"` is `truncated`; `message.refusal` is `refused`; empty or non-JSON content is
  `invalid_output`.
- Our own deadline is `timeout`; the caller's abort is `aborted`. Keep them distinct.
- Provider messages contain the organisation ID. Never log or return them; keep `status`, `kind` and
  the provider `code` only.
- Report `usage` from the provider's numbers, or `null`. Never estimate.

## Checklist

1. Official pages re-read for whatever you are changing.
2. One fixture per row of HLD 8.4 in `test/fixtures/`, built to the measured response shapes, including
   both rejected-generation cases.
3. Adapter tests stub `fetch`; no test contacts Groq (see the `testing-and-quality-assurance` skill).
4. `scripts/smoke-ai.mjs` is the only real call. It runs only when invoked by name with its explicit
   confirmation variable, generates a 2-day trip, and prints token counts and latency but not the key.
5. A real request spends shared quota (about 30 long trips a day for all visitors). Get approval for the
   number of requests before running any.

## Deliverable

The adapter or prompt change, its fixtures and tests, the commands run with their output, the
documentation pages checked with the date, and the count of real provider requests spent (normally 0).
