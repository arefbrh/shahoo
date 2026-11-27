# SHAHOO v1.0.0 — Current issue register and release blockers

## Active issues — 2026-11-25

PR #11 is merged into `main`. The release milestone tracks the environment checks and decisions that remain open. [Milestone](https://github.com/shahoo-workspace/shahoo/milestone/1)

| Scope | Latest evidence | Tracking |
| --- | --- | --- |
| Production schema | `0016` recorded on Production. Staging and the disposable branch are at `0019`. Recovery plan and Production upgrade are open. | [#13](https://github.com/shahoo-workspace/shahoo/issues/13) |
| Preview checkout | Local guest checkout passed with a synthetic shipping method. Staging had zero active methods at the last check. | [#14](https://github.com/shahoo-workspace/shahoo/issues/14) |
| Preview admin and media | The sign-in page loaded and Preview settings match the private Staging bucket. Authenticated access and the application media lifecycle are open. | [#15](https://github.com/shahoo-workspace/shahoo/issues/15) |
| Target VPS recovery | Linux and Windows CI drills passed on disposable infrastructure. The target-host exercise remains open. | [#16](https://github.com/shahoo-workspace/shahoo/issues/16) |
| Follow-up tests | PR #12 adds schema upgrade and PostgreSQL checks. Execution is deferred at the owner's request. | [#17](https://github.com/shahoo-workspace/shahoo/issues/17) |
| External providers | Payment, SMS and carrier integration have their own approval and verification scope. | [#18](https://github.com/shahoo-workspace/shahoo/issues/18) |

## Historical audit register

The following findings preserve earlier batch evidence. Use the current issue links above and the [project handoff](PROJECT_HANDOFF.md) to establish the latest status. [Archive](docs/archive/REMAINING_ISSUES_pre_revision_02_1.md)

Each issue below has exactly one of these statuses: **RESOLVED; RESOLVED — VERIFIED; OPEN; NOT VERIFIED; BLOCKED BY ENVIRONMENT; DEFERRED TO BATCH 09**. “Verified” means only the specifically named historical verification; it does not claim a fresh run for this integration candidate. The evidence register, not old totals, controls the release gate.

## Source fixes and current security state

| Finding | Status | Evidence and remaining boundary | Release blocking |
|---|---|---|---|
| Better Auth critical advisory `GHSA-965c-763c-88jm` | RESOLVED — VERIFIED | `package.json` and `package-lock.json` pin Better Auth `1.7.26`; Revision 01 reports the critical advisory cleared after upgrade and compatibility changes. Revision 02 previously reported no npm audit findings. This is historical audit evidence, not a fresh audit or a guarantee against later advisories. | The historical critical finding itself: no; fresh audit and owner security review still gate release. |
| Seven moderate dependency findings reported in Revision 01 | RESOLVED — VERIFIED | Revision 01 reported 7 moderate transitive development-tooling findings; Revision 02 reports a non-forced update to `typescript-eslint@8.73.0` and a zero-vulnerability audit. The manifest specifies `^8.73.0` and the lockfile resolves `8.73.0`. The seven findings are not current open findings merely because they appear in old reports. | The historical seven: no; evaluate the actual current audit below. |
| Current npm dependency audit | NOT VERIFIED | Revision 02's zero-vulnerability result is **prior evidence only**. At reconciliation time, the fresh 02.1 `npm ci`, `npm audit` and `npm audit --json` rerun was in progress; use the final release evidence for actual results and any new advisories. Do not infer a fresh zero result. | Yes: review the actual result, remediate or obtain explicit owner risk treatment before approval. |
| Platform auth enabled by missing/malformed flag | RESOLVED — VERIFIED | `scripts/with-app-env.mjs` defaults to `false`, preserves only exact `true`/`false`, and normalizes other values to `false`; process environment overrides `.grok/app-env.json`. `src/lib/auth/client.ts`, `gate-identity.server.ts`, `server.ts`, and `scripts/check-auth-invariant.mjs` use the exact string `true` as opt-in; absent, empty, or malformed values are off. Wrapped `dev`, `build`, and `preview` use the same merge; direct Vite invocation bypasses it. Revision 02 reports 24/24 wrapper/invariant tests, 25/25 gate tests, and a dev/build auth-off check. This flag controls the platform scaffold, **not** SHAHOO's separate customer OTP/session and admin session/RBAC paths (`src/server/auth/`). | The historical default-on defect: no. Deployment build-time and server runtime settings still require verification, below. |
| Exposed platform preview OAuth credential | OPEN | A hardcoded shared preview OAuth client secret was present in the input archive and was removed from `src/lib/auth/preview.ts`; the optional broker now obtains a secret from protected runtime configuration. This does not remove exposure in earlier copies. The credential owner must assess, rotate/revoke, and review usage; no live action was performed here. The shop's custom authentication is separate. | Yes until the credential owner assesses and remediates exposure and confirms deployed secret handling. |
| Deployment auth/session configuration | NOT VERIFIED | Explicitly set and verify `VITE_AUTH_ENABLED=false` in the chosen shop build and server runtime; check actual client bundle, separate custom customer/admin auth, HTTPS, cookie/proxy settings, and deployed behavior. The prior local result does not prove deployment parity. | Yes. |
| `quoteCart`/cart sellability inconsistency | RESOLVED — VERIFIED | `src/server/storefront/api.ts` `quoteCartWithDb`, `src/server/commerce/cart.ts`, and `src/lib/commerce-integrity.ts` use `isLineSellable`; their query paths reject missing joined product/variant, unpublished/deleted products, inactive/deleted categories, and inactive/deleted variants. `src/server/storefront/quote-cart-rules.test.ts` includes pure and PGlite database-path tests; Revision 01 reports 10/10 focused quote/cart tests and Revision 02 includes these in 94/94 PGlite tests. This resolution applies to quote/cart paths, **not** every payment/checkout path. | That specific quote/cart defect: no; see the separate checkout/recovery issue. |
| Soft-deleted variant in checkout and late-payment recovery | RESOLVED — VERIFIED | `checkout.ts` and `payments/service.ts` now select and pass `productVariants.deletedAt` into the shared sellability rule. Focused baseline reproductions failed 3/3 before the fix; the corrected surrounding commerce suites passed 49/49, shared sellability passed 7/7, typecheck passed, and targeted lint passed. Single-connection PGlite/mock-provider coverage is not real PostgreSQL concurrency or a live gateway. | Yes until candidate PostgreSQL concurrency and payment-reconciliation review are complete. |

| Demo seed and duplicate homepage section types | RESOLVED — VERIFIED | `src/server/env/runtime.ts` disallows automatic demo seeding in production; `seed.ts` filters demo sections by existing `sectionType`; migration `0010` provisions missing product section types and preserves existing rows. `seed-safety.test.ts` covers fresh production, repeat initialization, demo after migrations, and migration custom-row/edit preservation; Revision 02 reports 4/4 on PGlite. The code preserves rather than automatically cleans existing data; this is not evidence for every arbitrary CMS ID collision or production database. | This specific duplication defect: no; migration and existing-data checks still gate release. |
| Seed initialization with pre-existing custom baseline/CMS IDs | RESOLVED — VERIFIED | Baseline inserts now use conflict-safe preservation for existing SMS-template keys and settings keys; demo homepage sections select unused IDs when a custom row occupies a canonical ID. Focused collision regressions passed 9/9 after the correction, including unrelated-conflict propagation and rollback. The fix preserves existing data but does not prove multi-process PostgreSQL initialization. | Real PostgreSQL independent-process seed behavior remains a separate blocker. |
| Existing demo-contaminated database | OPEN | `seedFoundation` recognizes `foundation.seed` and does not wipe existing products/coupons; older seed data can persist. Inspect the actual database, back up, and arrange an owner-approved cleanup if needed; do not delete data automatically. | Yes if the selected release database contains unapproved demo data; otherwise document the inspection. |
| Production fallback to PGlite | RESOLVED — VERIFIED | `src/server/env/runtime.ts` and `src/lib/db.ts` require a nonempty `DATABASE_URL` in production; a configured PostgreSQL connection failure is not converted to PGlite. `scripts/migrate.mjs` also requires the URL. Revision 02 reports the no-URL migration guard refused as expected. PGlite remains a dev/test backend. | The fallback defect: no; real PostgreSQL evidence remains a separate blocker. |

## Commerce, authentication and operational risks

| Finding | Status | Evidence and remaining boundary | Release blocking |
|---|---|---|---|
| Internal payment and order lifecycle | NOT VERIFIED | `src/server/payments/service.ts`, `src/server/commerce/orders.ts`, and `src/server/commerce/fulfillment.ts` implement internal verification, replay and ledger transitions. Revision 02 reports PGlite coverage for replay, amount/currency, refunds, and order transitions. Checkout does not call a live gateway; internal ledger state is not bank settlement. | Yes for real-payment release; PostgreSQL transaction and duplicate-callback evidence also gate general release. |
| Expiry, late payment and stock races | PARTIALLY VERIFIED | PR #6 CI run `44729304066` exercised actual `releaseExpiredHolds` and `captureVerifiedPayment` concurrently on disposable PostgreSQL 16 with synthetic fixtures and a local fake provider. Exactly one hold release/event/audit and one late-payment recovery/payment/stock decrement/paid event/audit were observed. Still open: insufficient-stock and unsellable-item rollback matrix, competing checkout during recovery, coupon restoration, provider callback/settlement races, and durable external-money reconciliation. | Yes for remaining failure modes and live-payment reconciliation. |
| Guest stock reservations / lazy expiry | OPEN | Guest checkout can reserve for 24 hours without a dedicated checkout throttle; `releaseExpiredHolds` is invoked on cart/order reads and handles up to 40 per call rather than a durable expiry scheduler (`src/server/commerce/checkout.ts`, `holds.ts`, `cart.ts`, `orders.ts`). | Yes for an exposed production shop unless mitigated and explicitly risk-accepted by the owner. |
| Charge succeeds but stock recovery fails | OPEN | `captureVerifiedPayment` verifies before the stock-recovery transaction; failure rolls back the internal payment/order update. The existing flow does not establish a durable reconciliation for external money already taken (`src/server/payments/service.ts`). | Yes before connecting a live gateway; design and test reconciliation, not just a provider adapter. |
| Refund/paid-cancel ledger limits | OPEN | `src/server/commerce/fulfillment.ts` can record a refund with `refundOfPaymentId=null` when an order has no verified payment row; paid cancellation refuses ambiguous multiple verified payments. Refunds are internal ledger operations, not gateway transfers. Revision 01 identifies refund/reconciliation as still open. | Yes before live payments; for unpaid-only release, require explicit owner disposition and validation of legacy data. |
| Same-OTP concurrent redemption / wrong-challenge consumption | RESOLVED — VERIFIED | Atomic OTP consumption now requires the exact checked challenge ID in the `RETURNING` rows. The pre-fix deterministic reproductions failed 2/3; the final targeted customer/auth/throttle suite passed 19/19, completion integration passed 15/15, typecheck and targeted lint passed. The separate policy allowing an older unconsumed challenge to reappear after a newer challenge is exhausted remains unchanged and needs product/security disposition. | The remaining resend/guessing policy and real SMS delivery remain release blockers. |
| Customer OTP controls and delivery | OPEN | `src/server/auth/policy.ts`, `customer.ts`, `crypto.ts`, and `otp-limit.ts` implement 5-digit, 2-minute codes, salted hashing, 5 attempts per challenge, and mobile/IP send buckets; echo requires non-production opt-in. Per-challenge verification attempts are not a separate cross-challenge per-mobile verification lockout. Revision 02 reports existing custom-auth tests, not live SMS or production validation. | Yes: assess/harden or explicitly accept OTP abuse risk and verify deployment security before production authentication; real delivery is separately deferred. |
| Cart/checkout uncertain writes | OPEN | Same-tab/session intent guards and quantity expectations exist, but a lost add response can commit after review; quantity-only compare-and-set has an ABA limitation and expectations can be omitted by legacy callers (`src/components/site/cart-intents.ts`, `src/lib/cart-concurrency.ts`, `src/server/commerce/cart.ts`). Shipping/coupon totals are recalculated by checkout but are not bound to the reviewed cart expectation (`checkout.ts`, `src/lib/checkout-cart-safety.ts`). | Yes for production checkout until tested and remediated or explicitly accepted by the owner. |
| Original Claude audit descriptions | NOT VERIFIED | **UNVERIFIED — ORIGINAL SOURCE MISSING:** the archive reports 6 HIGH, 11 MEDIUM and 6 LOW findings, but the complete original descriptions/IDs for the 11 medium and 6 low findings were not found. The summaries of SH-001–SH-006 in Revision 01 are recovered secondary evidence, not the missing original report. Do not invent, equate, or close the 17 unknown findings. Recover the source and verify individually if available. | Yes for a complete audit-evidence gate; if unrecoverable, obtain explicit owner disposition of the evidence gap without marking findings resolved. |

## Verification and deployment gates

| Finding | Status | Evidence and required action | Release blocking |
|---|---|---|---|
| Real PostgreSQL fresh/upgrade and application concurrency | PARTIALLY VERIFIED | PR #6 CI run `44729304066` (PR head `4ab448b95a86e8f73f15dc2ed6edc2eaf0663349`) passed on disposable PostgreSQL 16: 15 root migrations, independent-client row-lock contention, actual `commitCheckout` two-cart race, concurrent actual `releaseExpiredHolds`, and concurrent actual `captureVerifiedPayment` with local fake provider for an expired order. One checkout, one expiry release and one payment capture were committed without oversell or duplicate stock/event/audit effects. Still open: full fresh/upgrade parity, rollback injection/failure matrix, quote, duplicate callback/settlement through callback route, order transitions/RBAC and multi-process seed. No Neon or Production DB was touched. | Yes for remaining untested scenarios. |
| PostgreSQL backup and restore | PARTIALLY VERIFIED | PR #6 CI run `44729304066` passed PostgreSQL 16 custom-format `pg_dump`/`pg_restore` on a cloned synthetic CI database and compared migration count, synthetic row and public index count after restore. This does not cover production roles/globals, external media, host/secrets/network configuration, retention/encryption or a full production-like recovery exercise. | Yes for full disaster-recovery readiness. |
| Four private platform/script tests | BLOCKED BY ENVIRONMENT | Revision 02 reported **212/216** script tests: four failures when private `.grok/skills/og/SKILL.md` and `.grok/skills/og/references/` are absent. Three are in `scripts/brand-check.test.mjs` (marker, prohibition, self-check); one is in `scripts/write-atomic.test.mjs` (documented handovers). Some brand assertions also inspect platform `AGENTS.md` content, whereas this archive uses a portable file; compatibility of `docs/archive/AGENTS.grok-platform-original.md` has not been verified. In an authorized isolated original-platform harness, provide its matching private OG skill/reference files and platform instructions, then run `node --test 'scripts/**/*.test.mjs'`; adding only the skill files does not guarantee a pass. Do not invent private files, replace this project's instructions, delete tests, or claim the full suite is green. Portable same-file brand/atomic tests and `scripts/frontend-source.test.mjs` cover parts of the tooling/UI separately; they do not certify the private documentation assertions. Consult final evidence for any 02.1 rerun. | Yes for the full configured test gate unless the owner expressly scopes/accepts this platform-only limitation. |
| Browser E2E | NOT VERIFIED | Revision 02 reports only bounded homepage desktop/mobile smoke (system Chromium, 1280×800 and 390×844), not full click-through E2E; its Playwright-managed browser smoke script could not start its expected binary. Verify customer/admin flows and responsive views on the selected deployment; see final evidence for any 02.1 results. | Yes. |
| Accessibility | NOT VERIFIED | Revision 02 did not execute a complete accessibility workflow. Earlier reports noted low gold-on-ivory contrast and unverified dialog/drawer focus behavior; they are leads, not current measured results. Test keyboard, focus, contrast, screen-reader and mobile behavior against the current deployed UI. | Yes. |
| Hosting and deployment | BLOCKED BY ENVIRONMENT | No final hosting provider has been selected or purchased, and no production deployment was verified. Check PostgreSQL support, HTTPS, secret injection, persistent media, process supervision, backups, migrations, logs, cookies and proxy trust only when authorized infrastructure is available. | Yes. |
| Additional security/operations review | NOT VERIFIED | Historical reports note CSP `unsafe-inline`, admin MFA, broader CSRF/origin checks, database constraints, and media cleanup/sanitization limits. Do not assume these are remediated merely because documents changed. Review current code and host configuration; obtain explicit owner treatment of applicable risks. | Yes for release-critical security/operational gaps or until explicitly risk-accepted; prioritize per owner-approved threat model. |
| SMS.ir, PayPing, live OTP/payment, shipping APIs, cloud storage and production hosting integration | DEFERRED TO BATCH 09 | No live provider or production hosting was connected in Revision 02 or authorized in 02.1. Separate owner review and explicit approval are required before starting Batch 09; do not confuse preparation with implementation. | These integrations block a release that promises them; they are not a reason to represent the current unpaid/disconnected functionality as live. |

**Next authorized step:** review PR #6's completed PostgreSQL CI evidence and the remaining untested scenarios. Collect further verification only on explicitly authorized disposable infrastructure. Do not connect live services or claim release approval.

## Batch 09 review — 2026-11-19

**Status: INCOMPLETE; do not enable live PayPing.** SMS.ir Verify adapter code and PayPing v3 request/verification primitives were added, but PayPing has no order initiation/callback/settlement/reconciliation lifecycle in this package. Existing `captureVerifiedPayment` cannot safely accept a provider intent made before redirect. If provider verification succeeds and local stock capture/settlement fails, current code cannot durably preserve verified external payment evidence and provide an idempotent recovery path. Implement minimal durable attempt state, verified-but-unsettled reconciliation diagnostics and safe retry/manual operations, then test this exact failure before PayPing activation. Do not route a callback to the existing one-shot helper.

Current SMS changes are server-side and use SMS.ir Verify parameter `Code`; merchant account/template approval, exact template parameter match and provider sandbox have not been tested. No provider call, customer number, secret, production database, live charge, PostgreSQL multi-connection test or deployment was used. The OTP old-challenge selection policy remains unresolved and was not silently changed. See `BATCH_09_IMPLEMENTATION_REPORT.md` for official docs, code/test details and exact check outcomes.

## Batch 09 remediation review — 2026-11-19

**Status: source-remediated, not production-ready.** Remaining blockers are official PayPing amount-unit confirmation, authorized provider sandbox evidence, real PostgreSQL migration/locking/concurrency tests, full lint/test execution, and the unresolved OTP older-challenge policy. No live provider calls or production deployment were performed. Verified external payment evidence now persists in `payment_attempts` and local settlement failures are explicitly reconciliation-required.

## Batch 09 comprehensive audit status — 2026-11-20

- **Provider sandbox credentials and account confirmation — REQUIRES PROVIDER CONFIGURATION / MEDIUM:** no live PayPing or SMS.ir account evidence exists.
- **PayPing currency confirmation — REQUIRES PROVIDER CONFIGURATION / MEDIUM:** code uses the official WooCommerce Toman convention and strict IRR/10 conversion, but merchant account confirmation remains required.
- **Real PostgreSQL multi-connection concurrency — BLOCKED / MEDIUM:** PGlite/application tests pass; no real PostgreSQL test server was available.
- **Private platform tests — BLOCKED / LOW:** 4 script tests require absent private `.grok` files; application 226/226 and integration 103/103 pass.

## Batch 09 final corrective disposition — 2026-11-20

This section supersedes earlier historical statements that Batch 09 was unstarted or that the older OTP fallback policy remained unresolved. PayPing verification uncertainty is now durable and recoverable on the same owned attempt; confirmed rejection is terminal `failed`. The OTP policy is latest-issued-only with atomic invalidation of prior login challenges. Relevant lifecycle/provider/OTP tests pass. Remaining items are external: provider account/template/sandbox confirmation, PayPing amount-unit confirmation, real PostgreSQL multi-connection verification, deployment, and four absent private `.grok` script inputs. Final verdict: **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration.


## PR #6 PostgreSQL verification update — 2026-11-20

PR #6 CI run [44724055534](https://github.com/arefbrh/shahoo/actions/runs/44724055534) completed successfully for head `8c5b12be4cad81a46f9c823ff38d42394016dfe3`. Quality, Project tests, PostgreSQL integration/migrations, Security, Migration inventory and Payment/SMS mock jobs all passed; the private platform harness was skipped because its opt-in repository variable was not enabled.

The PostgreSQL job ran:
- 15 root migrations against the ephemeral PostgreSQL 16 CI service.
- Two independent PostgreSQL clients contending on one synthetic inventory row; row locking prevented overselling.
- The actual SHAHOO `commitCheckout` function with two independent customer carts racing for two available units: exactly one order succeeded, one safely rejected, exactly two units were reserved, no oversell occurred, and the rejected cart line remained.
- PostgreSQL 16 `pg_dump`/`pg_restore` into a separate scratch DB, comparing migration count, synthetic probe data and public index count.

All fixtures and databases were synthetic/disposable. No Neon, Vercel environment, Production DB, payment gateway or SMS provider was touched. PR #6 remains open and unmerged. The evidence is deliberately scoped: payment/expiry/duplicate-callback/order-transition/seed races, full migration upgrade parity, full disaster recovery and private platform harness remain open.


## PR #6 application expiry and payment capture verification — 2026-11-20

CI run [44729304066](https://github.com/arefbrh/shahoo/actions/runs/44729304066) passed for PR head `4ab448b95a86e8f73f15dc2ed6edc2eaf0663349`. The disposable PostgreSQL 16 harness now invokes three actual application functions: `commitCheckout` under a two-cart stock race; two concurrent `releaseExpiredHolds` workers against one expired unpaid order; and two concurrent `captureVerifiedPayment` calls against that expired order using a local in-memory fake provider. Assertions confirmed exactly one checkout, one expiry release/event/audit, and one late-payment recovery/capture/payment/stock decrement/paid event/audit. The same run passed typecheck, lint, build, project tests, security, payment/SMS mocks, migrations and PostgreSQL dump/restore; private platform harness was skipped as not enabled.

The fake provider does not make network calls and is not evidence of a live PayPing transaction. Remaining PostgreSQL work includes insufficient-stock/unsellable recovery rollback, competing checkout during recovery, coupon restoration, callback-route duplicate/settlement races, quote/order transition/RBAC, multi-process seed, full upgrade parity and production-like disaster recovery. PR #6 remains open and unmerged; no Neon, Vercel environment or Production DB was changed.


---

## PR #6 latest CI and commerce race evidence — 2026-11-20

This addendum supersedes the earlier PR #6 entries above where they say the recovery rollback matrix, duplicate callback race, coupon restoration, or latest Project tests were still open/pending.

Latest PR #6 head: `17c8e9dd38c7c6a792a39b2b430eb08cf715ab3d`. GitHub Actions run [44733552547](https://github.com/arefbrh/shahoo/actions/runs/44733552547) completed successfully:
- Project tests — success.
- PostgreSQL integration and migrations — success.
- Payment and SMS mock tests — success.
- Typecheck, lint and build — success.
- Security checks — success.
- Migration inventory — success.
- Optional private platform harness — skipped (not enabled); do not count this as passed.

Newly verified application test coverage:
- Seven-case late-payment recovery rollback matrix: unpublished/deleted product, inactive/deleted variant, inactive/deleted category and insufficient stock all deny capture without changing order/inventory or writing payment, inventory-log or audit side effects.
- Concurrent duplicate PayPing callback lifecycle: accepted responses, settled attempt, paid/verified order, exactly one payment row and one verified-payment log.
- Concurrent expiry/coupon restoration: exactly one expiry release/event/inventory log and coupon usage restored once.

These are synthetic CI tests with a local/mock provider, not live payment or SMS transactions. PostgreSQL tests run against disposable CI PostgreSQL 16, not Neon or Production. PR #6 remains open and unmerged.

Still open: callback HTTP route end-to-end integration; checkout competing with late-payment recovery; quote/order transition/RBAC; multi-process seed initialization; full fresh/upgrade migration parity and rollback injection; production-like disaster recovery including roles/globals, media, secrets, host/network configuration, encryption and retention. Live provider setup, separate Production Neon database and Production release gates remain outstanding.

## Post-merge status — 2026-11-20

PR #5 merged as 3c481a3e72dcfb6f65e46bc4dc23ef05c3d0024c. PR #6 merged as e190a57b6a7dd68c4e17da67968bbc7bed23bb5d. These merge records supersede earlier open/unmerged statements.

Full enabled CI passed on PR #6 code head d81447976ea758c47dd9be6829f309dbea85b18d in run 44735960032. Post-sync run 44739934934 passed PostgreSQL integration/deep concurrency/backup-restore, quality, security, payment/SMS mocks and migration inventory; Project tests were still in progress at merge time. Do not count it fully green until that job completes.

Verified PostgreSQL coverage includes checkout oversell prevention, concurrent cancellation single-transition semantics, one-time expiry release, one-time verified payment capture, and PG16 backup/restore with 15 migrations plus synthetic data/index verification. These tests used disposable CI infrastructure only.

Still open: PayPing callback HTTP route E2E; checkout racing late-payment recovery; quote/order transition and admin RBAC matrices; multi-process seed initialization; full fresh/upgrade migration parity and rollback injection; production-like disaster recovery including roles/globals, external media, secrets, host/network, encryption and retention. Production primary branch schema/data verification, Production Vercel environment review, live payment/SMS providers and real order E2E remain release blockers. The PR #1 open/Draft note in this 2026-11-20 historical section is superseded by the 2026-11-24 reconciliation: PR #1, #8 and #9 are merged; PR #10 is closed without merge.


## Infrastructure integration follow-up — 2026-11-24

| Finding | Status | Evidence and required action | Release blocking |
|---|---|---|---|
| Antigravity V2 source additions | INTEGRATION CANDIDATE | ZIP compared with `main`; added city, carrier, CMS FAQ/trust, product FAQ, invoice export/branding and Torob feed changes. Torob schema and route-tree defects found and corrected in the candidate. Run typecheck, lint and all suites. | Yes until CI passes and storefront flows are reviewed. |
| Self-hosted Docker build | SOURCE-CORRECTED / NOT VERIFIED | Nitro preset now explicitly `node-server`; runtime image includes production dependencies and source required by worker. Docker CLI/daemon unavailable here. Run `docker compose config`, image build and container smoke tests. | Yes before self-hosted cutover. |
| Existing PostgreSQL volume role migration | OPEN | The new init SQL runs automatically only on a fresh Docker volume. Existing DB volumes must not be deleted or reinitialized; a separate reviewed role/ownership migration is required. | Yes before connecting the self-hosted app to an existing DB. |
| Production environment contract | SOURCE-CORRECTED / NOT VERIFIED | Candidate template/Compose now use `APP_URL`, `PAYPING_LIVE`, `SMS_IR_OTP_TEMPLATE_ID`, `SMS_LIVE` and `SHAHOO_TRUST_PROXY`, matching current source. Verify on a disposable host without enabling live providers. | Yes before host provisioning. |
| Worker scheduling and health | SOURCE-CORRECTED / NOT VERIFIED | Worker loop now exits on unhandled maintenance failure, allowing container restart; heartbeat is checked by healthcheck. Verify actual restart, stale heartbeat and DB connectivity on PostgreSQL. | Yes before self-hosted Production. |
| PostgreSQL and media backup | PARTIALLY IMPLEMENTED | Linux scripts create/validate logical DB dumps and media archives; Windows DB backup/restore scripts check native exit codes. No runtime backup/restore has been executed. | Yes before Production data is accepted. |
| WAL/PITR, encryption and off-site backup | OPEN | No WAL archiving, PITR, encryption key management or independent off-site replication is configured. Runbook now labels these as unimplemented. | Yes for disaster-recovery readiness. |
| Torob product feed | SOURCE-CORRECTED / NOT VERIFIED | Feed now joins active variants, inventory and primary product images; it no longer claims every product is 100% extra virgin. Validate current Torob feed schema and sample output before submitting it. | Yes before advertising this integration as live. |
| Windows native deployment | SOURCE-CORRECTED / NOT VERIFIED | Caddy Windows upstream, `.env` propagation to NSSM, explicit database URL and restore exit-code checks corrected. PowerShell/NSSM/Caddy execution not available here. | Yes before Windows deployment. |
| Full validation of V2 candidate | BLOCKED BY ENVIRONMENT | `npm ci` timed out twice; no Docker or PowerShell runtime. CI must run TypeScript, lint, script/application/migration tests, production build and Docker checks. | Yes before merge to the production deployment branch. |


## Continuation update — 2026-11-25

A Vercel Sandbox retry of `npm run test:project` completed with 479/479 passing (113 script, 236 application, 130 migration/integration). TypeScript and ESLint passed on Node 26.13.1; the auth invariant passed with a live dev server; the Sandbox npm audit reported zero vulnerabilities. These checks were run against a GitHub `main` checkout plus a selected overlay, not the complete refreshed handoff ZIP.

Neon Object Storage is enabled on both Staging and Production. A private `shahoo-media` bucket was created and verified on Staging only. No Production bucket, Production credential, Production database migration, or Production deployment was created. The S3 adapter now accepts Neon's AWS-standard environment variables, but application-level PUT/GET/DELETE and Vercel Preview configuration remain open.

The unsafe `vercel.json` install override (`npm install --omit=dev`) was removed from the candidate. Full candidate ZIP validation, Docker/Compose, real PostgreSQL restore, PowerShell, real provider tests, and Preview smoke tests remain release gates.
