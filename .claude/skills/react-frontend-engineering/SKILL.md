---
name: react-frontend-engineering
description: Frontend standards for this React 19 / Next.js 15 app - presentational components, the useTripGeneration state machine, error presentation by error code, accessibility, 375 px layout checks and hydration safety. Use when changing app/page.jsx, app/components, app/hooks, lib/client/api-client.js or the browser tests in test/e2e.
---

# React frontend engineering

Design: `docs/architecture/HLD.md` section 7 and `docs/architecture/LLD.md` section 8 (hook, state
diagram, presentation table) and section 9 (browser tests).

## Scope limits

- Visual design follows `docs/design/DESIGN_SYSTEM.md` and the `ui-design-system` skill. Restyling is
  allowed; changing behaviour (the hook, the API client, error codes and their messages) is not.
- The browser-test contract (labels, button texts, banner titles, headings in `test/e2e/trip.spec.js`)
  changes only deliberately, with the test updated in the same change and no assertion weakened.
- No state library, no data-fetching library, no component library. Tailwind CSS 4 only.
- Browser code imports `lib/domain` and `lib/client` only. Never `lib/infrastructure`,
  `lib/application` or `lib/http`.
- Relative imports include the extension (`./TripForm.jsx`, `./useTripGeneration.js`).

## Components

- `TripForm.jsx`, `ItineraryView.jsx` and `GenerationStatus.jsx` are presentational: props in, events
  out, no fetch, no timers.
- `app/page.jsx` composes them and holds no request logic.
- Model output is rendered as text. No `dangerouslySetInnerHTML`, and no `href` or `src` built from
  model output.
- The "AI-generated, not verified" notice stays prominent: measured 14-day itineraries contained
  repeated venues and invented-looking addresses (HLD 8.5).

## The hook

`useTripGeneration()` returns `{ status, trip, error, cooldown, submit, cancel, reset }` and follows the
state diagram in LLD section 8.

- States: `idle`, `submitting`, `success`, `error`. A `submit` while `submitting` is ignored by the
  state machine itself, not only by a disabled button.
- Input is validated with the shared `parseTripRequest` before any request. An invalid field returns to
  `idle` with a field error and sends nothing.
- `cancel` aborts the fetch through an `AbortController` and returns to `idle` with no error shown.
  Abort on unmount too.
- `error` is `{ code, message, retryable, retryAfterSeconds, field }`, taken from
  `TripRequestError` thrown by `lib/client/api-client.js`. Never branch on the message text.
- The cooldown is a courtesy for the user, not a control; the server enforces limits.
- A response without a `code` (an older deployment, a proxy error page, a network failure) is treated
  as `INTERNAL` and must still render a usable banner.

## Error presentation

`GenerationStatus` picks the presentation from `error.code` using the table in LLD section 8. The points
that matter:

- `RATE_LIMITED`, `AI_BUSY`: countdown from `retryAfterSeconds`; the button re-enables at zero.
- `AI_QUOTA_EXHAUSTED`: "come back later", no countdown and no retry invitation.
- `VALIDATION_FAILED`: message beside the field named in `error.field`; no cooldown.
- Codes come from `lib/domain/error-codes.js`. A code added on the server needs a presentation here in
  the same change.

## Nothing time-dependent during render

The page is prerendered. `new Date()`, `Date.now()`, `Math.random()` or locale formatting of "now"
during render causes a hydration mismatch. Read the current date in an effect and keep it in state (the
`today` state in `page.jsx`). Dates are `YYYY-MM-DD` strings handled with `lib/domain/dates.js`; never
`new Date('YYYY-MM-DD')` with local getters.

## Accessibility

- Every input has a visible `<label>`; a field error is linked with `aria-describedby` and
  `aria-invalid`.
- Error banners use `role="alert"`; the loading panel and countdown use `aria-live="polite"`, and the
  countdown must not announce every second.
- On error, focus moves to the first invalid field or the banner. On success, focus moves to the
  itinerary heading.
- Everything works by keyboard, with a visible focus ring. Buttons are `<button>`, disabled with the
  `disabled` attribute.
- Text and controls meet 4.5:1 contrast. Respect `prefers-reduced-motion` for the loading animation.

## Verification

1. `npm run build && npx next start`, then check in a browser at desktop width and at 375 px: no
   horizontal scroll, touch targets at least 44 px, long destination names and long activity text wrap.
2. Without spending quota: mock `/api/trips` at the network layer (Playwright route, or stub
   `window.fetch`) to exercise success and every error code in LLD section 8.
3. Browser tests in `test/e2e` cover: success, each error presentation, duplicate submission, cancel,
   and layout at 375 px. They never call the real API.
4. Browser console shows no hydration warning and no error.
5. `npm run verify` passes.

## Deliverable

The change, the browser tests, the `npm run verify` output, and a list of what was checked in a real
browser at each width. If something could not be checked in a browser, say so explicitly.
