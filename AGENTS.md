# AGENTS.md — SHAHOO project instructions (portable)

For any coding agent (Claude, Grok, Codex or similar) and for human contributors. It contains no platform-specific tooling. The original scaffold-specific file is kept as history in `docs/archive/AGENTS.grok-platform-original.md`; ignore it for current work.

## 1. Read first, in this order
1. `PROJECT_HANDOFF.md` — canonical, current cross-agent handoff, verified infrastructure history, test evidence, release gates, and next actions.
2. `REMAINING_ISSUES.md` and `BATCH_09_COMPREHENSIVE_AUDIT.md` — current issue register and detailed audit evidence.
3. `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` — long-form historical continuity; consult relevant sections, but do not treat old embedded status/next-step text as current.
4. `docs/README.md` — documentation map; open older batch reports only when investigating their specific change.
Where documents disagree, use current source and the canonical `PROJECT_HANDOFF.md`, then the current issue/evidence registers. Older batch reports are historical claims to verify, not current instructions.

## 2. Project
SHAHOO is a Persian (RTL) online store for natural and organic products. Stack: React 19, TanStack React Start (server functions), Nitro/Vercel, Vite, TypeScript, Drizzle ORM on PostgreSQL (embedded PGlite only for local development and tests), Tailwind, Zod, Zustand. Money is stored as integer IRR (shown as toman, ÷10). Single currency `IRR`.

## 3. Hard constraints (from the owner; do not violate)
- No real payment gateway, SMS/OTP provider, carrier or shipping API unless a batch explicitly says so. Payment, SMS and shipping stay disconnected; mock paths must be impossible in production.
- Never connect to a production or hosted database from tests, scripts or builds. Never commit or print secrets; only `.env.example` is allowed in the repository.
- Preserve the SHAHOO brand, palette, RTL layout and working behaviour. No rewrites, no redesign, no unrelated refactoring.
- Do not delete customer, order, payment, inventory or media data, and do not delete or weaken tests to obtain a green run.
- Prices, stock, totals and permissions are decided on the server. The client never supplies authoritative prices or inventory.
- Work in the batch scope you are given. Do not start the next batch; stop and wait for owner approval.

## 4. Engineering rules
- Environment policy fails closed: development-only behaviour needs an explicit flag and a development-like `NODE_ENV`; production without `DATABASE_URL` must fail, never fall back to PGlite. `npm run build` must not run migrations.
- Stock and coupon changes use single conditional `UPDATE`s inside a transaction; do not replace them with read-then-write. Money, order, payment, refund and inventory-ledger changes are transactional and idempotent.
- Serialize competing writers with row locks (`SELECT … FOR UPDATE`) or conditional updates, and prove a race with real separate connections where possible. A sequential or single-connection test is not race proof.
- Do not clear persisted client data before the server has confirmed the operation that replaces it. Do not swallow errors silently; show a Persian message and offer a retry where appropriate. Never show raw technical errors to customers.
- User-facing text is Persian and RTL. Keep new UI inside the existing design language, with labels, focus states and keyboard access.
- Use existing project conventions and types; avoid `any`. Comments only where behaviour is non-obvious.
- Migrations are additive and ordered under `migrations/`; the optional auth schema lives in `migrations/auth/` and is not applied by the shop migrator.

## 5. Commands
`npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `npm test`, `npm run build`. Run the build with `DATABASE_URL` unset or pointing at a disposable local database. Pure tests also run with `node --experimental-strip-types --test <file>` (some need `--import ./scripts/ts-alias-register.mjs`). Real-PostgreSQL media race check: `PG_RACE_CONFIRM=disposable PGHOST=<local throwaway server> scripts/pg-media-race.sh`.

## 6. Verification and reporting
Run what the environment allows and report each check with exactly one status: EXECUTED — PASS, EXECUTED — FAIL, NOT EXECUTED — ENVIRONMENT LIMITATION, NOT APPLICABLE, or STATIC REVIEW ONLY. Never claim a check passed unless it was executed; never call a source inspection an automated test; never claim PostgreSQL concurrency was tested unless a real PostgreSQL server was used. For failures give the command and error summary, and say whether it is pre-existing only when a baseline run supports that.

## 7. Delivery
At the end of a batch: update `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` (append, keep history), the batch report, `PROJECT_STATE.md`, `LATEST_HANDOFF.md`, `REMAINING_ISSUES.md`, `NEXT_BATCH_BRIEF.md`, `TEST_REPORT.md`, `CHANGELOG.md` and `FILE_INVENTORY.md`. Ship one clean ZIP: source, public assets, migrations, tests, package files and lockfile, docs; exclude `node_modules`, build output, caches, temp files, real `.env` files, secrets and duplicate archives. Verify the ZIP extracts, then wait for review.
