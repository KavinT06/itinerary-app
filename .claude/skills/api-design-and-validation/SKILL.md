---
name: api-design-and-validation
description: The HTTP contract, error-code table and validation rules for this app's API (POST /api/trips, GET /api/health, GET /api/usage). Use when adding or changing a route, a response field, an error code or status, request validation in lib/domain/trip-request.js, or model-output validation in lib/domain/itinerary.js (reject versus repair).
---

# API design and validation

Contracts are defined in `docs/architecture/LLD.md`: section 3 (validation rules), 4.7 (error codes),
5 (HTTP contract). This skill says how to apply them. If the code and the LLD disagree, stop and report
it; do not pick one silently.

## Response contract

- The contract is **additive**. Existing fields keep their names and types (`success`, `trip`, `error`,
  `retryAfter`). A browser tab running the previous JavaScript must keep working during a deployment.
- Success adds `requestId` and `cache` (`hit`, `miss`, `joined`).
- Errors add `code`, `retryable`, `field` (validation only) and `requestId`.
- Every response has `Cache-Control: no-store` and `X-Request-Id`.
- `trip.destination`, `startDate`, `endDate`, `createdBy`, `day` and `date` come from the validated
  request, never from the model or the cache.

## Error codes

The table is LLD 4.7. Codes and their `retryable` flag live in `lib/domain/error-codes.js`, the one file
both server and browser import. Rules:

- A new failure gets a new row in LLD 4.7, an entry in `error-codes.js`, a route test and a
  presentation in `GenerationStatus` (LLD section 8). All four, in one change.
- HTTP 429 means only "this client sent too many requests" (`RATE_LIMITED`). Provider limits are 503:
  `AI_BUSY` (short wait, countdown) or `AI_QUOTA_EXHAUSTED` (come back later, no retry). This is the
  fix for audit finding F-07; do not regress it.
- Messages are the fixed strings in LLD 4.7. No provider text, stack trace, model name or internal
  detail reaches the user. `VALIDATION_FAILED` is the only code with a variable message.
- `Retry-After` is sent whenever `retryAfterSeconds` is known, and `retryAfter` in the body matches it.
- `AIProviderError.kind` is mapped to a code in the use case. Routes never see a provider error.

## Validation at the boundary

Three inputs are untrusted; each is validated where it enters.

| Input | Where | How |
|---|---|---|
| HTTP request | Route, before the use case | Same-origin and content-type guard (403, 415); body read through `readJsonBody` with the size cap (413, 400). A valid body is under 400 bytes |
| User fields | `parseTripRequest` in `lib/domain/trip-request.js` | Returns `{ ok, value }` or `{ ok: false, error, field }`. Destination 1–150 characters, name 1–80, 1–14 days, start date not in the past and not more than two years ahead |
| Model output | `validateItinerary` in `lib/domain/itinerary.js` | LLD section 3. Output is rebuilt field by field, never spread |

The form and the API call the same `parseTripRequest`. Do not add a rule in only one place.

Dates are `YYYY-MM-DD` calendar days handled with `lib/domain/dates.js` (UTC arithmetic). Never
`new Date('YYYY-MM-DD')` with local getters.

## Reject versus repair

Reject when the **content** is wrong; repair when only the **form** is wrong.

- Reject (throw `ItineraryFormatError` with a `rule`; the use case may retry once): `shape`,
  `day_count`, `day_date`, `day_shape`, fewer than 3 valid activities in a day.
- Repair (deterministic, no error): `8:00` → `08:00`, drop an activity with an empty title or
  unparseable time, keep the first 8 activities, stable-sort by time, truncate over-long text, strip
  control, zero-width and bidirectional-override characters, set a bad budget to `null`.
- Never repair by inventing content, and never accept a day count that differs from the request.
- Every rule has its own test, plus fixtures for the two rejected generations measured in HLD 8.6 (a
  misspelt key, a missing field): both must be recovered by dropping one activity.

## Checklist

1. Route handler matches the shape in LLD section 5 and contains no business logic.
2. New or changed field is additive; no rename, no type change.
3. Error code, HTTP status, `retryable` and message match LLD 4.7 exactly.
4. Validation rule lives in `lib/domain`, with a test for the accepting and the rejecting case.
5. Route test covers status, headers, body shape and `requestId` for the new case, using a unique
   `x-forwarded-for`.
6. `GET /api/usage` returns 404 when `ADMIN_TOKEN` is unset; the health probe returns 401 without a
   valid token; health never returns the model name or key material.
7. LLD updated in the same change if the contract moved.

## Deliverable

The code change, the tests, and a short contract note: which fields, codes or statuses changed, and the
LLD section updated. If nothing in the contract changed, say so.
