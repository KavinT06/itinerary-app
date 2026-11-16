---
name: security-audit
description: Security review checklist and report format for this app - secrets, API abuse, prompt injection, model-output handling, logs, cache sharing, headers and dependencies. Use when reviewing a milestone for security, scanning the repository or its git history for secrets, or writing docs/engineering/SECURITY_AUDIT.md.
---

# Security audit

Boundaries and controls are defined in `docs/architecture/HLD.md` section 11. Known findings are in
`docs/engineering/INITIAL_AUDIT.md` (F-01, F-13, F-16, F-20, F-26). Verify each control by running or
reading something; do not assume it from the design.

Report real, reproducible issues. Do not propose speculative rewrites, and do not test a leaked
credential against a live service.

## Checklist

**Secrets and environment**
- `GROQ_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_TOKEN` are read only in
  `lib/infrastructure/config.js`. No `NEXT_PUBLIC_` AI or store variable exists.
- After `npm run build`, no key pattern or `GROQ_API_KEY` string appears in `.next/static`.
- `.env*` files are ignored by git; `.env.local.example` has names only.
- No response, log line or error message contains any part of a key. `/api/health` returns no model
  name and no key material.
- `ADMIN_TOKEN` comparison is constant-time; `/api/usage` is 404 when the token is unset.

**Cross-origin, CSRF, CORS**
- `POST /api/trips` rejects `Sec-Fetch-Site: cross-site` (403) and non-JSON content types (415). No
  `Access-Control-Allow-Origin` header is sent.
- This guard stops other websites, not scripts (F-16). Abuse control is the limits below.

**Abuse and rate limiting**
- Body over the size cap is rejected before parsing (413).
- Per-client limits and the global daily budgets work, and still work per instance when the store is
  down. The client ID stored is a hash, not the IP.
- The per-client limit runs before the cache lookup.
- The browser cooldown is not relied on for anything.

**Prompt injection and model output**
- The destination is inserted JSON-quoted; the traveller's name is never sent to the provider.
- The system instruction is **not** counted as a defence. The controls are: strict schema, independent
  `validateItinerary`, length limits, field-by-field rebuild, text-only rendering.
- Try injection destinations (instructions, HTML, script tags, very long text, control, zero-width and
  bidirectional-override characters) through `parseTripRequest` and, with a fake provider returning
  hostile content, through `validateItinerary`.
- No `dangerouslySetInnerHTML`; no link, image or redirect built from model output.
- Identity, dates and routing never come from the model.

**Cache**
- The cache key is the full normalised destination plus dates, model and prompt version; the value has
  passed validation and contains no name, IP or request ID. Confirm one visitor cannot plant content
  under another visitor's ordinary request (HLD section 11 records this as a point to test).

**Logs**
- A log line for a request with a known destination and name contains neither, nor the key, headers,
  raw IP, prompt, model output or provider message text (which carries the organisation ID). A test
  asserts this.

**Headers and content**
- `next.config.mjs` still sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` and, in production builds only, CSP. HSTS is not set there: it was seen on the
  live site (audit section 1) and can only be confirmed on a deployment. The
  `'unsafe-inline'` script source is a recorded trade-off (F-20); re-assess, do not silently change.
- No server-side fetch of a user-supplied URL exists (SSRF). If one is introduced, flag it.

**Dependencies**
- `npm audit` and `npm audit --omit=dev` report 0. New packages are only those in
  `docs/engineering/MIGRATION_PLAN.md` section 2.

## Scanning history for secrets without printing them

Never print a matched secret to the terminal, a report or a commit. Print only the location, the
length and a hash.

```bash
# Which commits and files contain a key-shaped string (names only)
git log --all --oneline -G 'gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}' --name-only

# Distinct matches as length + SHA-256, never the value
git grep -ohE 'gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}' $(git rev-list --all) 2>/dev/null \
  | sort -u | while read -r k; do printf '%s chars  sha256:%s\n' "${#k}" \
  "$(printf '%s' "$k" | sha256sum | cut -c1-16)"; done

# Is a historical key the one in use locally? Compare hashes, not values
```

Add patterns for Upstash tokens and `mongodb+srv://` as needed. A key found in history is treated as
compromised: the fix is rotation and deletion at the provider, confirmed by the owner. Do not rewrite
public history.

## Priorities

P0 secret exposed or exploitable now. P1 quota drain, data leak to logs or cache, or missing control at
a trust boundary. P2 hardening. P3 informational.

## Deliverable

You do not edit application code. Produce the content for `docs/engineering/SECURITY_AUDIT.md`:

1. Scope, commit audited, date, and what was not tested and why.
2. A table of every checklist item with PASS, FAIL or NOT VERIFIED and its evidence.
3. Findings, most severe first:

```
S-NN · <title>                                  Priority: P0–P3
Where:      path:line, or URL and request
Evidence:   command and output, or the file line. Labelled Measured, Read or Inferred. Secrets redacted
Impact:     what an attacker gains, and what they need to do it
Fix:        the smallest change
Regression: the test that will prove the fix
```

A finding with no evidence is listed under "Not verified", not as a finding.
