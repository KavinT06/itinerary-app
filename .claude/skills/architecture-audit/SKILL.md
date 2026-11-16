---
name: architecture-audit
description: Checks this repository's code against its layered design (domain, application, infrastructure, http, client) and reports violations with evidence and a priority. Use when reviewing a milestone's diff for boundary or coupling problems, when reviewing docs/architecture/HLD.md or LLD.md, or before approving a change that adds a module, a dependency or a new import between layers.
---

# Architecture audit

Source of truth: `docs/architecture/LLD.md` section 1 (directory structure, dependency rule, "Where
today's code goes") and `docs/architecture/HLD.md` sections 3 and 6. Read them before auditing. Do not
restate them in findings; cite the section.

During the migration some files have not moved yet. Judge a file by the layer it belongs to in the LLD
table, and report "not yet moved" separately from "violates the rule".

## Layer rules to check

| Layer | Path | May import |
|---|---|---|
| Domain | `lib/domain` | `lib/domain` only. No I/O, no `process.env`, no Next.js, no `Date.now()` at module load |
| Application | `lib/application` | `lib/domain`. Adapters arrive as arguments (`createGenerateTrip(deps)`) |
| Infrastructure | `lib/infrastructure` | `lib/application`, `lib/domain`. Starts with `import 'server-only'` |
| HTTP helpers | `lib/http` | `lib/application`, `lib/infrastructure`. Starts with `import 'server-only'` |
| Client | `lib/client` | `lib/domain` |
| Presentation | `app/` | Routes: `lib/http`, `lib/infrastructure/container.js`. Components and hooks: `lib/client`, `lib/domain` only |

Single-owner rules:

- `process.env` is read only in `lib/infrastructure/config.js`.
- Only `lib/infrastructure/container.js` chooses adapters.
- `groq-sdk` is imported only in `lib/infrastructure/ai/groq-provider.js`; `@upstash/redis` only in
  `lib/infrastructure/store/redis-store.js`.
- `AIProviderError` never crosses out of `lib/application`; routes see `AppError` only.
- Error codes live in `lib/domain/error-codes.js` and nowhere else.

## How to check import directions

Run these from the repository root with the Grep tool (patterns shown as ripgrep).

- **Domain is pure.** Pattern `from ['"](\.\./|next|server-only|groq-sdk|@upstash)` in `lib/domain`.
  Expected: no matches.
- **Application does not reach adapters.** Pattern `infrastructure/|/http/|from ['"]next` in
  `lib/application`. Expected: no matches.
- **Environment has one reader.** Pattern `process\.env` in `lib/` and `app/`. Expected: only
  `lib/infrastructure/config.js`.
- **Browser code stays out of the server.** Pattern `lib/(infrastructure|application|http)` in
  `app/components`, `app/hooks`, `app/page.jsx` and `lib/client`. Expected: no matches.
- **Server-only guard present.** Pattern `import 'server-only'` in `lib/infrastructure` and `lib/http`.
  Expected: every file.
- **Provider and store SDKs are contained.** Pattern `groq-sdk|@google/genai|@upstash/redis` in the
  whole repository except `node_modules`. Expected: only `lib/infrastructure/ai/`,
  `lib/infrastructure/store/redis-store.js`, `package.json` and the lock file.
- **Routes are thin.** Read `app/api/trips/route.js`. Expected: it matches the shape in LLD section 5,
  with no validation, limits or provider logic.

Then confirm the ESLint `no-restricted-imports` rule exists in the flat config and covers the same
directions. `npm run lint` passing is evidence only if the rule is present.

Also check:

- No circular imports between files in the same layer that hide a cross-layer dependency.
- New files sit in the directory the LLD names for that responsibility.
- New runtime dependencies are in the table in `docs/engineering/MIGRATION_PLAN.md` section 2. Anything
  else needs a recorded reason.
- Nothing in LLD section 10 ("What this design does not include") has been added.

## Priorities

Same scale as `docs/engineering/INITIAL_AUDIT.md`:

- **P0** secret reachable from the browser bundle, or data integrity broken.
- **P1** a boundary violation that removes a test seam or couples the use case to a provider or store.
- **P2** misplaced file, duplicated rule, configuration read outside the config module.
- **P3** naming, dead code.

## Deliverable

A list of findings, most severe first. You do not edit code. Each finding:

```
A-NN · <one-line title>                                   Priority: P0–P3
Where:    path:line
Rule:     LLD section N / HLD section N
Evidence: the import line or grep output, quoted. Label it Measured (command run) or Read (file read)
Impact:   what breaks or becomes untestable
Fix:      the smallest change that restores the rule
```

End with: the checks you ran and their result (including the ones that passed), and anything you could
not verify. A finding without quoted evidence is not reported.
