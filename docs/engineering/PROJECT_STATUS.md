# Project Status

Updated after every milestone. Last update: 2026-11-17.

## Current state

- **Groq migration live in production** (https://superitineraryapp.vercel.app) since PR #3 was merged on
  2026-11-16; health is `ok` with AI configured, and a real generation was verified after the merge.
- **UI redesign in review** on branch `feat/ui-redesign` (milestone 13): new design system ("Dusk Horizon",
  Manrope), every screen redesigned, research and design documents in `docs/design/`.
- **Release readiness:** see [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md).
- **Security:** see [SECURITY_AUDIT.md](SECURITY_AUDIT.md). One owner action open (S-01).

## Milestones

| # | Milestone | State | Evidence |
|---|---|---|---|
| 0 | Audit and design | Done, approved 2026-11-16 | INITIAL_AUDIT, HLD, LLD, MIGRATION_PLAN |
| 1 | Safety net | Done | `node:test` suite, ESLint 9 with layer rules, `npm run verify`, CI workflow, rewritten `CLAUDE.md`, 8 agents and 10 skills in `.claude/` |
| 2 | Configuration and layers | Done | `lib/domain`, `application`, `infrastructure`, `http`, `client`; lint enforces the directions (verified with deliberate violations) |
| 3 | Provider contract | Done; Gemini step skipped (HLD 8.3) | `AIProvider` port; `generateTrip` use case |
| 4 | Groq adapter | Done | Adapter tests for every error mapping; `scripts/smoke-ai.mjs` |
| 5 | Measure and decide | Done | HLD 8.6; `openai/gpt-oss-120b` selected |
| 6 | Output validation and prompt | Done | Reject/repair rules; prompt forbids repeated venues and street numbers; `PROMPT_VERSION = 2` |
| 7 | Quota protection | Done | Cache, joining, per-client request and token limits, daily budget, circuit, retry |
| 8 | API contract and observability | Done | Coded errors, request IDs, body cap, JSON logs, usage counters, `/api/health`, `/api/usage` |
| 9 | Frontend | Done | `useTripGeneration`, `GenerationStatus`, cancel button, Playwright tests |
| 10 | Security audit | Done | SECURITY_AUDIT.md; 7 of 8 findings fixed |
| 11 | Deployment | Done 2026-11-16 | PR #3 merged; production health `ok`; real generation checked after merge |
| 12 | Clean-up | Mostly done | Gemini code, dependency and setup guide removed; README replaced |
| 13 | UI redesign | In review (`feat/ui-redesign`) | UX_RESEARCH, DESIGN_SYSTEM, before/checkpoint/after screenshots; 58 browser tests; first-load JS 113 kB |

## Decisions

| Decision | Outcome |
|---|---|
| D1 Groq plan and model | Free plan, `openai/gpt-oss-120b` |
| D2 Shared store | Upstash Redis, optional at runtime |
| D3 Cache lifetime | 24 hours |
| D4 Claude Code files in git | Tracked (project `.gitignore` re-includes them) |
| D5 Browser tests | Playwright |

## Checks last run (2026-11-17, branch `feat/ui-redesign`)

| Check | Result |
|---|---|
| `npm run lint` | Pass |
| `npm test` | 173 passed, 0 failed |
| `npm run build` | Pass; first-load JS for `/` 113 kB (110 kB before the redesign) |
| `npm run test:e2e` | 58 passed (desktop and 375 px; `trip.spec.js` unchanged, `ui.spec.js` new) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Real Groq generation through the redesigned page (local production build) | Pass: 2 days, 200 in 2.7 s, focus on the trip title, no overflow, no console errors |

## Waiting on the owner

1. Review the UI redesign pull request and its preview deployment, then merge.
2. Confirm deletion of the old Google key (S-01).
3. Recommended: Upstash Redis, `ADMIN_TOKEN` (32+ characters), branch protection on `main`.
4. Optional: a product name ("AI Travel Planner" describes a category; `app/components/brand.js`).

## Known issues and unverified items

| Item | Notes |
|---|---|
| Generation failure rate on `openai/gpt-oss-120b` | Sample of 9 real generations; production usage counters will measure it |
| Groq's daily-limit 429 | Never observed; detected three ways (HLD 8.4) |
| Vercel's `x-real-ip` for IPv6 clients | From Vercel's documentation, not tested |
| Repeated venues on long trips | 6 of 70 activities in one 14-day test after the prompt change |
| No monitoring or alerting | Logs and `/api/usage` only |
| Container wiring duplicated in `test/fixtures.js` and `scripts/smoke-ai.mjs` | Accepted; small |
| `PROJECT_STRUCTURE.md`, `prompt.md` | Owner's working files, not committed. The former describes the Gemini version |
