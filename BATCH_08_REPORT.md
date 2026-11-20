> **Historical report, superseded:** This report and all of its old “current” banners describe their respective past checkpoints, not the present. For Batch 08 Revision 02.1, current release status and independently reproduced results, use `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` and `BATCH_08_FINAL_RELEASE_EVIDENCE.md`. Historical test counts are unchanged.

---

<!-- BATCH 08 REVISION 02 CURRENT STATUS -->
> **Batch 08 Revision 02 current status (2026-11-19):** Revision 02 started from the exact Revision 01 archive and remains **NOT READY FOR RELEASE**. Auth is now explicit opt-in/fail-closed; reviewed `typescript-eslint@8.73.0` leaves `npm audit` at 0 vulnerabilities; demo homepage seeding now preserves migration-provisioned section types; typecheck, build, application tests (215/215), migration/PGlite tests (94/94), focused auth tests, and bounded desktop/mobile runtime smoke pass. The configured script group is partial (212/216; four failures require absent private `.grok/skills/og` harness files). Real PostgreSQL fresh/upgrade/concurrency, backup/restore, authorized target-host verification, and complete accessibility review remain unavailable. **Batch 09 has not started; no real providers or production hosting were connected.**

> **Historical Batch 08 report:** The original report below was written before Revision 01 remediation and is retained for chronology. The current authoritative status, corrected dependency findings, exact updated test totals, quote/cart evidence, and release decision are in [`BATCH_08_REVISION_01_REPORT.md`](BATCH_08_REVISION_01_REPORT.md).
>
> **Revision 01 current result (2026-11-19):** QuoteCart/cart consistency is resolved; Better Auth is pinned to `1.7.26`; audit is 7 moderate with 0 low/high/critical; platform/scripts are 207/215 passed with 8 private-harness failures; application tests are 214/214; migration/PGlite tests are 93/93; and the release recommendation remains **NOT READY FOR RELEASE**.

# SHAHOO v1.0.0 — Batch 08 Final Comprehensive Audit

**Date:** 2026-11-19  
**Authoritative input:** `SHAHOO-v1.0.0-batch07-revision01.zip`  
**Source SHA-256:** `9e9ec41fb296bb587d6431ae98af95ff1b27652b93926d00f22bb5e3c1b3c918`  
**Scope:** audit, testing, safe focused fixes, documentation, and review archive only. No SMS.ir, PayPing, live payment, live refund, or production deployment was performed.

## A. Executive summary

The source was extracted and inspected from the authoritative Batch 07 Revision 01 archive. Dependencies installed successfully with `npm ci` from the existing lockfile. TypeScript, production build, all application tests, all PGlite/integration tests, the auth-source checks, and the new quoteCart sellability regression tests passed. ESLint completed with zero errors and five existing warnings.

A confirmed commerce consistency defect was found and fixed. `quoteCart` checked product publication and category state but did not enforce product deletion, variant status, or variant deletion. It could therefore quote a line that the actual cart mutation path rejects. The quote path now uses the shared sellability rule and includes all relevant state. Cart lookups also now reject soft-deleted variants. Seven regression cases passed, covering unpublished/deleted products, inactive/deleted categories, inactive/deleted variants, and a valid line.

The release decision is **C. NOT READY FOR RELEASE**. This is not because the local code/build checks failed; it is because critical release evidence remains unavailable: no real PostgreSQL server was available, no independent-connection concurrency test was run in this environment, no migration upgrade or backup/restore was verified on PostgreSQL, browser/mobile/accessibility runtime checks were not completed, and the actual deployment `VITE_AUTH_ENABLED=false` setting was not demonstrated. The configured platform script group also exits nonzero with 9 failures out of 215; those are pre-existing environment/private-harness failures or an obsolete static expectation, but the complete configured command is not green.

## B. Environment

- OS: Linux x86_64, kernel `6.18.38+`.
- Node.js: `v22.23.4`.
- npm: `10.9.9`.
- Package manager: npm; `npm ci` succeeded from `package-lock.json`.
- PostgreSQL: **not available** (`psql` and `pg_isready` unavailable; no server used).
- Browser runtime: no authorized browser/E2E environment was available for this extracted project.
- Dependency audit: 10 findings reported by `npm audit` (2 low, 7 moderate, 1 critical). The critical path is the scaffold dependency `better-auth`; SHAHOO’s active custom customer/admin authentication path does not use Better Auth, but the dependency remains in the manifest and must be resolved or explicitly risk-accepted before release.
- Source archive integrity: ZIP extraction succeeded and the source SHA-256 is recorded above.

## C. Test results

