---
name: production-deployment
description: Deployment procedure for this app on Vercel - environment variables, CI gates, preview verification, the Gemini-to-Groq cutover checklist and rollback. Use when preparing a release, setting or reviewing environment variables, writing docs/engineering/DEPLOYMENT.md or the CI workflow, verifying a preview or production deployment, or rolling back.
---

# Production deployment

Plan: `docs/engineering/MIGRATION_PLAN.md` sections 1 ("Branching and deployment") and 2 ("Cutover and
rollback"). Variables: `docs/architecture/LLD.md` section 6. Infrastructure: `docs/architecture/HLD.md`
section 12.

## Hard rules

- **Never deploy to production without the owner's explicit approval.** No `vercel --prod`, no merge to
  `main`, no change to Production environment variables on your own initiative.
- Never force-push, rewrite history or skip hooks. Work stays on `feat/groq-migration`; `main` changes
  only through a reviewed pull request with CI green.
- Never print, log or commit a secret value. Refer to variables by name. `.env.local` is never
  committed.
- Do not remove `GEMINI_API_KEY` from Vercel or delete the Gemini code before milestone 12. They are
  the rollback path.

## Environment variables

The full table with defaults is LLD section 6. What each environment needs:

| Variable | Local `.env.local` | Preview | Production |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | Yes | Yes |
| `GROQ_MODEL` (`openai/gpt-oss-120b`) | Yes | Yes | Yes. Required; there is no default in code |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`, `KV_REST_API_TOKEN` from the Marketplace integration) | Optional; memory store without them | Yes, if D2 is approved | Yes, if D2 is approved |
| `ADMIN_TOKEN` | Optional | Yes | Yes. Long random value |
| `AI_DAILY_REQUEST_BUDGET`, `AI_DAILY_TOKEN_BUDGET` | Defaults | Lower values, so previews cannot drain the day | Defaults (900 and 180,000) |
| `GEMINI_API_KEY` | Not needed | — | Leave in place until milestone 12 |

- Preview and Production share one Groq organisation and therefore one quota. Keep preview budgets
  small, or use a separate Upstash database so counters do not mix.
- No variable is prefixed `NEXT_PUBLIC_`.
- Every variable is listed, without a value, in `.env.local.example`.
- After changing a variable in Vercel, redeploy: running deployments keep the old value.

## CI gate (GitHub Actions, on every pull request)

In order: `npm ci`, `npm run lint`, `npm test`, `npm audit --omit=dev`, `npm run build`. Node 22.
No secrets in CI and no real provider call. Branch protection on `main` requires this workflow.

## Preview verification

Every push to the feature branch gets a Vercel preview. Before calling a milestone deployable:

1. `npm run verify` passes locally; CI is green.
2. `GET /api/health` on the preview returns `status: ok`, `checks.ai: configured`, and `checks.store`
   is `ok` (or `memory` if no store is configured). No model name or key material in the body.
3. `GET /api/health?probe=ai` with the admin token returns `reachable`. This spends no tokens.
4. Guards: `GET /api/trips` → 405; non-JSON → 415; `Sec-Fetch-Site: cross-site` → 403; empty body →
   400; oversized body → 413.
5. With approval for the requests: one 2-day generation and, at cutover, one 14-day generation.
   Expect about 2–4 s (Estimate: HLD 8.6 measured 1.9 s for 1 day and 3.6 s for 3) and 11–13 s
   (Measured, HLD 8.6). Repeat the 2-day request and confirm `cache: "hit"`.
6. Read the `trip_request` log lines in Vercel: token counts present; no destination, name or key.
7. Security headers present (CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`).
8. Page checked in a browser at desktop width and 375 px.

## Cutover checklist (milestone 11)

1. Owner approval recorded in `docs/engineering/PROJECT_STATUS.md`.
2. Confirm in the Vercel dashboard: `main` is the production branch; pull requests get previews;
   function duration allows the route's `maxDuration` of 60 s.
3. Set the Groq, store and admin variables in the Production environment. The currently deployed code
   ignores them, so this is safe in advance.
4. Leave `GEMINI_API_KEY` in place.
5. Note the current production deployment's URL or ID: it is the rollback target.
6. Merge the single cutover pull request into `main`. Vercel deploys it.
7. Run preview-verification steps 2 to 7 against production.
8. Watch logs and `GET /api/usage` for the agreed period. Record results in `PROJECT_STATUS.md`.

## Rollback

- Promote the previous production deployment from the Vercel dashboard (Deployments → the noted
  deployment → Promote / Instant Rollback). It contains the Gemini code and its key is still
  configured, so it works immediately. No code change, no revert commit needed.
- Roll back when: health is not `ok` after deploy, generations fail with `SERVICE_UNAVAILABLE` or
  `INTERNAL`, or the error rate is clearly worse than before. Do not debug in production first.
- After a rollback, record what was seen (codes, `providerKind`, request IDs) and fix on the feature
  branch.
- A wrong model ID or key is a configuration fix: correct the variable and redeploy.

## Deliverable

For a release: a filled-in copy of the preview or cutover checklist, each line with PASS or FAIL and
its evidence (command and output, or what was seen in the dashboard), the number of real provider
requests spent, and the rollback target. For documentation work: `docs/engineering/DEPLOYMENT.md` with
exact setup steps, written from what was actually verified; anything not verified is marked as such.
