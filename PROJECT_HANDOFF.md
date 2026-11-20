# SHAHOO — Project Handoff & Engineering Memory

> **Canonical handoff for future agents and maintainers.** Read this file before changing code, infrastructure, migrations, or release state. It consolidates repository evidence and the verified project history available on 2026-11-20. It is deliberately explicit about what was tested, what was only reviewed, and what remains blocked.
>
> **Current release posture: NOT APPROVED FOR PUBLIC PRODUCTION LAUNCH.** The application has a working Vercel Preview path and substantial source-level remediation, but live provider activation, Production database setup, PostgreSQL multi-connection verification, and final release checks are still outstanding.

**Last reconciled:** 2026-11-20 (post-PR #3 merge reconciliation)

## 0. Latest verified repository maintenance

- PR #2, `docs: add comprehensive SHAHOO project handoff`, was merged after its full GitHub Actions CI run completed successfully. Merge commit: `299b85a7aa1b76d05bd03594915b888d7d469ca9`. This was documentation-only; it did not change application code, migrations, database settings, or deploy Production.
- PR #3 ([documentation cleanup](https://github.com/arefbrh/shahoo/pull/3)) updated the agent entry point and marked superseded batch/status documents as historical. Its CI run `44713902624` completed successfully for head `a0516f65a2474a1e8cb9b60b3981f31493184401`; it was squash-merged into `main` as `ab5d3617f62b7156b2a90504d86f2e4d9409e2d3`. Documentation-only; no application source, dependencies, migrations, database data, secrets, or deployment settings changed.
- Current documentation entry point: [docs/README.md](docs/README.md). Start with this handoff and do not treat historical batch instructions as current authorization.

**Repository:** [arefbrh/shahoo](https://github.com/arefbrh/shahoo)  
**Production branch:** `main`  
**Primary stack:** React + TypeScript, TanStack Start, Vite, Nitro, Drizzle ORM, PostgreSQL/Neon in deployed environments, PGlite for local/test use, Vercel hosting.

---

## 1. Start here — current state at a glance

| Area | Current state | Evidence / next action |
|---|---|---|
| GitHub repository | Connected and accessible | `arefbrh/shahoo` |
| GitHub CI for PR #1 head | Passed | Run `44706122336`, commit `2082b8eed9759a60126c81b3fb2b0482792367f6` |
| Vercel project | Connected to GitHub | Preview deployments have been created successfully |
| Vercel Preview URL | User-reported working deployment | `https://shahoo.vercel.app` is the known project URL; generated branch/commit URLs are also used for previews |
| Neon Preview database | Connected by user | `DATABASE_URL` set for **Preview only**; never copy its value into chat, source, logs, or docs |
| Preview demo catalog | Working | `SEED_DEMO=1` is configured for Preview only; never enable it in Production |
| Manual storefront smoke test | Passed by owner | Product detail, add-to-cart, cart quantity and price were checked by the owner and reported working |
| PR #1 | Open, Draft, not merged; current GitHub metadata reports mergeable=false against its old base | [Fix Vercel runtime loading of PGlite adapter](https://github.com/arefbrh/shahoo/pull/1); reconcile/rebase against current `main`, rerun CI, and review before any merge |
| Production database | Not provisioned/verified | Create a separate Neon Production database and configure Vercel Production `DATABASE_URL` before any Production deploy |
| Production deployment | Not verified / not approved | Do not merge or promote blindly; see release gates below |
| PayPing / SMS.ir | Source integration exists; disabled pending controlled account verification | No live credentials, sandbox transaction, real SMS, or real payment was tested |
| Real PostgreSQL concurrency and restore | Not executed in the documented Batch 09 evidence | Use the guarded disposable PostgreSQL procedure; do not target Production |
| Full script test suite | Four platform-only tests blocked | 212/216 script tests in the latest documented run; missing private `.grok` inputs explain the four failures |
| App + migration/integration suites | Passed in latest documented run | 226/226 app tests and 110/110 migration/integration tests (Batch 09 final corrective-phase evidence) |

**Important evidence distinction:** the green GitHub Actions run is real CI evidence for its exact commit. The detailed Batch 09 local test report is a separate evidence set. Do not conflate either with live provider, Production, or multi-connection PostgreSQL verification.

## 2. Project purpose and product context

SHAHOO is an Iranian organic/natural-products e-commerce storefront. The UI is Persian-first and RTL. The intended product includes a public catalog, product details, cart, checkout, customer accounts, order tracking, admin operations, CMS/homepage content, inventory, shipping, discounts, notifications, and payment/SMS integrations.

The owner wants the assistant/agent to do the implementation work directly where possible, preserve a clear Preview → review → Production workflow, and avoid asking them to repeat prior project history. Do not ask the owner to paste secrets or full database URLs into chat.

## 3. Repository and deployment topology

### GitHub

- Repository: `https://github.com/arefbrh/shahoo`
- Production branch: `main`
- Existing PR #1: `fix/vercel-pglite-runtime-import` → `main`
- PR #1 head at last verification: `2082b8eed9759a60126c81b3fb2b0482792367f6`
- PR #1 is Draft, open, and **not merged**. Current metadata reports `mergeable=false`; its base SHA predates the merged documentation PRs. Reconcile it against current `main` and rerun CI before considering merge.
- PR #1 changes:
  - `src/server/db/client.ts`: dynamically load Drizzle's PGlite adapter only on the PGlite path.
  - `vite.config.ts`: externalize `drizzle-orm/pglite` and `@electric-sql/pglite` for Nitro tracing.
  - `src/server/env/runtime.ts` and its tests: allow explicit demo seeding on Vercel Preview only, while keeping Production disabled.

Do not assume PR #1 has been merged. Re-fetch PR metadata and its current head before acting.

### Vercel

- Project is linked to GitHub and deploys branch/PR previews.
- Known project URL: `https://shahoo.vercel.app`.
- Other user-reported generated URLs included `shahoo-git-main-shahoo.vercel.app` and a commit-specific deployment URL.
- A Vercel Preview deployment for the PR head was reported successful.
- Runtime issue encountered during setup:
  1. `ERR_MODULE_NOT_FOUND` for `@electric-sql/pglite` from the bundled Drizzle library.
  2. After the bundle fix, `getaddrinfo ENOTFOUND base` caused by an invalid/malformed Neon connection string.
  3. Owner corrected the Preview `DATABASE_URL` in Vercel; Preview then loaded sample products.
- Do not copy the old connection string or password from conversation history. A credential was pasted in chat during troubleshooting; rotation status was not independently confirmed. Recommend rotating it in Neon if that has not already been done, then update only the relevant Vercel environment.
- Vercel environment variables are deployment-scoped. Changes apply to new deployments; redeploy after changing a variable. See [Vercel environments](https://vercel.com/docs/deployments/environments) and [environment variables](https://vercel.com/docs/environment-variables).

### Neon

- A Neon PostgreSQL database/branch was created for Preview.
- Owner configured its connection string as Vercel `DATABASE_URL` for **Preview only**.
- The Preview application selected PostgreSQL successfully after the hostname was corrected.
- No Production database was confirmed as created or connected.
- **Never point Production at the Preview database.** Create a separate Production database/branch, verify region/backup/retention and access policy, then configure the Vercel Production variable separately.
- Never place a live database URL in this file, source control, issues, screenshots, logs, or chat.

### Vercel environment variable matrix

| Variable | Preview | Production |
|---|---|---|
| `DATABASE_URL` | Configured by owner; points to Preview Neon DB | **Not configured/verified**; must point to a separate Production DB |
| `SEED_DEMO` | `1` for the current sample catalog Preview | Must be unset/empty; demo seeding is forbidden |
| `VITE_AUTH_ENABLED` | Keep `false` unless platform scaffold is explicitly reviewed | Keep `false`; SHAHOO has separate custom customer/admin auth |
| `PAYMENT_PROVIDER` / `PAYPING_LIVE` | Keep live payment disabled | Keep disabled until provider + PostgreSQL gates are passed |
| `SMS_MODE` / `SMS_LIVE` | Keep disabled or explicit mock-only local test mode | Keep disabled until SMS.ir account/template/controlled test is approved |
| `APP_URL` | Set to the correct Preview origin if required by absolute URL generation | Set to the final HTTPS Production origin before launch |
| `SHAHOO_ADMIN_*` | Only configure a dedicated test admin if needed | Configure securely only after the production DB and operator access plan are ready |

Do not infer that a variable exists just because it is listed here or in `.env.example`. Check the Vercel environment directly without exposing secret values.

## 4. Critical runtime and data-safety rules

Source of truth: `src/server/env/runtime.ts`, `src/lib/db.ts`, `scripts/migrate.mjs`, and `.env.example`.

1. In `NODE_ENV=production`, `DATABASE_URL` is mandatory. The app fails closed without it.
2. A configured PostgreSQL connection failure must remain a PostgreSQL failure; never fall back to PGlite after a failed connection.
3. PGlite is for local development/tests only.
4. Production migrations require both `DATABASE_URL` and `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`; a normal build does not run migrations.
5. Demo seed is opt-in. Vercel Preview may cross `NODE_ENV=production` only when `VERCEL_ENV=preview` and `SEED_DEMO=1`. Production must never receive `SEED_DEMO=1`.
6. OTP echo and mock payment/SMS must not be enabled in Production.
7. No migration may be run against Production until the exact target database, backup, migration plan, and rollback/recovery plan have been reviewed and explicitly approved.
8. Do not delete seed/demo rows automatically. Inspect the target database and preserve owner data unless cleanup is explicitly approved.

## 5. Work completed — historical and source-level remediation

This section records completed work without claiming live integration.

### Vercel / Neon runtime

- Connected GitHub repository to Vercel.
- Created Neon PostgreSQL Preview database and added Preview-only `DATABASE_URL`.
- Corrected malformed connection hostname after `ENOTFOUND base`.
- Isolated the PGlite Drizzle adapter from the PostgreSQL runtime path using dynamic import and Nitro externalization in PR #1.
- Added Preview-only demo seed gate so the Vercel Preview can display sample products while Production remains protected.
- PR #1 CI and Preview deployment passed for the recorded head commit; the PR has not been revalidated against the current `main` after subsequent merges, and its current mergeability is false. Rebase/update and rerun checks before considering merge.

### Seed safety and Production guards

- Production requires PostgreSQL and refuses embedded PGlite fallback.
- Production demo seed is blocked.
- Seed initialization preserves existing foundation keys and homepage section types.
- Migrations include safety checks and preserve existing rows; do not assume arbitrary existing database data has been inspected.

### Catalog/cart/checkout fixes

The repository's remediation reports document:
- Shared sellability rules for cart/quote/checkout and late-payment recovery, including deleted/inactive product/variant/category checks.
- Checkout cart ownership/expectation checks and idempotency protections.
- Guest checkout throttling by IP and guest-cart identity.
- Inventory holds, conditional release, expiry/late-payment handling, and order transition safeguards.
- Owner manually tested Preview product detail, add-to-cart, cart quantity and displayed price successfully.

These are code/test results, not proof of production load or independent-connection PostgreSQL race behavior.

### Customer OTP and authentication

The latest Batch 09 comprehensive/corrective audit records:
- Cryptographically random OTP generation, salted hash storage, short expiry, bounded attempts, one-time redemption.
- Transactional mobile/IP send and verify buckets.
- Latest-issued-only challenge behavior; older active challenges are invalidated on a new request.
- Exact checked challenge ID must be consumed before a successful login.
- Unknown SMS network outcomes are persisted and are not blindly resent.
- Platform scaffold auth is separate from SHAHOO customer OTP and admin session/RBAC.
- `VITE_AUTH_ENABLED` should remain false unless a separate platform-auth integration is deliberately enabled.

Do not revert the latest-issued-only OTP policy or exact-challenge consumption. Review `src/server/auth/customer.ts`, `otp-limit.ts`, `sms.ts`, `crypto.ts`, and `policy.ts` before changing auth.

### PayPing payment lifecycle

The latest Batch 09 reports state that the earlier isolated HTTP adapter was extended with:
- Durable `payment_attempts` persistence.
- Server-owned order initiation and idempotency.
- POST callback route with strict content type and 32 KiB streamed body limit.
- Server-side provider verification; callback fields alone never prove payment.
- Explicit IRR-to-Toman conversion and stored provider amount.
- Handling for documented HTTP 409 / `metaData.code=110` Already Verified response.
- Durable verified-but-unsettled evidence and retry/reconciliation path.
- Stale `settling` lease recovery.
- Admin manual review for unknown provider outcomes; unresolved attempts block replacement payments.
- No customer-controlled amount or callback URL.

Relevant files: `src/server/payments/payping.ts`, `payping-lifecycle.ts`, `service.ts`, `api.ts`, `src/routes/api.payment.payping.callback.ts`, `src/server/db/schema.ts`, and migrations `0013`–`0016`.

**PayPing remains disabled by default.** No live provider credentials, merchant confirmation, sandbox payment, or real payment has been tested. The amount-unit convention has supporting official WooCommerce integration evidence, but the merchant account must confirm it before activation. Never wire a callback to an older helper without re-reading the lifecycle/state-machine implementation.

### SMS.ir

The latest Batch 09 reports state that:
- SMS.ir Verify adapter uses the documented Verify endpoint, API key header, template ID and `Code` parameter.
- SMS modes are explicit: `disabled` (default), `sandbox` (mock only), and `live` (production + explicit live flag + credentials).
- Network/timeout/5xx outcomes are recorded as unknown delivery, not automatically retried.
- OTP code is not logged or persisted as plaintext.

**SMS.ir is not connected to a real account.** Template approval, exact parameter name, credentials, account limits and real handset delivery remain unverified.

### Security/configuration

- A previously hardcoded shared preview OAuth secret was removed from source and replaced by runtime secret configuration.
- This removal does **not** revoke the previously exposed credential. Owner must confirm rotation/revocation and review its usage; this has not been verified.
- `.env.example` is a placeholder-only template and should remain tracked (`.gitignore` explicitly preserves it).
- Do not add real keys, tokens, passwords, or database URLs to the repository.

## 6. Test and verification evidence

### GitHub Actions

- Workflow: `.github/workflows/ci.yml`
- Node version: `22.x`
- Jobs include Quality (typecheck/lint/build), Project tests, PostgreSQL integration/migrations, payment/SMS mocks, security checks, migration inventory, and an optional private platform harness.
- Recorded successful CI run for PR #1 head:
  - Run ID: `44706122336`
  - Commit: `2082b8eed9759a60126c81b3fb2b0482792367f6`
  - Conclusion: `success`
- This CI result applies only to that commit. Re-check statuses after any new commit.

### Batch 09 local evidence (2026-11-20)

The latest comprehensive/corrective report records:

| Check | Result |
|---|---|
| `npm ci` | PASS; 431 packages installed; 0 vulnerabilities reported in that run |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; 5 pre-existing warnings, 0 errors |
| `npm run build` | PASS; existing bundler `use client` directive warnings |
| Focused provider tests | 9/9 PASS |
| Focused OTP tests | 5/5 PASS |
| Payment lifecycle tests | 2/2 PASS |
| Migration/integration tests | 110/110 PASS |
| Application suite | 226/226 PASS |
| Script group | 212/216; four blocked by missing private `.grok` platform files |

The four blocked script tests are private platform harness/documentation checks, not known application payment/SMS failures. Do not delete, skip, weaken, or fabricate the private inputs to make the count green. Run the platform suite only in its authorized original harness.

**Important:** a prior evidence file reports 103/103 migration tests and 223/223 application tests. Those are historical earlier counts. The latest comprehensive audit supersedes them with 110/110 and 226/226 respectively. Preserve the chronology; do not mix counts.

### Tests not completed

- Real PostgreSQL independent-connection concurrency for inventory, payment callback/retry, order lifecycle and seed initialization.
- Full fresh/upgrade migration verification against a disposable PostgreSQL target plus exact migration inventory.
- PostgreSQL backup/restore execution.
- Full browser E2E for customer and admin flows across desktop/mobile.
- Complete accessibility review (keyboard, focus, contrast, screen reader, dialogs/drawers).
- Deployed auth/session/cookie/proxy parity and production health/restart behavior.
- Live SMS.ir provider acceptance and handset delivery.
- PayPing merchant confirmation, controlled provider verification, callback reachability and real payment/refund.
- Production hosting, persistent media, backup, observability and rollback verification.

See `docs/POSTGRESQL_VERIFICATION.md` for the guarded PostgreSQL procedure. It is a **prepared procedure, not an executed test**.

## 7. Current release blockers and risks

1. **Production Neon database is not confirmed.** Must be separate from Preview and configured only in Vercel Production.
2. **Previously exposed OAuth credential rotation is unconfirmed.** Owner/credential administrator must rotate/revoke and review usage.
3. **Real PostgreSQL multi-connection tests and backup/restore are outstanding.**
4. **Four private platform script tests remain blocked** until the matching authorized private harness is available.
5. **PayPing/SMS.ir account configuration and controlled provider verification are outstanding.** Keep both live paths disabled.
6. **PayPing amount-unit convention requires merchant confirmation** despite supporting integration documentation and source checks.
7. **Browser E2E and accessibility are not complete.**
8. **Production deployment, HTTPS/cookie/proxy settings, persistent storage, monitoring and rollback are not verified.**
9. **Existing demo contamination must be inspected** in the selected release database; do not automatically clean data.
10. The original archive's full Claude audit descriptions for 17 summarized findings (11 medium, 6 low) were not recovered in the earlier audit record. Do not invent missing finding IDs or claim a complete historic audit if the original source remains unavailable.

Do not represent the project as fully tested, production-ready, or connected to live payment/SMS.

## 8. Recommended next roadmap — do not repeat completed work

### Phase A — reconcile Git state (first action for every new agent)

- [ ] Fetch `main`, PR #1, current branch heads, and recent workflow runs.
- [ ] Verify whether PR #1 is still open/draft and whether its four changes are already superseded or still required.
- [ ] Compare PR #1 against current `main`; do not recreate the dynamic PGlite import, Nitro externalization, or Preview seed gate without checking current code.
- [ ] Confirm the latest source files still match the Batch 09 reports; the report is evidence, not a substitute for reading current source.
- [ ] Do not merge PR #1 or deploy Production without owner approval and the Production database gate.

### Phase B — finish safe Preview verification

- [ ] Confirm Vercel Preview uses its own Neon database and only Preview has `SEED_DEMO=1`.
- [ ] Confirm no live payment/SMS flags are enabled.
- [ ] Run customer journey: browse → detail → cart → checkout quote → create unpaid/manual order → receipt/order lookup.
- [ ] Run customer OTP in the permitted test mode only; verify no OTP echo in a production-like environment.
- [ ] Run admin login/permissions/order operations with a dedicated test account.
- [ ] Capture sanitized runtime logs and verify no secret or OTP values are logged.

### Phase C — PostgreSQL and security verification

- [ ] Execute `docs/POSTGRESQL_VERIFICATION.md` only against an isolated disposable PostgreSQL instance with synthetic data.
- [ ] Verify fresh migrations 0002–0016 and upgrade path, idempotence, constraints and migration inventory.
- [ ] Add/execute independent-connection concurrency tests for cart/stock/payment/callback/settlement and initialization.
- [ ] Execute backup/restore and verify restored rows, constraints and migration history.
- [ ] Re-run dependency audit and full configured tests; record exact command, commit, exit code and counts.
- [ ] Resolve or formally disposition the private platform harness gap without weakening tests.
- [ ] Complete browser E2E and accessibility audit.

### Phase D — Production readiness

- [ ] Create a separate Neon Production database; never reuse Preview.
- [ ] Inspect and approve Production schema/migration plan and backup/restore procedure.
- [ ] Configure Vercel Production `DATABASE_URL` as a secret; keep `SEED_DEMO` unset.
- [ ] Configure `APP_URL`, secure admin bootstrap, HTTPS, cookie/proxy trust, persistent media, backups and monitoring.
- [ ] Confirm exposed credential rotation/revocation.
- [ ] Only then review/merge code and deploy; verify the exact Production commit, health, logs, domain and rollback plan.
- [ ] Do not activate payment/SMS as part of the first public deployment unless their separate provider checklists are complete.

### Phase E — controlled live provider activation (separate approval)

- [ ] PayPing: complete `docs/PAYPING_CONFIGURATION_CHECKLIST.md`, confirm merchant amount unit, perform authorized controlled test, verify callback and recovery/manual review.
- [ ] SMS.ir: complete `docs/SMSIR_CONFIGURATION_CHECKLIST.md`, confirm approved template and parameter, perform authorized test to an owner-controlled number, verify unknown-delivery handling.
- [ ] Add secrets only to the deployment secret manager; never commit them or paste them in chat.
- [ ] Enable live flags only after owner review and provider evidence.

## 9. Key source files and documentation map

| Path | Purpose |
|---|---|
| `src/server/env/runtime.ts` | Production DB, seed, OTP echo, mock and migration guards |
| `src/lib/db.ts` | PostgreSQL/PGlite selection and connection setup |
| `src/server/db/client.ts` | Drizzle database client |
| `src/server/db/schema.ts` | Database schema |
| `scripts/migrate.mjs` | Guarded migration runner |
| `scripts/run-tests.mjs` | Test group definitions |
| `src/server/auth/customer.ts` | Customer OTP challenge/login flow |
| `src/server/auth/otp-limit.ts` | OTP throttling |
| `src/server/auth/sms.ts`, `src/server/sms/providers.ts` | SMS delivery/provider modes |
| `src/server/commerce/checkout.ts` | Checkout/order creation and stock holds |
| `src/server/commerce/holds.ts` | Stock hold expiry/release |
| `src/server/payments/payping.ts` | PayPing HTTP contract and amount conversion |
| `src/server/payments/payping-lifecycle.ts` | PayPing initiation/callback/verification/recovery |
| `src/routes/api.payment.payping.callback.ts` | PayPing callback route |
| `migrations/0013`–`0016` | Durable payment attempt and recovery schema changes |
| `docs/PAYMENT_STATE_MACHINE.md` | Payment-attempt states and recovery behavior |
| `docs/POSTGRESQL_VERIFICATION.md` | Guarded disposable PostgreSQL verification plan |
| `docs/PAYPING_CONFIGURATION_CHECKLIST.md` | PayPing owner/provider activation checklist |
| `docs/SMSIR_CONFIGURATION_CHECKLIST.md` | SMS.ir owner/provider activation checklist |
| `docs/TEST_REPORT_BATCH_09.md` | Earlier Batch 09 test snapshot; see latest corrective counts above |
| `BATCH_09_COMPREHENSIVE_AUDIT.md` | Latest comprehensive PayPing/SMS audit and corrective-phase evidence |
| `BATCH_09_REMEDIATION_REPORT.md` | Implementation history and limitations |
| `REMAINING_ISSUES.md` | Current issue register; check each status and evidence boundary, alongside the latest comprehensive audit. |

## 10. Agent operating rules

- Read this file, then inspect the current Git state and latest audit/test evidence before editing.
- Never assume that a previous assistant's claimed change exists on the current branch. Verify the file and commit.
- Never repeat a fix already present. Search the source, tests, migration history and PR diff first.
- Keep changes on a feature branch and open/update a PR. Do not push directly to `main`.
- Keep Production and Preview databases separate. Never run migrations or destructive queries against Production without explicit owner approval.
- Do not expose, echo, log, or copy secrets. If a credential was exposed, recommend rotation; do not reproduce it.
- Do not claim tests passed unless you ran them or can cite the exact recorded run/commit.
- Distinguish mocked provider tests from live provider tests, PGlite from real PostgreSQL, and Preview from Production.
- Preserve audit history. Do not delete failing tests or rewrite historical results to appear green.
- Ask the owner only for decisions/credentials/actions that require their authority. Keep requests short and specific.
- After every meaningful task, update this handoff with commit SHA, changed files, exact tests/results, deployment status and remaining risks.

## 11. External references

- [Vercel deployment environments](https://vercel.com/docs/deployments/environments)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Neon documentation](https://neon.tech/docs)
- [PayPing API documentation](https://docs.payping.ir/)
- [PayPing OpenAPI](https://statics.payping.ir/openapi.json)
- [SMS.ir REST API](https://sms.ir/rest-api/)

---

**End of handoff.** If this document conflicts with the live repository, current CI, or a newer dated audit, verify the live evidence and update this file. Do not silently assume the older statement is still true.


---

## Live-state reconciliation addendum — 2026-11-20

This addendum supersedes earlier statements in this file where live GitHub or Neon metadata now provides newer evidence. Historical entries above are retained for traceability.

### GitHub main and CI

- Current `main` commit at this reconciliation: `321c0d640685e4e99af3053059fbd95047179524` (PR #4 squash merge).
- GitHub Actions run [44716528199](https://github.com/arefbrh/shahoo/actions/runs/44716528199) completed with conclusion **success** for that exact main commit.
- Security checks, PostgreSQL integration/migrations, quality (typecheck/lint/build), project tests, payment/SMS mocks, and migration inventory all completed successfully.
- The main project-test job ran three groups: scripts 113/113, application 227/227, and migration-integration 120/120 (460 passed, 0 failed, 0 skipped across those groups). The private platform harness was separately skipped by the workflow; it is not counted as a passing private-harness run.
- This CI result is evidence for the exact main commit above. It does not establish live provider, Production deployment, browser E2E, backup/restore, or independent-connection concurrency readiness.

### PR #1 — current live status

- PR #1 remains **open, Draft, and unmerged**: [Fix Vercel runtime loading of PGlite adapter](https://github.com/arefbrh/shahoo/pull/1).
- PR #1 was reconciled onto current `main` after the above snapshot. Its new head is `3442af0246387cf4617dc36fac99c2416a7f61cc`; GitHub compare confirms it is **4 commits ahead and 0 behind** current main (`321c0d640685e4e99af3053059fbd95047179524`).
- PR #1 remains **open, Draft, and unmerged**, with `mergeable=true`. The new CI run `44718356786` is running for the reconciled head; security, quality, payment/SMS mocks, migration inventory, and PostgreSQL integration/migrations have passed, while project tests were still running at this check. The Vercel commit status for the new head is **success**.
- The four source/test changes remain outside `main`: dynamic PGlite adapter import, Preview-only demo-seed gate and tests, and Nitro externalization for both `drizzle-orm/pglite` and `@electric-sql/pglite`.
- Do not merge/promote to Production until the separate Production database, final CI, Preview smoke test, and release gates below are satisfied.

### Neon account/project observation

- The connected Neon project listing search for `shahoo` returned one matching project: `shahoo-staging` (project ID `morning-voice-81212343`, PostgreSQL 16, region `aws-eu-central-1`).
- Its only listed branch is the default `staging` branch (`br-young-heart-b96c797x`), with one read-write endpoint (`ep-blue-sunset-b9z17mpp`).
- No separate SHAHOO Production Neon project or branch was present in the accessible matching project results at the time of this check. Treat Production DB as **not provisioned/verified**. Do not repurpose the staging branch as Production.
- This was a metadata-only inspection. No database rows, credentials, schema, or secrets were read or changed.

### Source-file cleanup audit

- The current recursive Git tree contains 467 entries and was not truncated.
- No files were deleted in this pass. Several initially suspicious scripts have concrete active contracts or references: `build-windows.mjs` and `release-expired-holds.mjs` are package-script entry points; `browser-smoke.mjs` imports `brand-check.mjs`; `preview-thumbnail.mjs` documents its internal preview-capture contract; and `sign-out-plan.mjs` is a pure module used by the authentication client and tests.
- Filename age or lack of GitHub code-search results is not proof of dead code. Continue with repository-wide reference and workflow analysis before proposing any deletion. Preserve historical reports, migrations, tests, assets and evidence.

### Next safe sequence

1. Reconcile/update PR #1 against current main, then rerun CI and Preview; keep it Draft until reviewed.
2. Finish a reference-based script/asset cleanup audit without deleting unproven files.
3. Execute the documented real-PostgreSQL multi-connection and backup/restore procedures only against disposable isolated infrastructure.
4. Obtain owner-controlled confirmation of the exposed OAuth credential rotation/revocation.
5. Provision a separate Neon Production database only after explicit owner approval, then configure Vercel Production separately.
6. Complete browser E2E, accessibility, admin/customer journey checks and provider sandbox checklists before any public launch.

## PR #6 latest concurrency and recovery verification — 2026-11-20

This dated addendum supersedes earlier PR #6 status summaries above where they describe narrower test coverage or an in-progress CI run. Latest PR head: `17c8e9dd38c7c6a792a39b2b430eb08cf715ab3d`. GitHub Actions run [44733552547](https://github.com/arefbrh/shahoo/actions/runs/44733552547) completed successfully for that head:

- Project test suite: success.
- PostgreSQL integration/migrations: success, including the independent-client contention and PG16 backup/restore harness.
- Payment/SMS mock lifecycle tests: success, including concurrent duplicate PayPing callback handling.
- Quality (typecheck, lint, build): success.
- Security checks and migration inventory: success.
- Optional private platform harness: skipped because its opt-in repository variable is not enabled; this is not a passing result for that private harness.

The latest application test additions cover (1) a seven-condition late-payment recovery rollback matrix for unpublished/deleted products, inactive/deleted variants/categories and insufficient stock, asserting no payment/inventory/audit side effects; (2) two concurrent duplicate PayPing callbacks, asserting settled order/payment state and exactly one payment row and verified-payment log; and (3) two concurrent expiry workers restoring coupon usage exactly once while releasing the stock hold once.

All provider interactions in these tests are mocked/local; no live PayPing or SMS.ir request was made. PostgreSQL CI uses ephemeral PostgreSQL 16 and synthetic fixtures. No Neon database, Vercel setting, Production environment or customer data was touched. PR #6 remains open and unmerged. This CI success does not approve Production launch.

Remaining coverage includes callback HTTP route integration beyond the lifecycle mock, checkout racing late-payment recovery, quote/order transition/RBAC tests, multi-process seed initialization, full fresh/upgrade migration parity and rollback injection, and production-like disaster recovery including roles/globals, media, secrets, host/network configuration, encryption and retention.
