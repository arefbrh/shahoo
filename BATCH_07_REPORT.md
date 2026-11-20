# SHAHOO v1.0.0 — Batch 07 Revision 01 Report

**Date:** 2026-11-19  
**Exact starting source:** `SHAHOO-v1.0.0-batch07.zip`, extracted to a separate revision workspace before editing. Batch 06 was used only for the required pre-existing test-failure comparison.  
**Deliverable:** `SHAHOO-v1.0.0-batch07-revision01.zip`  
**Status:** Batch 07 implementation and this focused correction revision are complete; **pending owner approval**. Batch 08 and Batch 09 have not started. Stop for owner review.

## Revision scope

This is a narrowly scoped test and documentation revision. The Batch 07 order, customer, inventory, authorization, lifecycle and migration implementation was preserved. The revision adds focused tests for the six identified admin desk functions, strengthens existing fulfillment assertions for mandatory reasons and audit history, registers the new suite with the existing test runner, and aligns the current handoff documents. No new migration or permanent project decision was introduced; `DECISIONS.md` was not changed.

## Exact files changed in this revision

| File | Reason |
|---|---|
| `package.json` | Register `src/server/admin/desk.test.ts` in the existing alias-enabled, migration-aware PGlite test phase. No dependencies or lockfile changes. |
| `src/server/admin/desk.test.ts` | New focused PGlite integration tests for authorized/unauthorized order, customer and inventory desks; search/filter/pagination; details/privacy; customer status reason/audit; and inventory adjustment validation, snapshots, history and PGlite concurrency behavior. Tests use actual request context, hashed session cookies and service logic; business logic is not mocked. |
| `src/server/completion/flow.test.ts` | Extend existing lifecycle regressions with blank-reason and invalid-transition checks plus order, shipment, return-review and refund audit/history assertions. Existing valid lifecycle and duplicate-protection tests remain in place. |
| `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` | Correct the top-level current workflow status, preserve the 100-record media-picker boundary, add the explicit quoteCart Batch 08 follow-up, and append the current Revision 01 handoff without deleting history. |
| `PROJECT_HANDOVER.md` | Add the current owner-review stop point and Batch 08 checklist; correct the quoteCart claim and stale description of shipment/refund capabilities. |
| `PROJECT_STATE.md` | Add the current Batch 07 status, migration 0012 summary, media limit and quoteCart follow-up; label the original Batch 06 stop notice as historical. |
| `REMAINING_ISSUES.md` | Replace stale current-status summary with the consistent Batch 07 state; retain the Batch 06 paragraph as historical and enumerate required Batch 08 follow-ups. |
| `BATCH_07_REPORT.md` | Replace the incomplete prior report with this exact Revision 01 record. |

`migrations/0012_batch_07_inventory_audit.sql` is unchanged in this revision. The earlier Batch 07 application files are likewise unchanged by this revision.

## Focused test coverage and results

**Command:**

```bash
env -u DATABASE_URL node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/admin/desk.test.ts src/server/completion/flow.test.ts
```

**Result:** 18 passed, 0 failed. This includes all three new admin integration tests and the 15 existing completion-flow regressions with the added reason/audit assertions.

The new test cases are:

- `admin order/customer desks enforce permissions, privacy, search, and bounded pagination`
- `customer status mutation requires write permission and an audited reason without changing the verified mobile`
- `inventory desk and adjustments enforce permissions, stock bounds, snapshots, reason history, audit, and PGlite race behavior`

The order/customer desk test exercises `loadAdminOrders`, `loadCustomers` and `loadCustomer`, including authenticated and denied access, payment/status/search filters, bounded pagination, recent-order/address projections, and permission-based mobile/address masking. The customer mutation test exercises `setCustomerStatus`, including missing-reason, insufficient-permission and invalid-state rejection, immutable verified mobile behavior, status filtering and the persisted actor/from/to/reason audit row. There is no ordinary admin profile-edit write path in this scope; no such mutation was added. A customer-authenticated profile update and an admin status change are both verified not to change the OTP-verified mobile.

The inventory test exercises `loadInventoryDesk` and `adjustInventory`: authorized and denied access, `sellable = onHand - reserved`, invalid/zero/below-reserved deltas, mandatory reason, permission enforcement, on-hand/reserved snapshots, movement history, audit metadata, and two competing PGlite adjustments where only one can safely reduce stock to the reserved floor. **This is PGlite coverage only and does not prove PostgreSQL multi-connection locking behavior.**

The existing fulfillment cases preserve and exercise valid transitions, illegal transition rejection, one-time unpaid cancellation and hold release, duplicate-cancellation protection, paid-cancellation/refund safeguards, shipment/return/refund reason validation, and audit/history creation. The modified named cases include `shipment and refund stay ledger-only until a real gateway exists` and `unpaid cancel releases a hold once and a paid cancel needs an internal refund`; existing capture, return-transition, duplicate-review and refund-ceiling tests also remain.

