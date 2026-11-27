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