| Area | Result | Evidence |
|---|---:|---|
| TypeScript | **PASS** | `npm run typecheck`, exit 0 |
| ESLint | **PASS with 5 warnings** | `npm run lint`, 0 errors; existing React hook/Fast Refresh/test-variable warnings |
| Platform/script tests | **206 passed / 9 failed / 215** | `node --test 'scripts/**/*.test.mjs'` within `npm test` |
| Application tests | **214 passed / 0 failed / 214** | application phase of `npm test` |
| PGlite/integration tests | **90 passed / 0 failed / 90** | migration-aware phase of `npm test`, including new quoteCart suite |
| New quoteCart regression tests | **7 passed / 0 failed** | `src/server/storefront/quote-cart-rules.test.ts` |
| Shared sellability tests | **7 passed / 0 failed** | `src/lib/commerce-integrity.test.ts` |
| Production build | **PASS** | `npm run build`, exit 0; `.vercel/output` generated |
| Auth invariant command | **NOT PASS / environment limitation** | `npm run check:auth` could not read resolved `VITE_AUTH_ENABLED` from a dev server |
| Migration guard | **PASS** | `npm run db:migrate` refused safely without `DATABASE_URL` |
| Real PostgreSQL fresh migration | **NOT EXECUTED** | PostgreSQL client/server unavailable |
| Real PostgreSQL upgrade path | **NOT EXECUTED** | PostgreSQL client/server unavailable |
| Real PostgreSQL concurrency | **NOT EXECUTED** | No independent PostgreSQL connections available |
| Backup/restore | **NOT EXECUTED** | No disposable PostgreSQL instance available |
| Browser desktop E2E | **NOT EXECUTED** | No browser/E2E runtime evidence produced in this environment |
| Mobile viewport tests | **NOT EXECUTED** | No actual mobile viewport run |
| Accessibility runtime checks | **NOT EXECUTED** | Static source check passes for postal label; keyboard/focus/screen-reader behavior remains unverified |

### Platform/script failures

The nine failures are not treated as a green suite. Three require the absent private `.grok/skills/og/SKILL.md` or its references. Four require the absent private `.grok/app-env.json` and therefore cannot verify the workspace’s expected auth-off flag. One expects an `uploadBusy` binary-upload UI that the supported CMS intentionally does not provide; the project uses HTTPS media registration and has no production binary/object-storage workflow. One earlier postal-label static expectation was corrected by adding an explicit `aria-label="کد پستی"`; the final focused frontend check then passed 9/10, with only the obsolete upload expectation remaining.

## D. Security audit

### Confirmed findings

1. **SH-08-001 — Critical dependency audit finding — unresolved.** `npm audit` reports a critical Better Auth advisory in the dependency tree. The active SHAHOO auth implementation is custom, but the vulnerable scaffold dependency remains installed. No major version upgrade was performed because the batch rules prohibit speculative dependency changes. Before release, remove the unused dependency if safe or upgrade it with a dedicated compatibility review and lockfile update.
2. **SH-08-002 — High release evidence gap — unresolved.** The archive has no real `.env` or private app-env file. The documented safe value is `VITE_AUTH_ENABLED=false`, but the source defaults the absent flag to enabled and the deployment value was not verified. The deployment pipeline must set and verify the flag explicitly before release.
3. **SH-08-003 — High verification gap — unresolved.** Real PostgreSQL fresh install, upgrade, transaction, locking, and independent-connection concurrency behavior were not executed. PGlite results are not a substitute for this evidence.
4. **SH-08-004 — High operational verification gap — unresolved.** Backup/restore, production migration rollout, reverse-proxy cookie behavior, health checks, restart/graceful shutdown, and persistent local media behavior were not verified on the intended hosting configuration.
5. **SH-08-005 — Medium/High browser evidence gap — unresolved.** Desktop, narrow iPhone-sized mobile, keyboard/focus, dialog, touch-target, and screen-reader checks were not run. Static source checks are not runtime accessibility proof.
6. **SH-08-006 — Medium dependency maintenance.** npm reports seven moderate and two low findings in addition to the critical Better Auth path. Do not use `npm audit fix --force` in this batch; resolve through a reviewed dependency maintenance change.

### Positive security evidence

Production without `DATABASE_URL` fails closed; migration without `DATABASE_URL` refuses to run; development/demo/mock flags are guarded from production; server-side RBAC and customer/admin separation are present; uploaded media is authenticated and permission-protected before reading the body, bounded by size, and stored through the existing sanitizer/storage path; no credentials, private keys, real `.env`, customer data, or production dump were found in the archive.

## E. Commerce and data integrity

The audit compared `quoteCart` with cart mutation behavior. The confirmed drift was fixed by selecting product deletion, variant status, variant deletion, and category state and passing them through the shared `isLineSellable` rule. Both paths now require: published product, non-deleted product, active non-deleted variant, existing active non-deleted category. Inventory quantity remains server-derived as `onHand - reserved`; prices remain server-derived. The new seven-case regression suite passed.

Existing application/integration tests also passed for cart merge/adoption, server pricing, checkout idempotency, reservation expiry, payment state safeguards, cancellation, refunds, media reference locking, order transitions, customer ownership, inventory adjustments, admin permissions, and CMS writes. No live payment or refund was attempted. Ledger records remain internal records, not financial settlement.

