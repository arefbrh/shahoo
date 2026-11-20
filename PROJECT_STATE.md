# SHAHOO — Project State

> **Historical state snapshots follow.** This file contains detailed status records from earlier batches and may contain superseded dates, release gates, and next actions. The canonical current state is [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md); current unresolved findings are in [REMAINING_ISSUES.md](REMAINING_ISSUES.md).

## Current workflow status — Batch 09 remediation (2026-11-19)

The latest completed remediation is **Batch 08 Revision 02**, whose implementation has been completed and reviewed. **Revision 02.1** is the current documentation and release-evidence reconciliation stage, not final release approval. The release decision remains **NOT READY FOR RELEASE**; Batch 09 source remediation is complete for owner review. The next action is independent review of the archive, the evidence and remaining blockers; no later phase or provider work is authorized by this handoff.

The verified input is `SHAHOO-v1.0.0-batch08-revision02.zip`, SHA-256 `eb5aac8b54e0edeb233a2fb2c23e0adda72358b5b36e61812992e015083907cd`: ZIP integrity passed, with 385 files and 41 directory entries. The intended output is `SHAHOO-v1.0.0-batch08-revision02.1.zip`; its checksum is not self-contained inside the ZIP and must be checked against the detached final-delivery checksum. Do not mistake the input hash for the output hash.

Source inspection confirms `quoteCart` and cart mutations use the shared product/variant/category sellability rule, with pure and PGlite database-path regression tests present; Revision 02 also changed demo seeding to skip already-provisioned homepage section types. Better Auth is pinned at `1.7.26` and the lockfile has `typescript-eslint@8.73.0`; the older Better Auth critical advisory and seven moderate findings are superseded by Revision 02's reported audit, not current counts.

**Auth correction in 02.1:** Revision 02 had a real direct-server discrepancy: whitespace-padded `" true "` enabled gate and server paths even though the wrapper disabled it. Two narrow comparisons were changed to read the raw value. The added gate/direct-server regression failed before the change and passed afterward (27/27 gate tests); only raw exact `"true"` opts in. Different build/runtime environments can still disagree, so explicitly configure and verify `VITE_AUTH_ENABLED=false` in both on the chosen host. SHAHOO custom OTP/session/RBAC is separate from this platform scaffold.

**Credential exposure / 02.1 correction:** The input archive contained a hardcoded shared platform-preview OAuth client secret in `src/lib/auth/preview.ts`. It has been removed from this output. Optional broker OAuth now needs an injected `GROK_AUTH_CLIENT_SECRET` or `GROK_PREVIEW_CLIENT_SECRET` and remains unavailable without one; exact `VITE_AUTH_ENABLED=true` may still enable the separate gate path. This does not change SHAHOO's custom customer/admin auth. The input may already have exposed the credential: the credential owner should assess and rotate/revoke it and review exposure; rotation and live provider verification were not performed. Keep secrets outside the archive.

All Revision 02 test figures below are **prior reported results**, not the current rerun: `npm ci`, typecheck and build passed; lint had 0 errors/5 warnings; application 215/215, migration/PGlite 94/94, auth wrapper/invariant 24/24, gate identity 25/25, and bounded desktop/mobile homepage smoke passed; configured platform/script tests had 212/216 passing with four missing-private-harness failures; audit reported zero vulnerabilities. Revision 02.1 reruns are underway. See `BATCH_08_FINAL_RELEASE_EVIDENCE.md` for fresh results when recorded; do not infer a completed rerun or a green overall `npm test` from prior numbers.

Release-critical evidence remains open or unverified: real PostgreSQL fresh/upgrade and independent-connection transaction/concurrency behavior; backup/restore; full desktop/mobile browser E2E and accessibility; actual selected host, proxy/cookies, media, deployment and auth-off configuration; and the complete private `.grok/skills/og` harness. The original descriptions of 11 medium and 6 low Claude findings were not located in the prior report and remain **UNVERIFIED — ORIGINAL SOURCE MISSING**; do not invent or close them. Live SMS/OTP, PayPing/payment, shipping APIs, cloud storage and hosting are deferred; real gateway reconciliation, lazy hold expiry, guest checkout throttling and other open issues require separate review. Consult `REMAINING_ISSUES.md` and the final evidence register for current detail.

