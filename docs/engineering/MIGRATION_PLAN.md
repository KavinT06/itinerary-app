# Migration Plan — Gemini to Groq, and the Engineering Setup Around It

- **Status:** Approved 2026-11-16. Milestones 0–10 implemented on `feat/groq-migration`; deployment (11) awaits the owner. Progress is tracked in `PROJECT_STATUS.md`.
- **Date:** 2026-11-15
- **Design:** [HLD.md](../architecture/HLD.md), [LLD.md](../architecture/LLD.md).
  Findings: [INITIAL_AUDIT.md](INITIAL_AUDIT.md).

---

## 1. How the work is sequenced

Three rules shape the order.

1. **Tests come before changes.** The first milestone adds tests of today's behaviour, so every later
   step can be checked against them.
2. **Structure changes and behaviour changes are separate milestones.** Milestones 2 and 3 move code
   without changing what it does. Milestones 4 onwards change behaviour, one area at a time.
3. **The provider is switched behind a seam that was first proved with the old provider.** Gemini is
   moved behind the new contract before Groq is added, so a failure can be attributed to the contract or
   to Groq, not to both at once.

### Branching and deployment

- All work happens on `feat/groq-migration` (created; `main` is untouched).
- Milestone 1 contains no runtime code change. It goes to `main` through its own pull request, so that CI
  protects `main` from then on.
- Milestones 2 to 10 accumulate on the feature branch. Each push gets a Vercel preview deployment.
  Nothing reaches production.
- Cutover is one reviewed pull request into `main` in milestone 11.
- No history is rewritten and nothing is force-pushed.

---

## 2. Milestones

Every milestone ends with: `npm run verify` (lint, tests, build) passing, the changed files reviewed,
documentation updated, and `PROJECT_STATUS.md` updated with what was run and what it printed.

| # | Milestone | What changes | Evidence required to close it | Needs from the owner |
|---|---|---|---|---|
| 0 | Audit and design | Four documents | This review | Approval; decisions D1–D5 |
| 1 | Safety net | `node:test` suite describing current behaviour of dates, request validation, output normalisation, the limiter and the route. ESLint 9 with a flat config. `npm run verify`. GitHub Actions workflow. Corrected `CLAUDE.md`. Agents and skills | Tests pass locally and in CI. Lint passes. Build passes | Enable branch protection on `main` |
| 2 | Configuration and layers | Files move into `domain`, `application`, `infrastructure`, `http`, `client`. One validated config module. Error types. An ESLint rule that enforces import directions | The milestone 1 tests pass with only import paths changed | — |
| 3 | Provider contract (Gemini step skipped, see HLD 8.3) | `generateTrip` use case extracted from the route. `AIProvider` port. Existing Gemini code moved behind it. Use-case tests with a scripted fake provider | Route tests unchanged and passing. One real generation on a preview deployment matches today's behaviour | Approval to spend one Gemini request |
| 4 | Groq adapter | `groq-sdk` with automatic retries off. Adapter, including recovery from `failed_generation`. A test for every row of the error-mapping table (HLD 8.4), from fixtures built to the response shapes measured in milestone 5. `scripts/smoke-ai.mjs` | Adapter tests pass with no network. Smoke script produces a valid 2-day itinerary | `GROQ_API_KEY` in the Vercel Preview environment (it is already in `.env.local`) |
| 5 | Measure and decide | **Done early, 2026-11-16**, from a scratch script outside the repository. Thirteen real requests | Results in HLD 8.6. Model chosen: `openai/gpt-oss-120b`. Output-token formula set. Single-request strategy confirmed. Per-minute refusal captured | — |
| 6 | Strict output validation and prompt quality | `validateItinerary` with the reject and repair rules in LLD section 3. Prompt changes so long trips do not repeat venues or invent street numbers; `PROMPT_VERSION` introduced | One test per rule, including reordered days, wrong dates, malformed times, too few activities, unexpected fields, and fixtures reproducing the two kinds of rejected generation seen in milestone 5 (a misspelt key, a missing field). A before-and-after count of repeated venues in a 14-day itinerary | Approval to spend about six Groq requests |
| 7 | Quota protection | Store port with memory and Redis adapters and the resilient wrapper. Cache. In-flight joining. Per-client limits. Global budgets. Provider circuit. Retry policy | Tests for: cache hit and miss, joined requests, each limit, store outage on every operation, retry exhaustion, no retry on quota exhaustion | Upstash database (if D2 is approved) |
| 8 | API contract and observability | Coded errors, request IDs, body size cap, structured log line, usage counters, health checks, usage report | Route tests for every status and code. A test that no log line contains the destination, name or key | `ADMIN_TOKEN` value |
| 9 | Frontend | `useTripGeneration` hook. Error presentation by code. Cancel button. Browser tests | Browser tests for success, each error presentation, duplicate submission, cancel, and layout at 375 px | — |
| 10 | Security audit | `SECURITY_AUDIT.md`. Fixes for confirmed high-priority findings | Each finding has evidence; each fix has a test | — |
| 11 | Performance, deployment, cutover | Concurrency test against a mock provider. `DEPLOYMENT.md`. Preview smoke test. Production environment variables. Cutover pull request | Measured latency and concurrency figures. Health and one generation verified in production | Approval to deploy |
| 12 | Clean-up and report | Gemini adapter and `@google/genai` removed. `README.md` replaced. `GEMINI_API_SETUP.md` deleted. `PRODUCTION_READINESS_REPORT.md` | Report with PASS, PARTIAL or FAIL per area, each backed by a test or inspection | Removal of the Gemini key from Vercel |