## Complete test suite

**Command:** `env -u DATABASE_URL npm test`  
**Result:** the command exits nonzero because the first platform/scaffold script-test group retains ten pre-existing failures. The application and PGlite/integration groups both pass in full:

| Test group | Result |
|---|---:|
| Platform/script tests | 205 passed, 10 failed (215 total) |
| Application tests | 214 passed, 0 failed |
| PGlite/integration tests, including the new admin suite | 83 passed, 0 failed |

### Investigation of every failed script test

The same `node --test 'scripts/**/*.test.mjs'` group was run from the exact archived Batch 06 comparison source. It reported the **same ten test names and the same 205 passed / 10 failed out of 215**. The implicated script tests and relevant application sources were also compared byte-for-byte where present; they are unchanged between the Batch 06 archive and the Batch 07 revision. Neither source archive contains `.grok/app-env.json` or the private `.grok/skills/og` tree. These failures therefore are not regressions introduced by Batch 07. They were preserved, not skipped, deleted or weakened.

| Exact failing test | Error summary and classification | Batch 06 evidence / Batch 08 disposition |
|---|---|---|
| `SKILL.md and AGENTS.md name the marker path and bound this script uses` | `ENOENT` opening `.grok/skills/og/SKILL.md`; owner/platform skill file is absent from the source archive. Environment/private-file dependent; pre-existing. | Same test fails in Batch 06; neither archive contains the path. Keep open for platform/test-harness triage in Batch 08; do not invent private skill content. |
| `the sections that own the brand-task prohibition never affirm a wait` | Same `ENOENT` for `.grok/skills/og/SKILL.md`. Environment/private-file dependent; pre-existing. | Same failure in Batch 06. Keep with the missing owner-skill harness follow-up. |
| `SKILL.md tells the pass to self-check with the flag this CLI accepts` | Same `ENOENT` for `.grok/skills/og/SKILL.md`. Environment/private-file dependent; pre-existing. | Same failure in Batch 06. Keep with the missing owner-skill harness follow-up. |
| `the build side resolves the template's shipped app-env` | `buildAuthEnabled(projectRoot(), {})` evaluates `true` where the test expects `false`; the archive has no `.grok/app-env.json`, so the test's private workspace setting is unavailable. Environment/config-dependent; pre-existing. | Same test fails in Batch 06 and the test/helper are byte-identical. Resolve only with an authorized canonical test environment/configuration; do not silently change the expected auth behavior. |
| `media upload does not read the event after an await and cannot double-submit` | Static assertion requires `uploadBusy` (and related binary-upload markers), absent from the unchanged CMS desk. The shipped CMS registers public HTTPS media URLs; it does not expose binary file upload or object storage. Obsolete/inapplicable static expectation for this source; pre-existing. | Same failure and unchanged CMS source in Batch 06. If needed, triage the scaffold assertion in Batch 08; this revision is explicitly forbidden from adding file upload/storage. |
| `accessibility basics in the shell and shared field style` | Static assertion expects an explicit `aria-label="کد پستی"`; the unchanged address-book input is nested under a visible Persian `<label>کد پستی</label>`. This is a narrow test-selector mismatch, not a browser accessibility result. Pre-existing; keyboard/screen-reader behavior remains unverified. | Same failure and unchanged `shell.tsx`, `ui.ts`, and `address-book.tsx` in Batch 06. Review the assertion and perform the required real browser/accessibility review in Batch 08; do not claim accessibility passed from this static test. |
| `the template ships auth off` | `readAppEnv(projectRoot())` returns `{}` instead of `{ VITE_AUTH_ENABLED: "false" }` because `.grok/app-env.json` is not in the archive. Environment/config-dependent; pre-existing. | Same failure in Batch 06. Confirm the canonical deployment/test environment in Batch 08; do not fabricate a private config file. |
| `the wrapped command runs with the app env applied` | Child prints `undefined` instead of `false`; same absent `.grok/app-env.json` as above. Environment/config-dependent; pre-existing. | Same failure in Batch 06; wrapper and test are byte-identical. Keep with app-env harness triage. |
| `the CLI still runs when invoked through a symlinked path` | Child prints `undefined` instead of `false`; invocation reaches the wrapper, but the expected private app-env value is absent. Environment/config-dependent; pre-existing, not evidence that the symlink guard itself regressed. | Same failure in Batch 06; wrapper and test are byte-identical. Keep with app-env harness triage. |
| `every hand-over the og skill prints is one this script accepts` | `ENOENT` scanning `.grok/skills/og/references`; private owner skill references are absent from the archive. Environment/private-file dependent; pre-existing. | Same failure in Batch 06; neither archive contains those references. Keep with the missing owner-skill harness follow-up. |