## Batch 06 status snapshot (historical; superseded by the current status above)

The paragraph below preserves the original Batch 06 handoff state. Its instruction not to begin Batch 07 applied only at that time and is superseded by the current workflow status above.

Batch 06 is implemented on the owner-supplied complete Batch 05 ZIP and delivered as `SHAHOO-v1.0.0-batch06-product-cms.zip` for owner review. Product administration now covers supported existing product content/specs/SEO, optional oil-guide fields, variant values and product gallery management; CMS supports bounded media/article lists with search, page creation at `/pages/{slug}`, existing menus/banners/homepage sections and magazine article SEO. No migration was added; migrations `0001`–`0011` are unchanged. Focused PGlite/pure/commerce-account regressions, targeted ESLint and TS/TSX checks passed; exact evidence and the route-plugin check are in `BATCH_06_REPORT.md`. Full JavaScript-aware typecheck, full lint/test suite, production build, real PostgreSQL, browser/mobile/accessibility and deployment checks remain deferred to Batch 08. No Production database or external provider/storage was used. Stop for owner review; do not start Batch 07 until separately approved.


Version: 1.0.0 (`package.json` version field; npm package name remains the platform scaffold name). Business: Persian/RTL store for natural/organic products (oils, nut butters, herbal goods; planned repackaging of black seed and bitter almond oil into 30 ml dropper bottles). Currency: money stored as integer IRR, shown as toman (÷10).

## Architecture
- React 19 + TanStack Start; server logic in `createServerFn` wrappers (`src/server/**/api.ts`); Nitro `vercel` preset; Vite 8. `@tanstack/react-start` is 1.168.60.
- PostgreSQL via Drizzle. `src/lib/db.ts` chooses Postgres when `DATABASE_URL` is set. Embedded PGlite is only for non-production when `DATABASE_URL` is empty. Production without `DATABASE_URL` throws at import of `src/lib/db.ts` and does not open PGlite. A Postgres connection error is rethrown.
- SQL migrations `migrations/0002`–`0012` are applied by `npm run db:migrate` (`scripts/migrate.mjs`), not by `npm run build` or Production app startup. A session advisory lock uses key `814774531042`. Production migrate also requires `DATABASE_URL` and `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`. `0010_batch_04_home_sections.sql` inserts only missing approved homepage product section types and does not change existing rows; `0011_batch_05_customer_account.sql` adds nullable profile demographics and saved-address recipient fields without replacing existing customer rows; `0012_batch_07_inventory_audit.sql` adds nullable stock snapshots and a nullable order reference/index to inventory logs without backfilling history.
- `migrations/auth/0001_auth.sql` is the platform Better Auth schema. Shop migrators do not recurse into that directory, so it is not copied into the shop migration set; this is independent of the auth feature flag. SHAHOO uses its custom cookies. `.env.example` documents `VITE_AUTH_ENABLED=false`; an absent flag now defaults to false. Only raw exact `"true"` enables the wrapper, client, gate and server paths after the 02.1 correction. Verify an explicit false at build/runtime before deployment. Batch 00 incorrectly reported the migration file absent; it was not edited in Batch 02.
- Auth is custom (cookies `shahoo_customer`, `shahoo_admin`, `shahoo_cart`, `shahoo_receipts`; SHA-256 token hashes; scrypt for OTP/admin passwords; RBAC). `better-auth` and `src/lib/auth/*` belong to the platform scaffold.
- Stock: unpaid order reserves inventory with a conditional UPDATE inside the checkout transaction. The hold is 24 h (`STOCK_HOLD_MS`). Release requires `payment_status = unpaid` and `stock_state = held`. Paid or captured stock is not released. After expiry, payment revalidates sellable stock or leaves the order unpaid. No scheduler was added.
- Payments: no live gateway. Internal states are pending, verified, failed, and expired. Verified, failed, and expired are terminal for that idempotency key. Amount must equal the order total. Currency must be IRR. Mock payment requires `ALLOW_MOCK_PAYMENT=1`, `PAYMENT_PROVIDER=mock`, and non-production.
- SMS: live path unchanged. Mock SMS and OTP echo are explicit non-production flags.
- Refunds: ledger only. The ceiling is the verified payment sum when those rows exist, otherwise the order total. Restock is explicit and only when the refund is a full refund. A second restock does not add stock again.
- Media: local disk blocked in production unless `ALLOW_LOCAL_STORAGE=true`. A file is deleted only after the database transaction commits. If that cleanup throws, an `ops_diagnostics` row `media.file_cleanup` is stored and the file can remain. Shared images are not deleted.