### Dependencies to be added and removed

| Package | Type | Milestone | Reason |
|---|---|---|---|
| `eslint`, `eslint-config-next` | Development | 1 | Lint is currently non-functional |
| `groq-sdk` | Runtime | 4 | Official SDK, no dependencies of its own |
| `@upstash/redis` | Runtime | 7 | Shared store adapter (D2) |
| `@playwright/test` | Development | 9 | Browser tests (D5) |
| `@google/genai` | Removed | 12 | No longer used |

No other packages are planned.

### Cutover and rollback

1. Set the Groq and store variables in Vercel's Production environment. The currently deployed code
   ignores them, so this is safe to do in advance.
2. Leave `GEMINI_API_KEY` in place.
3. Merge the cutover pull request. Vercel deploys it.
4. Check `/api/health`, generate one short and one long itinerary, and read the log lines.
5. **Rollback:** promote the previous production deployment from the Vercel dashboard. That deployment
   contains the Gemini code and its key is still configured, so it works immediately. No code change is
   needed.
6. Remove the Gemini key and code in milestone 12, after the new deployment has been stable for an agreed
   period.

---

## 3. Claude Code setup

Formats below were checked against the official Claude Code documentation on 2026-11-15.

### 3.1 Something to fix first

`CLAUDE.md` and `.claude/` are excluded from this repository by the global ignore file at
`C:\Users\ASUS\.gitignore`. Agents, skills and the project guide would therefore exist only on this
machine. If D4 is approved, the project `.gitignore` gets three lines that re-include `CLAUDE.md` and
`.claude/` while keeping `.claude/settings.local.json` ignored. The result is checked with
`git check-ignore` before anything is committed.

### 3.2 Project instruction file

`CLAUDE.md` is rewritten from the verified state of the repository and kept under 200 lines, which is the
length the documentation recommends. It will contain:

- What the application is, in three lines.
- Commands that actually exist.
- The layer rules and where each kind of code belongs.
- The non-negotiable rules: secrets, no fabricated data, the trust boundary, no name to the provider,
  nothing personal in logs or the cache.
- How to run one test file, and that tests never touch the network.
- Links to the HLD, LLD and status file, rather than copies of them.

The current file's references to commands and documents that do not exist are removed (audit F-19).

### 3.3 Agents

Files are `.claude/agents/<name>.md`, with `name`, `description`, `tools` and `skills` in the frontmatter
and the instructions as the body.