Remaining commerce risks are operational rather than newly introduced: no real PostgreSQL concurrency proof, no hold-expiry scheduler, and future gateway reconciliation still requires a dedicated design before Batch 09.

## F. Catalog, CMS, and media

Product, variant, gallery, CMS, article, menu, homepage section, and media integration tests in the application/PGlite phases passed. The approved homepage decisions were preserved: no «برگزیده‌ها», and the existing «پرفروش‌های شاهو», «تازه‌های ماه», and «پیشنهادهای ویژه» sections remain CMS-driven. The media picker’s newest-100-record limitation remains documented and was not expanded into pagination.

`/api/media-upload` is reachable as a route but requires an admin with `content.write`, bounds the request and image size, parses multipart data after bounded reading, and delegates storage/sanitization. It is not a claim of production-ready binary uploads: local persistent storage/object storage and host durability remain provider-dependent, and production local storage is disabled unless explicitly configured.

## G. Production readiness checklist

Before any deployment, an owner/operator must:

1. Choose and document the Iranian hosting provider and whether the target is Windows Server 2022 + Node.js + PostgreSQL + IIS or another supported topology.
2. Set a supported Node.js version compatible with the lockfile and confirm the production start command.
3. Provide a least-privilege PostgreSQL database and set `DATABASE_URL`; do not expose PostgreSQL publicly.
4. Set `APP_URL` to the HTTPS canonical origin.
5. Set `VITE_AUTH_ENABLED=false` explicitly in the build and runtime environment, then verify the built/runtime value.
6. Run the guarded migration command with a pre-migration backup; never run destructive migration commands against production.
7. Confirm `npm run build` does not migrate and that the production start command serves the built output.
8. Keep `SEED_DEMO`, `ECHO_OTP`, `ALLOW_MOCK_PAYMENT`, `ALLOW_MOCK_SMS`, and `ALLOW_DEV_CSP` unset/disabled in production.
9. Decide whether persistent local media is supported. If not, keep binary upload disabled and use approved HTTPS media registration only.
10. Configure reverse proxy HTTPS, secure cookies, forwarded-header policy, logs without secrets, process supervision, restart behavior, graceful shutdown, and a health check.
11. Perform a disposable PostgreSQL fresh migration, upgrade, concurrent inventory/checkout test, and backup/restore test before release.
12. Run browser desktop/mobile/accessibility checks against the deployed candidate.
13. Resolve or explicitly risk-accept the npm audit findings, especially Better Auth.

## H. Modified files

- `src/server/storefront/api.ts` — quoteCart now applies the complete shared sellability rule.
- `src/server/commerce/cart.ts` — cart lookup includes and rejects soft-deleted variants.
- `src/lib/commerce-integrity.ts` — shared rule accepts variant deletion state.
- `src/server/storefront/quote-cart-rules.test.ts` — new seven-case quote/cart sellability regression suite.
- `src/components/site/address-book.tsx` — explicit postal-code accessible name.
- `package.json` — registers the new regression suite in the migration-aware test phase.
- `BATCH_08_REPORT.md` — this report.
- `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `PROJECT_HANDOVER.md`, `PROJECT_STATE.md`, `REMAINING_ISSUES.md` — current Batch 08 handoff/status sections appended without removing historical records.

No historical migration was edited. No dependency version was changed. `DECISIONS.md` was not changed because no permanent business decision was made.

## I. Known limitations

The release blockers are the unresolved critical dependency audit item, missing deployment auth verification, unavailable real PostgreSQL evidence, unavailable browser/mobile/accessibility runtime evidence, unverified backup/restore and target-host operations, and the non-green configured platform script group. The media picker remains limited to the newest 100 records. No live payment, SMS, PayPing, SMS.ir, shipping API, or production deployment was performed.

## J. Batch 09 handoff

Batch 09 remains separate and pending. Future SMS.ir integration requires provider configuration, OTP delivery/error/retry policy, per-mobile and per-IP throttling, provider response normalization, secret handling, and tests without real messages by default. Future PayPing integration requires a provider adapter, initiation/callback separation, signed callback verification, exact order/amount/currency binding, idempotency, replay protection, timeout/reconciliation handling, and a clear policy for payment success when stock recovery fails. No such integration was implemented in Batch 08.

## K. Final release decision

**C. NOT READY FOR RELEASE.**

This decision is based on unresolved high/critical release evidence and dependency/security findings, not on a failing TypeScript or build check. Stop after this review. Do not begin Batch 09 or deploy to production without explicit owner review and approval.

## L. Final review archive

Because release blockers remain, the complete review archive is `SHAHOO-v1.0.0-batch08-review.zip`.

- Archive file count: 475
- Archive size before this metadata refresh: 6,141,761 bytes
- ZIP integrity: verified with `unzip -t`
- The final regenerated archive checksum is recorded in the delivery response; regenerate metadata if the report itself is changed again.