## Batch 00 baseline (historical)
Documentation only. That environment reported 190/198 platform script tests (8 needed a missing `.grok/`), 56 app tests, and could not run `tsc`, eslint, build, or database tests. See `BATCH_00_REPORT.md`. Do not merge that score with later batches.

## Batch 01 correction (historical, 2026-11-16, owner-approved 2026-11-17)
The first Batch 01 baseline still published sample phone numbers, a sample address, social handles, a free-shipping banner, and invented postage prices. A fresh baseline now leaves contact fields, brand story, and the header promo empty, and it does not insert shipping methods. The public footer, contact page, homepage story, and checkout hide empty or previously seeded sample values. An admin can save real contact details from the content desk and real shipping prices from the existing offers desk. Details: `BATCH_01_REPORT.md`. The owner approved this correction before Batch 02 started.

## Batch 01 status (historical snapshot)
Production-safety and correctness changes are in the source and were left in place. Details and exact commands: `BATCH_01_REPORT.md`.

Working after Batch 01, and still covered by the Batch 02 test run:
- Production refuses to boot without `DATABASE_URL`.
- Demo products and coupons are not inserted unless `SEED_DEMO=1` and the process is not production. A fresh baseline initializes permissions, SMS templates, logos, and empty store settings. It does not insert shipping prices, contact details, or a brand story.
- OTP echo, mock payment, mock SMS, and relaxed CSP are opt-in and impossible in production.
- Checkout locks the cart row inside the order transaction and deletes cart lines only when the quantity still matches. Idempotency conflicts use SQLSTATE `23505` plus a constraint name containing `idempotency`.
- A selected saved address is read-only in the checkout form. The server stores the saved location, not the edited fields.
- Admin order detail, admin customer detail, and magazine article routes render through parent layouts that return `<Outlet />`. The customer `/account/support` route and account link were removed. Admin support remains. Backend ticket functions remain.
- Admin bootstrap creates the env admin once. It does not unsuspend or restore `super_admin` unless `SHAHOO_ADMIN_RECOVER=1`. `SHAHOO_ADMIN_ROTATE=1` updates an active admin password only. `applyStaffChange` still blocks removal of the last active super admin.
- Catalog listing has no default 6,000,000 toman cap. An explicit `max` still filters. The schema query max remains 50,000,000 toman.
- `.env.example` documents names only. No secrets.

## Batch 02 status (historical snapshot, 2026-11-17; superseded)
Commerce integrity is implemented and waiting for owner review of `SHAHOO-v1.0.0-batch02.zip`. It is not approved. Details: `BATCH_02_REPORT.md`.

Working after this batch, with the tests named in that report:
- One line per cart and variant. Guest merge sums once and then deletes the source cart. Repeated local adopt uses the larger quantity, not a sum. Both clamp to sellable stock and 20.
- Checkout stores the live server price. The idempotency key and receipt hash are written inside the order transaction. Replay returns the same order for the same buyer. A failed transaction leaves no order.
- A failed or expired payment does not mark the order paid. The same key cannot later be verified. A second key does not capture stock twice. A wrong amount or a non-IRR currency stores no payment row.
- Expiry releases a hold once and skips a paid order. Payment after expiry can recover stock only while the product is still sellable.
- Partial refunds cannot exceed the verified payment. Restock runs only when a full refund asks for it, and only once.
- Shared media is not deleted. Replacing a product image does not delete a file that is still used.

