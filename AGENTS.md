# AGENTS.md — SHAHOO contributor and agent rules

These rules apply to human contributors and AI coding agents (Claude, Codex, Grok and similar).

## 1. Mandatory reading

1. [Project Master Report](docs/PROJECT_MASTER_REPORT.md) — single consolidated project history, implemented features, verification evidence, security review and current release status.
2. [Project Handoff](PROJECT_HANDOFF.md) — fast-start instructions and current repository boundaries.
3. [GitHub Issues](https://github.com/shahoo-workspace/shahoo/issues) — source of truth for active tasks, ownership, discussion and acceptance criteria.
4. [Documentation map](docs/README.md) — current technical runbooks and retained historical archive.

Do not use archived Batch reports as current status instructions. They exist only for phase-specific historical context.

## 2. Product and architecture

SHAHOO is a Persian-first (RTL) store for natural and organic products. The stack includes React 19, TypeScript, TanStack Start, Vite, Nitro, Drizzle, PostgreSQL, PGlite for local/test use, Tailwind, Zod and Zustand. Money is stored as integer IRR. Preserve the existing architecture and official SHAHOO visual identity.

## 3. Non-negotiable safety rules

- Never commit real secrets, tokens, passwords, database URLs, OAuth credentials, OTP codes, customer data or private payment/provider payloads.
- Never use Production or customer data in tests, builds, migrations, restore drills or scripts. Use synthetic data and disposable databases.
- Do not connect/enable live PayPing, SMS.ir, shipping or other providers without explicit owner approval for that task.
- Do not deploy, modify Production, run Production migrations, rotate provider credentials or rewrite public Git history without separate explicit authorization.
- Never weaken or delete tests merely to obtain a green CI result.
- Do not delete customer, order, payment, inventory or media data.
- Preserve fail-closed provider gates, server-side authorization, server pricing, transaction boundaries and idempotency.
- Preserve Persian copy, RTL, approved brand assets and existing storefront/admin behavior. No unrelated redesign or rewrite.
- Keep changes within the requested Issue/PR scope. Do not begin additional unrelated work.

## 4. Engineering rules

- Production requires a valid `DATABASE_URL`; a failed configured PostgreSQL connection must not fall back to PGlite.
- `npm run build` must not run migrations. Production migrations require the explicit protected migration procedure.
- Inventory, coupon, payment, refund, order and ledger writes must remain transactional and idempotent. Use row locks or conditional updates for competing writers.
- Do not trust client prices, inventory counts, permissions, callback data or account IDs.
- Do not log or return raw technical exceptions to customers. Keep logs useful but redact credentials and personal data.
- Migrations are additive and ordered under `migrations/`. Review the optional `migrations/auth/` separately; it is outside the shop migration glob.
- Do not delete a file because it appears old or duplicated. Search imports, route registrations, scripts, tests, workflows, runtime reads and compatibility fallbacks first. If historical, archive it rather than erasing unique evidence.

## 5. Commands and verification

Use the repository's current scripts:
```sh
npm ci
npm run typecheck
npm run lint
npm run test:project
npm run build
```

Use only local or disposable databases for tests. Distinguish actual PostgreSQL from PGlite. A single-connection PGlite test does not prove PostgreSQL concurrency. A CI Windows runner is not an owner VPS rehearsal. Provider mocks are not live Sandbox verification.

Every check must be labelled accurately:
- `EXECUTED — PASS`
- `EXECUTED — FAIL`
- `NOT EXECUTED — ENVIRONMENT LIMITATION`
- `NOT APPLICABLE`
- `STATIC REVIEW ONLY`

Never claim a test passed unless it ran on the identified source snapshot. Do not combine counts from different Batch snapshots.

## 6. GitHub workflow and handoff

- Read the relevant open Issue first; check for duplicates and dependencies.
- Create a feature branch from the latest `main`; do not commit directly to `main`.
- Make one focused PR with summary, risk, linked Issues, checks actually executed and checks deferred.
- Update the relevant Issue with source paths, evidence and remaining limitations. Close it only after acceptance criteria are met.
- Update [docs/PROJECT_MASTER_REPORT.md](docs/PROJECT_MASTER_REPORT.md) when a meaningful implementation, test, release or security fact changes. Do not create another Batch status/handoff document for each iteration.
- Keep `PROJECT_HANDOFF.md` short and current. Technical details belong in focused runbooks; historical Batch files belong in `docs/archive/`.


## 7. Reporting and documentation discipline

- **Do not create new report files, batch reports, status snapshots, handoff documents, audit summaries or duplicate issue registers.** Extend the existing files in place.
- The canonical current engineering/security/release record is `docs/PROJECT_MASTER_REPORT.md`; the canonical task tracker is GitHub Issues.
- Update `REMAINING_ISSUES.md` only as a compact index of GitHub Issues, never as a second issue database.
- Update `PROJECT_HANDOFF.md` only when the next agent's starting state or safety boundary changes; keep it concise.
- Update the relevant existing focused runbook (for example `docs/SECURITY_HARDENING.md` or `docs/RELEASE_CHECKLIST.md`) when operational instructions change.
- Before adding any documentation file, search the existing docs and archives. A new file is allowed only when the owner explicitly asks for it or an existing document cannot reasonably hold the material; obtain owner approval first.
- Prefer append/extend and targeted correction over parallel versions. Preserve historical evidence and do not overwrite it with an unverified current claim.
- Every agent must record what changed, the exact branch/PR or commit, checks actually executed, deferred checks and remaining risks in the existing master report and linked Issue. Never create a separate report to do so.


## 8. Issue-first execution, quota discipline and agent continuity

### 8.1 Issue lifecycle is mandatory for material work

- Before changing code for a material bug, security/privacy/reliability/performance problem, architectural concern, technical debt item, operational blocker or substantial feature, search open and recently closed Issues for duplicates. If no suitable Issue exists, create one **before implementation**.
- A material Issue must state the observed problem/context, evidence or reproduction path, impact, in-scope and out-of-scope work, acceptance criteria, dependencies/risks and the verification expected. Link related source files, PRs and other Issues where useful.
- Keep the durable technical explanation in the relevant existing source documentation/runbook and, where needed, in a focused code comment explaining a non-obvious invariant. The Issue is the canonical work tracker; code/docs preserve the technical knowledge. Do not create a parallel report or duplicate issue register.
- If a material problem is discovered but cannot be fixed in the current task, create or update its Issue, record the evidence and limitation, and leave it open. Do not silently leave a significant finding only in chat or an agent summary.
- When a fix is ready, update the same Issue with the resolving PR/commit, exact checks executed, acceptance-criteria results and any residual risk. Close the Issue **only after** the change is merged and the acceptance criteria have been verified. A proposed fix, local pass or open PR alone is not grounds to close it.
- Trivial copy/formatting changes or tiny corrections directly required by an already-tracked Issue may be included in that Issue/PR without creating another Issue. Check for duplicates before opening any new Issue.

### 8.2 Quota-aware and low-noise execution

- Prefer work in the agent's own local/sandbox environment: inspect only relevant files, reproduce the issue locally, run focused tests, typecheck/lint/build as proportionate, and use disposable local databases/fixtures where possible.
- Avoid unnecessary remote operations: no deployment merely to see whether a change worked, no repeated or speculative Vercel deployments, no unnecessary manual GitHub Actions runs, no duplicate PRs/branches, no repeated push cycles, and no noisy comments or status commits.
- Batch coherent code, tests and documentation changes into a reviewable checkpoint. Push when the work is ready for meaningful review rather than after every small edit. A PR should normally represent one coherent task and link its Issue.
- Use Vercel Preview or another hosted deployment only when hosted runtime, routing, environment integration or browser behavior cannot be adequately verified locally. Do not create a deployment for documentation-only changes or simple static checks unless the repository platform automatically requires one and the owner-approved workflow cannot be avoided.
- Prefer targeted local tests first, then one appropriate CI run at the PR checkpoint. Do not manually rerun a workflow that is already running or has adequate evidence. Do not weaken, skip, spoof or bypass required tests/status checks to save quota.
- Never change workflow triggers, deployment settings, branch protections or provider configuration merely to reduce usage without a separately scoped Issue and owner approval. Quota savings never justify weakening release/security gates.
- Do not perform live payment/SMS/shipping operations, Production database work, Production deployment or secret changes as a quota-saving shortcut or test method. Existing safety and explicit-approval boundaries remain in force.
- Report remote actions actually performed and why they were necessary; clearly label checks that could not be run in the available environment.

### 8.3 Fast onboarding and context continuity

- A replacement agent must not read the whole repository as an onboarding ritual. Use this progressive path and stop when enough context is established:
  1. Read this file (AGENTS.md) for rules.
  2. Read PROJECT_HANDOFF.md for the compact project map, current boundaries and next action.
  3. Read only the executive summary/current snapshot and the relevant topic section of docs/PROJECT_MASTER_REPORT.md; do not read the entire report by default.
  4. Use docs/README.md as an index only when a focused runbook is needed.
  5. Read the specific active GitHub Issue, linked PR and only the relevant source files, tests, schemas and scripts needed for that task.
- Never bulk-read docs/archive, old Batch reports, every route, every source file or every test unless the task explicitly requires a repository-wide audit. Use search, import/route tracing and targeted inspection to expand scope only when evidence requires it.
- For a ZIP-only handoff, begin with AGENTS.md, PROJECT_HANDOFF.md, docs/PROJECT_MASTER_REPORT.md (relevant sections only), docs/README.md and package.json. Then inspect a concise file tree and task-specific paths. Do not unzip-and-read every file. If GitHub is unavailable, record that Issues/PR state could not be verified rather than inventing it.
- Before coding, provide a short startup snapshot: supplied branch/commit, task Issue and acceptance criteria, relevant architecture/files, tests available, known blockers and any facts that remain unverified. Then move directly into the scoped work; do not ask the owner to restate information already in these documents.
- Preserve continuity by updating the existing Issue, this AGENTS.md only when contributor rules change, PROJECT_HANDOFF.md when the next agent's starting point/boundaries change, and the Project Master Report when implementation or verification facts materially change. Never create a new handoff/report for each agent switch.
- The handoff system and this policy are tracked in [Issue #47](https://github.com/shahoo-workspace/shahoo/issues/47).
