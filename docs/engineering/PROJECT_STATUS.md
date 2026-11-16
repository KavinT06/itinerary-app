# Project Status

Updated after every milestone. Last update: 2026-11-16.

## Current state

- **Milestones 0–10 complete** on branch `feat/groq-migration`. Milestone 11 (deployment) is waiting on the
  owner's account steps. Milestone 12 (clean-up) is mostly done early.
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
| 11 | Deployment | **Waiting on owner** | DEPLOYMENT.md written; production build passes |
| 12 | Clean-up | Mostly done | Gemini code, dependency and setup guide removed; README replaced |

## Decisions

| Decision | Outcome |
|---|---|
| D1 Groq plan and model | Free plan, `openai/gpt-oss-120b` |
| D2 Shared store | Upstash Redis, optional at runtime |
| D3 Cache lifetime | 24 hours |
| D4 Claude Code files in git | Tracked (project `.gitignore` re-includes them) |
| D5 Browser tests | Playwright |

## Checks last run (2026-11-16)

| Check | Result |
|---|---|
| `npm run lint` | Pass |
| `npm test` | See PRODUCTION_READINESS_REPORT section 4 |
| `npm run build` | Pass |
| `npm run test:e2e` | 30 passed |
| `npm audit` | 0 vulnerabilities |
| Real Groq generation through the built app | Pass (3 and 14 days) |

## Waiting on the owner

1. Groq variables in Vercel (Production and Preview); keep `GEMINI_API_KEY` for rollback.
2. Confirm deletion of the old Google key (S-01).
3. Recommended: Upstash Redis, `ADMIN_TOKEN` (32+ characters), branch protection on `main`.
4. Review the pull request and the preview deployment, then merge.

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