Not production-ready for taking payment. No live gateway, SMS, or carrier was connected. No production database was migrated. Multi-connection PostgreSQL was not executed.

## Historical roadmap snapshot (superseded by later batch entries)
At the time this section was written, homepage sections, cart drawer, carousel, gold hover, optional gender/age group and account navigation cleanup were still future work. Batch 03–05 entries below and the current status supersede that snapshot. Exact original requirements remain in `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`.

## Rules
No rewrites; preserve brand, palette, RTL; no real external calls; no secrets in the repo; no production DB during this batch.

## Batch 02 correction (historical snapshot, 2026-11-17)
- Stock recovery of an expired order now applies the checkout sellability rule (`isLineSellable`: product published and not deleted, variant active, category active and not deleted) to every line before any stock change, inside the payment transaction. Held and already-paid orders are not re-validated.
- `settlePaidCancel` links the ledger refund to its single verified, same-order, non-ledger IRR payment (`refund_of_payment_id`) and fails before any change if there is none, more than one, or the refund exceeds it.
- Every write of a media reference (product attach/replace/link, banner, article cover) locks the `media_assets` row first; `retireMedia` uses the same lock. Pending `media.file_cleanup` diagnostics are retried and re-verified. Local storage architecture unchanged.
- Verified: real PostgreSQL 16 race script (SQL-level, passed). Not executed here: tsc, eslint, build, PGlite suites (including new `correction.test.ts`). See `BATCH_02_REPORT.md`.

## Batch 03 (historical snapshot, 2026-11-18)
- Client wishlist is owner-tagged (`guest`/`account`/`unknown`), reconciled with the server session, cleared on logout, merged into an account only when it is a genuine guest list.
- Cart view guards duplicate writes, discards stale responses, shows Persian errors with retry; totals/prices remain server-authoritative.
- `useGuardedAction` is the shared pattern for single-flight async actions with Persian feedback. Admin media upload validates the file, reports success only after server `ok`, and falls back to a placeholder for broken previews.
- Router has Persian not-found and error screens that never print the raw error.
- Unverified: tsc, eslint, build, PGlite suites, browser/responsive behaviour (not executable in the sandbox). See `BATCH_03_REPORT.md`.

## Batch 03 correction (historical snapshot, 2026-11-18)
- Guest wishlist migration on login is confirmed-only: the browser keeps guest ids (`pending`) until the server returns `{mode:"account", items}`; failures (thrown, `{ok:false}`, `{mode:"guest"}`) keep them and `/account` shows a Persian retry notice. Logout returns unmigrated ids to the guest list; an account copy is never merged into another customer.
- Wishlist reads are versioned (`createReadGate`): an older response cannot overwrite a newer heart action. One controller (`wishlistSync`) owns load/toggle/migrate/logout.
- Persisted wishlist store is version 3 (`ids`, `scope`, `pending`).
- `AGENTS.md` is portable; original archived in `docs/archive/`. `BATCH_08_PRODUCTION_REPORT.md` is historical (v0.8.0).
- Unverified: tsc, ESLint, build, PGlite suites, browser behaviour. See `BATCH_03_REPORT.md`.


## Batch 04 implementation (2026-11-19; original delivery, now amended by correction)

The original Batch 04 delivered the cart drawer, checkout/cart safeguards, carousel, CMS copy and gold treatments; details and historical verification limits remain in `BATCH_04_REPORT.md`. The fresh-Production missing-sections finding from that delivery is resolved by the correction below. The original output archive is superseded by the correction archive for this owner review.

## Batch 04 Production homepage correction (2026-11-19; historical snapshot)