No failures were attributed to a Batch 07 regression. The four missing owner-skill-file failures and four app-env-related failures need the appropriate private platform/test context. The media-upload and postal-label failures are stale/narrow source assertions; Batch 08 should reconcile those tests with supported behavior while retaining real browser/accessibility review. No valid assertion was altered in this revision.

## Other verification

- **TypeScript:** `npx tsc --noEmit` — passed after the request-context test helper and nullable-detail assertions were made type-safe.
- **ESLint:** `npx eslint .` — completed with **0 errors and 5 warnings**. Existing warnings: `cart-drawer.tsx:94` and `cart-view.tsx:78` ref cleanup dependencies; `cart-intent-notices.tsx:7` Fast Refresh export shape; `support-desk.tsx:253` mount-effect `loadReturns` dependency; `checkout-safety.test.ts:11` unused `carts` binding. There were no lint errors.
- **Production build:** `env -u DATABASE_URL npm run build` — passed. The bundler printed upstream dependency warnings about module-level `"use client"` directives; no build failure occurred. The build did not run migrations.
- **No test dependency:** no package dependency or lockfile change was made.

## Migration 0012 and deployment boundary

`migrations/0012_batch_07_inventory_audit.sql` exists to preserve verifiable stock state at the time of inventory movements. It changes only `inventory_logs` by adding nullable integer columns `on_hand_before`, `on_hand_after`, `reserved_before`, and `reserved_after`, plus nullable `order_id` referencing `orders(id) ON DELETE SET NULL`. It adds the `inventory_logs_order_idx` index. It does not add a non-null/check constraint and intentionally does not backfill old log rows because historical balances/order links cannot be reconstructed reliably from deltas.

This is additive/backward-compatible for prior rows and old readers: existing values remain and new columns are nullable. The new application paths can populate snapshots and order linkage; pre-existing historical rows remain null in those fields. Apply the migration before deploying code that selects or writes the new columns. Use the existing guarded `npm run db:migrate` process with an authorized backup/rollout plan; application startup and `npm run build` do not migrate. Migration and new logging behavior were exercised in PGlite only. **No real PostgreSQL database, production migration, or deployment was tested in this revision.**

## Four-part test status

### 1. Tests executed and passed

- Focused admin/lifecycle command above: **18/18 passed**, including the three new desk integration tests.
- Final complete test run: application group **214/214 passed**; PGlite/integration group **83/83 passed**.
- `npx tsc --noEmit` passed.
- `npx eslint .` completed with 0 errors (5 warnings listed above).
- `env -u DATABASE_URL npm run build` passed.

### 2. Tests executed and failed

- Platform/script group in `env -u DATABASE_URL npm test`: **10/215 failed**, with exact names, errors, classification and Batch 06 comparison evidence listed above. The same ten fail on the Batch 06 baseline. None is a Batch 07 regression. The overall `npm test` command therefore exits 1 despite both application test groups passing.
- No new admin, customer, inventory, lifecycle, TypeScript or build failure remains.

### 3. Tests not executed because of environment limitations

- Real PostgreSQL multi-connection concurrency for inventory adjustment/order locking; PGlite is not equivalent.
- Production/authorized PostgreSQL execution of migration 0012, backup/restore, and deployment rollout.
- Browser E2E, live responsive behavior, keyboard/focus/screen-reader checks, and production-host validation.
- Tests requiring private `.grok/skills/og` or `.grok/app-env.json` inputs beyond the script failures described above.
- The actual build/runtime `VITE_AUTH_ENABLED` setting on the deployment target. `.env.example` documents `false`, but this archive contains no real `.env` or private `.grok/app-env.json`, and the code defaults the flag to enabled when absent; explicitly verify `false` before deployment.

### 4. Tests not applicable to this revision

- Real payment-gateway settlement, SMS.ir/PayPing, shipping-carrier APIs, binary media/object-storage deployment, and bulk-to-packaged conversion. They were not implemented or called, as required by the Batch 07 scope.
- The `quoteCart` comparison is a required Batch 08 investigation, not a confirmed defect or a Batch 07 change; it was not implemented or tested in this correction revision.

## Final state and stop point

The Batch 07 administrative implementation, exact 24-hour stock hold, `sellable = onHand - reserved` formula, authorization boundaries, reason requirements, internal-only refunds, manual shipment records, and transaction/locking behavior remain unchanged. The revision corrected the test gap, linked the focused suite into `npm test`, documented the precise pre-existing script-test failures, and aligned the four project status/handoff documents. The newest-100 CMS media-picker limitation remains: server-side pagination/load-more is not implemented.

The source and revision report are ready for **owner review only**. No owner approval is claimed. Do not start Batch 08 or Batch 09, and make no further changes automatically; wait for explicit owner review and approval.