| Agent | Responsibility | Tools | May edit | Preloaded skills |
|---|---|---|---|---|
| `architecture-reviewer` | Reviews HLD and LLD and checks code against them: boundaries, coupling, scalability | Read, Grep, Glob | Nothing. Reports findings | `architecture-audit` |
| `backend-engineer` | Routes, use cases, validation, errors, limits, cache, and their tests | Read, Edit, Write, Grep, Glob, Bash | `lib/domain`, `lib/application`, `lib/http`, `lib/infrastructure/store`, `app/api`, matching tests | `nextjs-backend-engineering`, `api-design-and-validation`, `testing-and-quality-assurance` |
| `ai-infrastructure-engineer` | Groq adapter, prompt and schema, retry, token budgets, usage, smoke script | The same, plus WebFetch and WebSearch | `lib/infrastructure/ai`, the prompt and retry modules, `scripts/`, matching tests | `groq-ai-integration`, `ai-quota-optimization` |
| `frontend-engineer` | Components, the hook, the API client, accessibility, responsive behaviour | Read, Edit, Write, Grep, Glob, Bash | `app/` except `app/api`, `lib/client`, browser tests | `react-frontend-engineering` |
| `security-reviewer` | Secrets, API security, prompt injection, input and output handling, dependencies | Read, Grep, Glob, Bash | Nothing. Reports findings with evidence | `security-audit` |
| `qa-engineer` | Writes and runs tests independently of the author; failure simulation | Read, Edit, Write, Grep, Glob, Bash | `test/` only | `testing-and-quality-assurance` |
| `performance-engineer` | Latency, tokens, cache effectiveness, concurrency, build size | Read, Write, Grep, Glob, Bash | `scripts/` and reports only | `performance-analysis` |
| `code-reviewer` | Reviews each milestone's diff for regressions, duplication, shortcuts and compliance with the design | Read, Grep, Glob, Bash | Nothing | — |

Things to know about how this works in practice:

- The `tools` field restricts which tools an agent has. It cannot restrict which paths an agent edits.
  The "may edit" column is an instruction in each agent's prompt, and the main session enforces it by
  giving agents non-overlapping work.
- The four agents that add the most are the ones whose value is independence from the author:
  `code-reviewer`, `qa-engineer`, `security-reviewer` and `architecture-reviewer`. The application is
  about a thousand lines, so most implementation steps are small enough that the main session will do
  them directly and then hand the result to those reviewers. The four engineer agents are used where
  work can genuinely run in parallel on separate files, such as the Groq adapter and the store adapters.
- The exact YAML form of the `skills` field could not be confirmed from the documentation text that was
  retrieved. It will be checked when the first agent file is created.
- Creating the first file in a new `.claude/agents/` directory requires restarting the session before the
  agents are available.

Rules for collaboration:

- The main session is the lead. It approves designs, assigns work, and integrates.
- Two agents never edit the same file at the same time.
- The author of a change does not review or verify it.
- A claim that tests passed must include the command and its output.
- Disagreements between agents are resolved by the lead and recorded in `PROJECT_STATUS.md`.

### 3.4 Skills

Files are `.claude/skills/<name>/SKILL.md` with `name` and `description` in the frontmatter. Each is a
short checklist with the project's standards and the expected deliverable. Shared facts live in `CLAUDE.md`
and the design documents and are linked, not repeated.

| Skill | Contents |
|---|---|
| `architecture-audit` | The layer rules; how to check import directions; the finding format with evidence and priority |
| `groq-ai-integration` | The provider contract; request parameters; the error-mapping table; "check the official documentation before changing a model or parameter", with the pages to read |
| `api-design-and-validation` | The response contract; the error-code table; validation at the boundary; reject versus repair |
| `ai-quota-optimization` | The protection layers; cache-key rules; when to retry and when not to; never estimate token counts |
| `nextjs-backend-engineering` | Thin route handlers; `server-only`; runtime and duration settings; no environment access outside the config module |
| `react-frontend-engineering` | Presentational components; the hook's state machine; error presentation by code; accessibility and 375 px checks; nothing time-dependent during render |
| `security-audit` | The checklist from the brief; how to scan history for secrets without printing them; the security audit document format |
| `testing-and-quality-assurance` | Test layout; fakes and fixtures; no network in tests; a regression test for every fix; never weaken an assertion |
| `performance-analysis` | What to measure and how; labelling measurements and estimates separately; the report format |
| `production-deployment` | Environment variables; preview then production; the cutover checklist; rollback |