Migration `0010_batch_04_home_sections.sql` provisions the three required CMS section types without Demo Seed, duplicates or overwriting existing rows. It preserves non-canonical IDs, current admin content/configuration/activation/order and appends only missing rows. Fresh Production installs receive their rows when the guarded standard migration command is run before serving. The CMS already edits text, activation and ordering. The homepage now renders the database-backed headings with a Persian empty state when the dynamic product selection is empty. No demo product/business data is inserted. Focused isolated PGlite tests passed; full TypeScript, lint, complete suite, build, real PostgreSQL, browser, responsive and accessibility verification remains deferred to Batch 08. See `BATCH_04_CORRECTION_REPORT.md`.


## Batch 08 original review (historical snapshot, 2026-11-19; superseded)

The results, dependency counts, test limitations and delivery below describe the original Batch 08 review only, before Revisions 01 and 02; they are not current results. For the present gate and ongoing rerun see the Revision 02.1 status above and `BATCH_08_FINAL_RELEASE_EVIDENCE.md`.

Batch 08 comprehensive audit is complete from `SHAHOO-v1.0.0-batch07-revision01.zip` (source SHA-256 `9e9ec41fb296bb587d6431ae98af95ff1b27652b93926d00f22bb5e3c1b3c918`). Dependencies installed from the lockfile. TypeScript passed; ESLint passed with five warnings; application tests passed 214/214; migration-aware PGlite/integration tests passed 90/90; production build passed; and the new quoteCart sellability regression suite passed 7/7.

A confirmed quoteCart consistency defect was fixed: quoteCart now uses the shared sellability rule and rejects unpublished/deleted products, inactive/deleted categories, and inactive/deleted variants. Cart lookup also rejects soft-deleted variants. An explicit postal-code accessible name was added.

The final decision is **NOT READY FOR RELEASE**. Real PostgreSQL fresh/upgrade/concurrency testing, backup/restore, browser/mobile/accessibility runtime checks, target-host verification, and deployment verification of `VITE_AUTH_ENABLED=false` were not executable in this environment. `npm audit` reported 10 findings including one critical Better Auth advisory. The configured platform script group remains 206/215 passed, 9 failed because private `.grok` harness inputs are absent and one upload assertion is obsolete for the supported HTTPS-only media-registration design.

Deliverable: `SHAHOO-v1.0.0-batch08-review.zip`. Batch 09 SMS.ir and PayPing remains pending and was not started. No production deployment or owner approval is claimed. See `BATCH_08_REPORT.md` for exact evidence and the deployment checklist.

## Batch 09 remediation — current stage (2026-11-19)

The current stage adds PayPing to the existing provider architecture and persists payment attempts independently from local settlement. Provider verification evidence survives settlement failure through `payment_attempts`; retries are idempotent and marked for reconciliation when unsafe. SMS.ir Verify remains server-side and preserves the existing OTP system. Automated typecheck/build and focused provider tests pass; full test, lint, real PostgreSQL, sandbox, and deployment verification remain separate gates. Production deployment and live provider calls remain deferred.

## Current Batch 09 comprehensive audit — 2026-11-20

PayPing and SMS.ir remain disabled by default and have not been tested with real credentials. The source is ready for controlled provider-account/sandbox configuration with documented limitations. New safeguards include streamed callback body limits, five-minute settling lease recovery, admin manual review for unknown PayPing initiation, explicit SMS modes, unknown SMS delivery classification, and `.env.example` tracking protection. Exact evidence is in `BATCH_09_COMPREHENSIVE_AUDIT.md` and `docs/TEST_REPORT_BATCH_09.md`.

## Batch 09 final corrective phase — 2026-11-20

Final source corrections: PayPing verification uncertainty is persisted and retryable on the original attempt; OTP issuance invalidates prior challenges and verification cannot revive older codes. New lifecycle and OTP tests pass. No real provider or PostgreSQL run was performed. Verdict: **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration.
