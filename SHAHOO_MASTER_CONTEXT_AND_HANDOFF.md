# SHAHOO — Master Project Context & Continuity File

**Document purpose:** This is the portable source of truth for continuing SHAHOO across ChatGPT accounts, chats, coding agents, and future development batches.  
**Language:** Persian-first project; this document is written in English for reliable handoff between coding agents.  
**Last consolidated:** 2026-11-19 (Batch 08 Revision 02.1 reconciliation; historical records retained).

## Current handoff — Batch 09 remediation

**Position:** The latest completed remediation is **Batch 08 Revision 02**; its implementation has been completed and reviewed. The current stage, **Revision 02.1**, reconciles the documentation and release evidence. The source package is SHAHOO **1.0.0**. **Release decision: NOT READY FOR RELEASE. No final owner approval has been granted.** Batch 09 has not started. When the delivery is complete, stop for the owner's independent review; the evidence gaps are not authorization to start another stage or connect providers.

**Source identity:** The authoritative input is `SHAHOO-v1.0.0-batch08-revision02.zip`; its independently checked SHA-256 is `eb5aac8b54e0edeb233a2fb2c23e0adda72358b5b36e61812992e015083907cd`. ZIP integrity passed, with **385 regular files and 41 directory entries**. The intended latest output is `SHAHOO-v1.0.0-batch08-revision02.1.zip`; its final SHA-256 cannot be self-contained inside the ZIP because inserting that hash changes the archive. Verify the output against the **detached final-delivery checksum**, not the verified input checksum. The output name is an intention, not a claim that packaging or final archive verification has already finished.

**Confirmed source-level work:** Quote/cart sellability uses shared `isLineSellable` for published/non-deleted products, active/non-deleted variants and active/non-deleted categories; missing joined rows are excluded. Regression tests exist for the shared rule and the PGlite-backed quote path. Revision 02's demo seed looks up existing homepage section types and inserts only missing types, with seed/migration safety tests; demo seed is not automatically applied to production. Production database selection fails closed without `DATABASE_URL`, with no fallback from a failed PostgreSQL connection. The custom customer/admin OTP/session/RBAC paths remain distinct from the optional platform scaffold. Better Auth is pinned to `1.7.26`, and the lockfile resolves `typescript-eslint` to `8.73.0`; the original Better Auth advisory and Revision 01 seven-moderate count are historical/superseded, not a fresh audit conclusion. The approved CMS registration path uses external HTTPS media URLs, not a configured production object-storage upload workflow.

**Auth discrepancy corrected in 02.1:** Before correction, direct server and gate readers trimmed whitespace, enabling raw `" true "` while the wrapper normalized it to false. Revision 02.1 minimally changed the two server/gate comparisons to raw exact `"true"`; newly added regressions failed before and passed after (27/27 gate tests). The client and wrapper also require exact `"true"`. This does not prove separate deployed build/runtime environments receive the same value. Explicitly configure and verify `VITE_AUTH_ENABLED=false` in both; do not enable the scaffold for SHAHOO OTP.

**Credential exposure / 02.1 correction:** The input archive contained a hardcoded shared platform-preview OAuth client secret in `src/lib/auth/preview.ts`. It has been removed from this output. Optional broker OAuth now needs an injected `GROK_AUTH_CLIENT_SECRET` or `GROK_PREVIEW_CLIENT_SECRET` and remains unavailable without one; exact `VITE_AUTH_ENABLED=true` may still enable the separate gate path. This does not change SHAHOO's custom customer/admin auth. The input may already have exposed the credential: the credential owner should assess and rotate/revoke it and review exposure; rotation and live provider verification were not performed. Keep secrets outside the archive.

**Revision 02.1 fresh local evidence:** `npm run typecheck`, `npm run lint`, `npm run build`, wrapper/auth-config tests, and gate-identity tests passed; fresh `npm audit --json` reported zero vulnerabilities. The aggregate `npm test` remains **212/216 script tests** because four tests require absent private `.grok` platform-harness files; its app group passed 217/217 and migration/PGlite group passed 103/103. Focused checkout, OTP and seed corrections also passed their recorded targeted suites. Never describe the overall configured `npm test` as green; PGlite is not proof of real PostgreSQL concurrency, and bounded smoke is not full E2E or accessibility. See `BATCH_08_FINAL_RELEASE_EVIDENCE.md` for exact commands and boundaries.

**Open release gates / limitations:** Real PostgreSQL fresh and upgrade migrations, transactions, locking and independent-connection inventory/checkout/reservation/payment concurrency require candidate-specific execution; PostgreSQL-native backup/restore is prepared but not executed in Revision 02. An older Batch 02 correction did report a narrowly scoped PostgreSQL SQL-level media race test, not proof of these latest-release gates. Full desktop/mobile browser E2E, keyboard/screen-reader/accessibility, production session behavior, the selected host's deployment/health/restart, proxy/cookie/security configuration, durable media and explicit auth-off build/runtime are unverified. The Revision 02 report attributes four script failures to absent private `.grok/skills/og/SKILL.md` and its references; preserve the tests and obtain the correct authorized harness. Current rerun evidence may change the picture and belongs in the evidence register. No hosting provider has been selected or purchased.

**Open design and risk context:** Real gateway initiation/callback, settlement and refund reconciliation are not implemented; historical reports warn that a future gateway taking money when stock recovery fails needs an explicit reconciliation policy before connection. Reservation expiry is lazy, not a durable scheduler; guest-checkout throttling, reviewed-cart cross-tab/ABA and uncertain-response edge cases, cookie/proxy, CSRF/CSP and admin-MFA treatment require explicit release review rather than assumed closure. Existing ledger refunds are not bank refunds. The CMS media picker remains limited to the newest 100 records and production media durability is undecided. Consult `REMAINING_ISSUES.md` and the final evidence register for detailed current dispositions.

**Original Claude audit limitation:** The earlier audit reportedly described 6 HIGH, 11 MEDIUM and 6 LOW findings. Revision 02 reports that only SH-001–SH-006 summaries were recoverable from project reports and the full original descriptions for the 11 MEDIUM and 6 LOW findings were missing. Those **17 findings are UNVERIFIED — ORIGINAL SOURCE MISSING**, not resolved; do not invent descriptions or IDs. Recover the original report if available and verify each finding. Recovery status and exact current evidence belong in the final evidence register.

**Explicitly deferred:** Do not implement or connect SMS.ir, PayPing, real OTP/SMS delivery, real payment transactions, shipping APIs, cloud storage, or production hosting during this stage. A conditional SMS.ir adapter existed in an earlier source baseline; its presence is not an active, tested provider connection. Batch 09 requires a separate owner decision after review. Existing approved UI, brand, RTL, business rules, schema and integration boundaries remain in force.

**Next authorized step:** Owner review of the final archive, this handoff and `BATCH_08_FINAL_RELEASE_EVIDENCE.md`, including the corrected auth discrepancy, unrecovered audit, and blocked gates. Further candidate verification and any subsequent remediation require authorization and appropriate disposable or staging infrastructure; do not use real customer data, production credentials or an unapproved host.

> Important: This document combines project decisions, prior reports, user-approved requirements, and the current handoff state. It is not a substitute for inspecting the actual source ZIP. For every new batch, verify source code and tests directly. Distinguish independently verified facts from claims in previous agent reports.

---

## 1. Project identity

**Project:** SHAHOO (شاهو)  
**Type:** Persian RTL e-commerce platform for Iranian customers  
**Business focus:** Natural and organic products, including oils, nut butters, nuts, herbs, and related goods.

### Business scenario

The owner plans wholesale repackaging of black seed oil and bitter almond oil into 30 ml dropper bottles for retail customers, initially serving Zahedan and Sistan & Baluchestan.

### Product and business priorities

- A trustworthy, polished specialist store; do not attempt to reproduce all of Digikala.
- Product catalog and product detail accuracy.
- Product variants, sizes, volumes, weights, SKU and pricing.
- Inventory correctness, including conversion from bulk stock to saleable packaged units where applicable.
- Reliable cart, checkout, order lifecycle, reservation, cancellation and refund foundations.
- Practical admin operations and editable site content.
- Brand trust, product education and Persian content.
- Maintainable architecture that can be expanded later.

### Technology stack reported by previous audits

- React 19
- TanStack React Start
- TypeScript
- PostgreSQL with Drizzle ORM
- Vite 8
- Tailwind CSS 4
- Zod
- Local Vazirmatn font
- Jalali date handling
- Toman and Persian-digit formatting helpers

The actual repository and package files remain authoritative if any detail differs.

---

## 2. Non-negotiable project constraints

1. Preserve the existing architecture unless a demonstrated technical reason requires a focused change.
2. Preserve SHAHOO’s existing brand identity, logo assets, green/cream/gold palette, Persian RTL behavior, typography and established visual direction.
3. Do not rewrite the application.
4. Do not add features merely because large marketplaces have them.
5. Do not add unrelated dependencies or perform broad upgrades without justification.
6. Do not connect real Iranian payment gateways in the current batches.
7. Do not connect real SMS/OTP providers in the current batches.
8. Do not connect real shipping-company APIs in the current batches.
9. Keep code ready for later integration with Iranian payment and SMS providers, but defer the actual integrations.
10. Never test against production credentials, production databases, or real customer data.
11. Do not claim a test passed unless it was actually executed and passed.
12. Do not claim PostgreSQL concurrency behavior is verified by a PGlite-only test.
13. Each batch is independent, has a defined scope, and stops after delivery. The owner reviews the ZIP before the next batch begins.
14. Deliver one clean complete ZIP per batch. Exclude `node_modules`, build output, caches, temporary files, local databases, secrets, real `.env` files and duplicate archives. Do not omit required source, assets, migrations, tests, lockfiles or docs.

---

## 3. Payment, SMS and external service decisions

**Current decision: defer live integrations.**

- No live payment gateway integration yet.
- No live SMS/OTP integration yet.
- No live shipping API integration yet.
- Keep provider integration points and configuration architecture clean enough for later implementation.
- Do not simulate successful real payments in production.
- Development mock behavior must be explicitly opt-in and impossible to activate in production.

Possible future Iranian providers mentioned in prior planning include Zarinpal, Zibal, IDPay, sms.ir and Kavenegar. These are examples for later evaluation, not a decision to select or integrate a provider now.

---

## 4. Current source and audit history

### 4.1 Claude Review source archive

A source archive named `SHAHOO-v1.0.0-Claude-Review.zip` was previously inspected. Reported characteristics:

- 343 files
- Approximately 5.58 MB compressed and 7.11 MB uncompressed
- No `node_modules` or build output
- Included source, public assets, migrations, package files, tests and project documentation
- Included docs such as `AGENTS.md`, `DECISIONS.md`, `PROJECT_HANDOVER.md`, `REMAINING_ISSUES.md`, `docs/PRODUCTION.md` and `docs/RELEASE_1.0.0.md`

The archive was suitable as a Batch 00 starting point if it was the latest complete source at the time. The current latest ZIP always takes precedence.

### 4.2 Claude audit findings (reported)

Claude’s review reported:

- 6 High, 11 Medium and 6 Low findings; no confirmed Critical finding.
- Demo seed behavior could insert demo data/coupons into production.
- Missing `DATABASE_URL` could silently fall back to PGlite.
- Development/security features might be active unintentionally.
- Payment lifecycle was not fully integrated.
- Payment recovery after reservation timeout was incomplete.
- OTP policy needed strengthening.
- Local-file media upload would not suit Vercel without object storage.
- Several CMS/admin/product capabilities were incomplete.

Treat these as prior audit findings, not proof that every issue remains present in the current source. Re-check actual code.

### 4.3 Independent audit findings (reported and consolidated)

The independent audit did not recommend a rewrite. Its direction was to preserve the architecture and most existing work, and fix focused production-readiness and data-integrity issues.

Positive findings reported:

- Server recalculates prices instead of trusting browser prices.
- Orders retain product/price snapshots.
- Conditional inventory reservation guard helps prevent overselling.
- Admin cannot simply mark an unpaid order as paid.
- Inventory ledger, reservation, order transitions and refund structures exist.
- Coupon/free-shipping calculations are aligned between quote and final order.
- Catalog, cart, orders, customer account and CMS connect to real server/data paths.
- Session tokens are hashed; admin/customer sessions are separate; server role checks and ownership checks exist.
- Login rate limiting and upload size/type validation were reported.

Important caveats:

- No live payment, SMS, carrier API or bank refund was tested.
- No real PostgreSQL/Neon multi-connection concurrency test was completed.
- No full browser end-to-end suite was completed.
- A limited defensive source review is not a penetration test and does not prove complete security.

### 4.4 Test evidence and discrepancies

Prior reports included:

- TypeScript typecheck passed in one audit run.
- Build passed in one audit run, but the build script then also ran migrations; do not repeat that behavior against an unknown DB.
- Lint passed in one audit run.
- Four dedicated SQL tests passed 4/4 in a final local disposable PGlite run.
- 16 migration/completion tests passed 16/16.
- A separate platform test summary reported 339 pass and 8 fail out of 347; those 8 were associated with platform/template-specific missing files/config/auth wrapper expectations, not confirmed customer-facing commerce defects.
- Another Claude report described 190/198 platform tests and 56 app tests passing. Do not merge these different test runs into one score.
- The final PGlite SQL log superseded an earlier log in which tests were skipped due to missing dependency.
- Markdown and PDF audit summaries were inconsistent in places. Prefer the later PDF and final log where explicitly identified, but retain uncertainty where source evidence is not available.

---

## 5. Batch 00 — Source verification and baseline

**Status:** Completed and reviewed.  
**Purpose:** Source verification and handoff preparation only. No application code changes were expected or authorized.

### Batch 00 output

The owner uploaded a ZIP reported by Claude as:

- Approximately 5.7 MB
- 387 files in total (including directory entries, as reported)
- No `node_modules`

The assistant compared the Batch 00 ZIP with the prior Claude Review archive:

- Four new documents were added:
  - `PROJECT_STATE.md`
  - `BATCH_00_REPORT.md`
  - `LATEST_HANDOFF.md`
  - `NEXT_BATCH_BRIEF.md`
- `REMAINING_ISSUES.md` was updated.
- Shared original files, including source, migrations, package files and tests, were unchanged.
- No original files were removed.

Therefore Batch 00 correctly made documentation-only changes. It was not supposed to implement fixes.

### Batch 00 inspection limitations

Claude stated that:

- It did not perform a complete fresh audit.
- It checked the ten requested areas by reading source code.
- It did not execute tests/build/typecheck/lint because the environment lacked network/package availability.
- It did not reproduce concurrency issues dynamically.

### Batch 00 reported findings

Confirmed or statically confirmed:

1. Production can silently fall back to PGlite without `DATABASE_URL`.
2. Demo seed may run in production.
3. Development/mock behavior may be enabled through permissive `NODE_ENV` checks.
4. Two concurrent checkout requests with different idempotency keys may create two orders from one cart.
5. Nested route parents lack Outlet for:
   - `admin.orders.$code`
   - `admin.customers.$customerId`
   - `account.support`
   - `magazine.$articleId`
6. Selecting a saved checkout address while editing visible fields can result in the server using a different address.
7. Payment idempotency checks the key but may not validate order/amount association.
8. Reservation expiry relies on lazy sweeping and has no cron/scheduler.
9. Admin bootstrap may reactivate a disabled admin and restore `super_admin`.
10. Catalog default price cap of 6,000,000 Toman may hide legitimate products.
11. Build command runs migration as part of build.

Not repeated or not verified in Batch 00:

- CSRF coverage and partial refund behavior were not conclusively verified.
- Cart merge/retry duplication, media deletion consistency and wishlist cache isolation were not checked.
- Do not treat these as resolved.

---

## 6. Approved UI and product decisions

These requirements are approved for later UI batches. Do not implement them prematurely in Batch 01 unless directly required by a scoped fix.

### 6.1 Header cart drawer

- Clicking header cart opens a drawer on the current page; it must not immediately navigate away.
- Drawer shows cart items, quantity controls, delete action and total.
- Continue shopping and checkout actions navigate to the appropriate standalone cart/checkout flow.
- Existing standalone cart page remains available.

### 6.2 Homepage sections

Remove the section titled **«برگزیده‌ها»** entirely.

Keep:

- «پرفروش‌های شاهو»
- «تازه‌های ماه»
- «پیشنهادهای ویژه»

Approved copy:

- پرفروش‌های شاهو: «انتخاب‌هایی که مشتریان شاهو بیشتر سراغشان می‌روند.»
- تازه‌های ماه: «تازه به شاهو رسیده‌اند؛ نگاهی به انتخاب‌های جدید بیندازید.»
- پیشنهادهای ویژه: «انتخاب‌های ویژه‌ای که شاید همان چیزی باشند که دنبالش هستید.»

If the content is CMS-managed, preserve CMS editability. Do not hardcode over the CMS.

### 6.3 Hero carousel

- Remove slide numbering.
- Show three line indicators at bottom center.
- Active indicator is slightly larger, with smooth animated transition.
- Auto-rotate at a suitable interval.
- Keep manual navigation.
- Enlarge banner images.
- Slightly reduce adjacent green text.
- Fix gold text font/rendering.
- Smooth, mobile-friendly transitions.

### 6.4 Gold interaction effects

- Owner likes the existing gold hover effect on category cards.
- Extend consistently to suitable interactive elements such as header cart and wishlist.
- Provide touch/mobile behavior because hover does not exist on touch devices.

### 6.5 Customer account profile

Profile should include:

- First and last name.
- Phone number, respecting existing authentication design.
- Addresses.
- Optional gender.
- Optional age group.

Gender options:

- زن
- مرد
- ترجیح می‌دهم نگویم

Age group options (do not collect exact date of birth):

- کمتر از ۱۸
- ۱۸–۲۴
- ۲۵–۳۴
- ۳۵–۴۴
- ۴۵–۵۴
- ۵۵+
- ترجیح می‌دهم اعلام نکنم

Both gender and age group are optional and must never block checkout.

Approved explanation text:  
«با تکمیل این اطلاعات، به ما کمک می‌کنید محصولات و پیشنهادهای مرتبط‌تری برای شما فراهم کنیم.»

Requirements:

- Explain why the information is collected.
- Keep collection optional.
- Use aggregated reporting where appropriate.
- Avoid collecting exact birth date.
- Implement database/API/validation/admin support, not just UI fields.

### 6.6 Account navigation and support decision

Account navigation:

- اطلاعات شخصی
- سفارش‌های من
- نشانی‌های من
- تنظیمات حساب
- ارتباط با شاهو

Remove customer-facing online support/ticket UI from the customer account. Keep phone and social contact options. Preserve backend support records or admin-side support capabilities if they are used elsewhere.

Remove duplicate wishlist entry from the account bottom area; keep wishlist access in the header.

---

## 7. Batch roadmap and scope (historical planning snapshot; superseded)

Batches are sequential. This section retains the original planning and stop points as they stood at those times; old “expected”, “pending approval” and “do not start Batch 08” statements here are historical, not the current workflow. See the Revision 02.1 handoff above. Do not start any next batch until the owner has reviewed the current ZIP and explicitly approved continuation.

### Batch 00 — Source verification and baseline

**Status:** Completed and reviewed.  
Documentation-only. No code changes.

### Batch 01 — Production safety, database integrity and critical correctness

**Status:** Implemented on 2026-11-16. The owner approved the Batch 01 correction on 2026-11-17, which is the accepted baseline for this work. Original output archive: `SHAHOO-v1.0.0-batch01.zip`.

Input: Batch 00 ZIP. No new SQL migration. No live payment, SMS, carrier, or production database.

Implemented in source:

1. Production without `DATABASE_URL` throws. Postgres errors do not fall back to PGlite. PGlite remains for non-production when `DATABASE_URL` is unset.
2. Demo products, articles, navigation, banners, and coupons require `SEED_DEMO=1` and a non-production process. A fresh baseline initializes permissions, SMS templates, logos, and empty store settings. It does not insert contact details, shipping prices, a free-shipping banner, or a brand story. Repeat calls are idempotent. Existing databases that already have `foundation.seed` are not scrubbed.
3. `ECHO_OTP`, `ALLOW_MOCK_PAYMENT`, `ALLOW_MOCK_SMS`, and `ALLOW_DEV_CSP` are explicit and ignored in production. `npm run dev` sets seed, OTP echo, and dev CSP for local preview only.
4. Checkout locks the cart row inside the order transaction and deletes lines only when the quantity still matches. Idempotency conflicts use SQLSTATE `23505` and the constraint name. Proved on one PGlite connection only. Multi-connection PostgreSQL was **NOT EXECUTED** (no server in the environment).
5. Saved-address checkout locks the visible location fields and the server stores that saved address.
6. Admin orders, admin customers, and magazine parent routes render `<Outlet />`, with index routes for the lists. Customer `account.support` was removed, not redesigned. Admin support stays.
7. Payment idempotency replay must match order id, amount, and IRR.
8. `npm run build` does not migrate. `npm run db:migrate` requires `DATABASE_URL`, takes advisory lock `814774531042`, and in production also requires `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`.
9. `.env.example` added with placeholders. Production startup checks `DATABASE_URL`.
10. Admin bootstrap creates once. Suspended admins stay suspended unless `SHAHOO_ADMIN_RECOVER=1`. Password rotation is `SHAHOO_ADMIN_ROTATE=1` and does not restore a revoked role. Last-active-super-admin protection in `applyStaffChange` was left in place.
11. The default 6,000,000 toman catalog cap is gone. An explicit max filter remains, with a server ceiling of 50,000,000 toman.
12. `migrations/auth/0001_auth.sql` is in the archive. Batch 00 said it was absent. Shop migrators do not apply it. It was not edited.

Exact files, commands, and test labels are in `BATCH_01_REPORT.md`.

### Batch 01 correction — unpublished sample business data

**Status:** Implemented on 2026-11-16. Owner-approved on 2026-11-17. Output archive: `SHAHOO-v1.0.0-batch01-correction.zip`. This is the input to Batch 02.

Issue: the production baseline still stored sample phone numbers, a sample address, social handles, a free-shipping banner, and invented shipping prices, and the storefront rendered them.

Change: `insertBaseline` leaves those fields empty and inserts no shipping methods. Public contact rows, the old promo sentence, the old story text, and the old shipping price pairs are not shown. The content desk can save real contact details. The existing offers desk can save real shipping prices. Previous Batch 01 safety fixes were left in place. No SQL migration. No existing database rows are deleted.

Final correction gate, `DATABASE_URL` unset: `npm test` exit 0 (205 script, 140 app, 24 database tests, 0 failures). `npx tsc --noEmit` exit 0. `npx eslint . --quiet` exit 0. `env -u DATABASE_URL npm run build` exit 0 and did not migrate. Multi-connection PostgreSQL was not executed.

### Batch 02 — Commerce integrity

**Status:** Implemented on 2026-11-17 and followed by a Batch 02 correction (2026-11-17, `SHAHOO-v1.0.0-batch02-correction.zip`), which the owner then used as the Batch 03 baseline. (Original note: waiting for owner review of `SHAHOO-v1.0.0-batch02.zip`; Batch 03 was not started at that time.)

Input: owner-approved `SHAHOO-v1.0.0-batch01-correction.zip`.  
Output: `SHAHOO-v1.0.0-batch02.zip`.

Asked scope, now implemented in source:

- Cart merge/retry: guest merge sums once and deletes the source cart; repeated local adopt uses max; both clamp to sellable stock and `MAX_LINE_QTY` (20). One line per cart and variant.
- Checkout: live server price; idempotency key and receipt hash committed with the order; replay returns the same order for the same buyer; a failed transaction leaves no order. Batch 01 cart lock was not weakened.
- Partial refunds: ceiling is the verified payment sum when those rows exist, otherwise the order total. Duplicate refunds are idempotent. Restock only when a full refund asks for it, and only once.
- Reservation expiry: 24-hour hold kept. Release requires unpaid and held. Paid stock is not released. Repeated expiry does not double-release. Payment after expiry revalidates stock or leaves the order unpaid.
- Payment lifecycle before any gateway: pending, verified, failed, expired. Failed and expired cannot later verify on the same key. Amount must match. Currency must be IRR. No provider is called. Mock payment stays blocked in production.
- Audit rows for these mutations commit with the change. A rolled-back payment does not leave a success audit.
- Media: shared files are not deleted. Replacement does not delete a file still in use. The file is removed only after the database commit. A failed cleanup writes `ops_diagnostics` kind `media.file_cleanup` and can leave the file.

Migration: `migrations/0008_batch_02.sql` only. Adds `payments.currency` (check IRR) and `payments.refund_of_payment_id`. Deletes nothing. `migrations/auth/0001_auth.sql` was not edited.

Tests actually executed on 2026-11-17, `DATABASE_URL` unset: `npm test` exit 0 (205 script, 145 app, 37 database, 0 failures). `npx tsc --noEmit` exit 0. `npx eslint . --quiet` exit 0. `env -u DATABASE_URL npm run build` exit 0 and did not migrate. `@tanstack/react-start` 1.168.60. Multi-connection PostgreSQL was **NOT EXECUTED** (no server). PGlite concurrency is not that proof.

Exact files, commands, and the not-executed list are in `BATCH_02_REPORT.md`.

The shop still cannot take a real payment. Do not start Batch 03 until the owner reviews this ZIP.

### Batch 03 — Existing UI/routes and frontend correctness

Expected scope:

- Remaining nested route and page rendering issues not handled in Batch 01.
- User feedback states, loading/empty/error states.
- Media upload behavior and storage assumptions.
- Wishlist cache isolation between accounts.
- Cart error handling.
- Contrast/accessibility improvements.
- Logo/image optimization.
- Responsive checks.

### Batch 04 — Cart drawer and homepage UI

**Status:** Original UI scope and Production homepage correction are implemented in source and awaiting owner review. Focused correction checks passed; comprehensive verification remains deferred to Batch 08. See `BATCH_04_REPORT.md` and `BATCH_04_CORRECTION_REPORT.md`.

Scope:

- Header cart drawer.
- Remove «برگزیده‌ها».
- Retain the three approved homepage sections and exact approved copy.
- Hero carousel changes.
- Gold interaction effects.
- Mobile/touch behavior and responsive testing.

### Batch 05 — Customer account

Expected scope:

- Profile and optional gender/age-group fields.
- Customer order list and order detail.
- Address management.
- Account navigation.
- Remove customer online-support UI; keep phone/social contact.
- Remove duplicate wishlist entry.
- Database/API/validation/admin reporting for optional demographic fields.
- Privacy transparency and non-blocking behavior.

### Batch 06 — Products and CMS

Expected scope:

- Product detail information and product-specific fields.
- Product variants, sizes, volumes, weights and SKU.
- Product image gallery and media picker.
- Banner images and editable content.
- CMS management for homepage/site content.
- Magazine/article pages and content management.
- Preserve editable logos, banners, text and product media.

### Batch 07 — Admin orders, customers and inventory (historical roadmap snapshot)

**Status:** Implemented on 2026-11-19; Revision 01 adds focused admin-workflow coverage and consistency corrections. Pending owner approval. The exact changed files, migration details, test results, and ZIP verification are in `BATCH_07_REPORT.md`. Do not begin Batch 08 until explicit approval.

Implemented scope:

- Admin customer/order detail.
- Order status transitions.
- Inventory/reservation/refund correctness.
- Useful foundational reports.
- RBAC and administrative workflows.
- Avoid unnecessary enterprise-level features.

### Batch 08 — Final testing, security and release readiness (historical roadmap snapshot)

Expected scope:

- Real PostgreSQL multi-connection tests.
- Browser E2E tests on mobile and desktop.
- SSR and deployment validation on target Iranian host.
- Backup/restore verification.
- Production hardening.
- At that time, confirm the actual build/runtime environment explicitly sets `VITE_AUTH_ENABLED=false`; the then-current code defaulted an absent flag to enabled. Revision 02 changed the absent default; see the current handoff for the direct-server whitespace correction in 02.1.
- Monitoring/logging/health checks.
- Limited pilot and release checklist.
- No live gateway/SMS activation unless owner explicitly approves a separate integration task.
- The historical plan was to investigate the then-unresolved `quoteCart` sellability question. The divergence was subsequently confirmed and fixed; the source and regression tests are described in the current handoff above.
- Review the CMS media picker limit (newest 100 records only; no server-side pagination/load-more) if the library grows.

### Batch 09 — SMS.ir and PayPing integrations (after Batch 08)

Not implemented in Batch 04. `BATCH_09_INTEGRATION_PREPARATION.md` documents current seams, lifecycle safeguards and prerequisites; no external calls, credentials, speculative schema, or fake payment success were added. Start only after Batch 08 and separate owner approval.

---

## 8. Deferred features — do not add without explicit approval

The following are intentionally deferred:

- Real payment gateway.
- Real SMS/OTP provider.
- Shipping provider APIs.
- Loyalty points.
- Wallet.
- Subscription.
- B2B wholesale portal.
- Multiple warehouses.
- PWA.
- Large-marketplace features that do not serve SHAHOO’s actual needs.

Potential later business/legal topics:

- Product licensing and classification.
- Food/cosmetic/health product claims and labeling.
- Returns and withdrawal policy.
- VAT/tax classification.
- E-commerce legal compliance.  
  These require current, authoritative, product-specific review before launch; do not treat prior general notes as legal advice.

---

## 9. Known technical risks and open issues (historical snapshot; superseded)

This is the early-batch risk snapshot, not the current issue register. Later work resolved or modified some items, including wishlist isolation and several UI tasks. Read the Revision 02.1 handoff and `REMAINING_ISSUES.md` for current status; retain the list for history.

### Production and security

- Production database fallback. **Batch 01: fail closed. PGlite only when not production and DATABASE_URL is unset.**
- Production demo seed. **Batch 01: blocked. Old databases that already contain demo rows are not wiped.**
- Dev/mock behavior. **Batch 01: explicit flags, ignored in production.**
- Admin bootstrap reactivation. **Batch 01: first create only; rotate and recover are explicit flags.**
- CSRF/Origin verification coverage. Still open.
- Cookie/security configuration under actual production host. Still open.
- OTP policy and provider behavior. Echo is opt-in. Provider hardening and lockout policy remain open.
- Environment validation and secret management. **Batch 01: `.env.example` and production `DATABASE_URL` check. No secret file in the repo.**

### Commerce and data integrity

- Atomic cart checkout. **Batch 01: implemented and tested on one PGlite connection. Multi-connection PostgreSQL NOT EXECUTED. Still NOT EXECUTED after Batch 02.**
- Cart merge/retry duplication. **Batch 02: guest merge sums once; local adopt uses max. Tested on one PGlite connection.**
- Checkout address mismatch. **Batch 01: saved address is locked and stored.**
- Payment idempotency association. **Batch 01: replay checks order, amount, and IRR. Batch 02: failed and expired keys cannot later verify; a second key does not capture twice; non-IRR is rejected.**
- Reservation expiry and payment recovery. **Batch 02: 24 h hold kept. Paid stock is not released. Recovery revalidates stock. Single-connection race tested. No scheduler.**
- Partial refund completion. **Batch 02: ceiling is the verified payment when a row exists. Restock is explicit and only for a full refund.**
- Audit/mutation consistency. **Batch 02: payment, refund, hold, and media success audits commit with the mutation. A forced post-commit file-delete failure was not simulated.**
- Media deletion consistency. **Batch 02: shared media is kept. File delete is after commit. Cleanup failure can leave the file plus a diagnostic.**
- Future gateway versus failed stock recovery. **Open. No verified row is stored and the key is not consumed. Do not connect a gateway on top of that gap.**

### Frontend and user experience

- Nested route rendering. **Batch 01: admin orders, admin customers, and magazine. Other routes were not re-audited.**
- Customer support route decision. **Batch 01: customer route removed. Admin support kept.**
- Wishlist cache account isolation. Still open.
- Cart drawer.
- Homepage sections and carousel.
- Customer profile optional demographics.
- Product gallery/media picker.
- CMS editing gaps.
- Accessibility and responsive behavior.

### Infrastructure and deployment

- Local filesystem media storage may not suit serverless/Vercel deployment; verify actual target host storage model.
- Need actual PostgreSQL/Neon integration verification.
- Need backup/restore test.
- Build and migration are separate as of Batch 01 (`npm run build` vs `npm run db:migrate`). Health check and backup/restore are still open.
- Need a clear health check and deployment sequence.

Do not mark any item resolved solely because a previous report says so. Require source and test evidence.

---

## 10. Required workflow for every future batch

For every batch:

1. Start from the latest owner-approved full-source ZIP.
2. Read this master continuity file and the latest batch handoff/report.
3. Inspect actual source; do not trust previous summaries blindly.
4. Verify the batch scope and identify dependencies.
5. Implement only the approved scope.
6. Add meaningful tests for changed behavior.
7. Run baseline and targeted checks where environment permits.
8. Clearly label tests as executed/pass, executed/fail, not executed/environment limitation, not applicable, or static review only.
9. Update canonical project docs; avoid duplicate documentation.
10. Update this master continuity file with:
    - Batch status and completion date.
    - Input and output archive/version.
    - Actual source changes.
    - Migrations and schema changes.
    - Tests and exact outcomes.
    - Unresolved issues.
    - Approved decisions added or changed.
    - Next batch scope and handoff.
11. Include the updated master file in the complete output ZIP.
12. Deliver one clean ZIP and a concise report.
13. Stop. Do not start the next batch until the owner and reviewer approve.

### Agent handoff requirements

The coding agent may be Grok, Claude, or another agent. It must:

- Read repository docs and this continuity file.
- Verify actual source and tests.
- Not rely only on chat history or prior agent claims.
- Preserve all user-approved decisions.
- Record uncertainty rather than inventing facts.
- Update this file for the next agent.
- Avoid creating unnecessary extra documents if existing canonical docs cover the same purpose.

---

### Batch 02 correction (historical snapshot, 2026-11-17)

Input: uploaded `SHAHOO-v1.0.0-batch02.zip` (not Batch 01 or older). Output: `SHAHOO-v1.0.0-batch02-correction.zip`. Scope: three issues only. No Batch 03 work, no UI change, no new dependency, no schema change, no data deleted.

### Issues verified in the source before editing
| # | Issue | Verified |
|---|---|---|
| A | `recoverStock` (`src/server/payments/service.ts`) did not check the category | Present. Checkout (`insertOrder`) required product `published`, variant `active`, product not deleted, category `is_active` and not deleted. Recovery checked none of these |
| B | `settlePaidCancel` (`src/server/commerce/fulfillment.ts`) wrote the ledger refund without `refund_of_payment_id` | Present. `recordRefund` already set it; `settlePaidCancel` did not |
| C | Media attach/replace/link paths did not lock the asset row that `retireMedia` locks | Present. See root cause |

### Root causes
- **A.** Expired-order recovery re-decremented stock using only the order lines, with no sellability rules, so an order for a since-disabled category could be paid and captured.
- **B.** The ledger insert in `settlePaidCancel` simply omitted the field, and the function never selected a source payment.
- **C.** `retireMedia` locked the `media_assets` row, checked `mediaInUse`, then soft-deleted. `attachMediaToProduct`, `replaceProductMediaLink`, `bannerMediaId`, `assertCover` and the product-image link in `catalog/admin.ts` only read the asset without a lock. A foreign-key insert takes `FOR KEY SHARE`, which does not conflict with retire's non-key `UPDATE`, so attach could commit a reference to an asset that retire had already decided was unused. Reproduced on real PostgreSQL (see tests).

### Implementation
- **A.** New pure rule `isLineSellable` in `src/lib/commerce-integrity.ts`, now used by both `checkout.ts` and `recoverStock` (same behaviour for checkout). `recoverStock` left-joins variant, product and category, validates **all** lines first, throws on any failure, and only then does the conditional `onHand` decrement and inventory log. It runs inside the existing payment transaction, so a failure rolls back stock, payment row, order status and audit. **Decision:** only unpaid *expired* orders are re-validated. A normally held order (`captureStock`) already reserved its stock and is not re-validated, and an order already `verified`/`captured` is refused as before and is never touched by a later category change. No new business rule was invented.
- **B.** New pure `chooseRefundSourcePayment`. Eligible payment: same order, `status = verified`, provider not `ledger`, currency `IRR`, amount > 0, exactly one, and refund amount ≤ its amount. None, several (ambiguous) or too small → the transaction returns an error **before any mutation**. `refundOfPaymentId` is now set. Idempotency is unchanged (unique `ledger-cancel-<orderId>` key plus the already-settled check). No schema change (`refund_of_payment_id` exists from `0008`).
- **C.** New `src/server/media/lock.ts`: `lockLiveMediaAsset` (`SELECT … FOR UPDATE`, requires `deleted_at IS NULL`), shared `mediaInUse` (moved from `content.ts`; covers banners desktop/mobile, live articles, product images — the only four FKs to `media_assets`; no `settings` JSON holds a media id), `removeFileOrRecord`, `retryPendingMediaCleanup`. Every operation that writes a media reference now takes the asset lock first: product attach, product replace, banner media, article cover, and the URL-based primary-image link in `catalog/admin.ts`. `retireMedia` uses the same lock. Either order is safe. A soft-deleted asset can never become live again. The file is still removed only after commit; a failed removal writes a `media.file_cleanup` diagnostic; `retireMedia` now also retries earlier pending diagnostics (re-verifying under the asset lock that the asset is still deleted and unreferenced, otherwise the diagnostic is closed as skipped and the file kept). Detach and replace never delete a file. Storage architecture unchanged.

### Files changed
`src/lib/commerce-integrity.ts`, `src/lib/commerce-integrity.test.ts`, `src/server/commerce/checkout.ts`, `src/server/payments/service.ts`, `src/server/commerce/fulfillment.ts`, `src/server/media/lock.ts` (new), `src/server/media/storage.ts`, `src/server/cms/content.ts`, `src/server/catalog/admin.ts`, `src/server/commerce/correction.test.ts` (new), `src/server/completion/flow.test.ts` (fixture), `scripts/pg-media-race.sh` (new), `package.json` (test script lists `correction.test.ts`), and the six documents. No migration.

### Existing test fixture changed (disclosed)
`flow.test.ts` "paid cancel" set `paymentStatus: verified` with **no payment row**. That order can no longer be settled (by design). One verified payment row was added to the fixture; every assertion is kept.

### Tests added
- Pure (`commerce-integrity.test.ts`): `isLineSellable` (active, disabled, missing category, deleted category, unpublished, deleted product, invalid/missing variant, missing product); `chooseRefundSourcePayment` (failed, pending, ledger, other order, wrong currency, zero amount, ambiguous, amount too large, none).
- PGlite (`correction.test.ts`): recovery with active / disabled / soft-deleted category, unpublished and deleted product, inactive variant, two-line order where the second line is valid but the first fails (no partial stock change), already-paid replay unchanged after category disabled; paid cancel linked to the right payment among failed/pending/verified, no verified payment fails with no mutation, other order's payment not used, repeated cancel creates one refund and restocks once; media: unused retired, referenced refused, attach/replace/lock refused after retire, replace keeps a still-shared asset, failed transaction leaves no reference, attach+retire invariant (single connection, **not** race proof), failed file deletion recorded, retry removes once, retry never removes a live or referenced asset.
- Real PostgreSQL (`scripts/pg-media-race.sh`, separate psql connections): retire-first and attach-first, replace vs retire both orders, banner vs retire both orders, shared asset survives replacement, a negative control that reproduces the old race, and 180 simultaneous rounds.

### Tests executed — exact results (2026-11-17)
- **Executed — Passed:** `scripts/pg-media-race.sh` on a disposable local **PostgreSQL 16.15** (non-root user, Unix socket, migrations 0002–0008 applied): 13 PASS, 0 FAIL, exit 0. Negative control (the Batch 02 unlocked attach) left 1 dangling reference, i.e. the race is real. 180 simultaneous rounds of attach/replace/banner vs retire: 0 dangling references. **Limit:** this runs the same lock statements as SQL from separate connections; it does not execute the TypeScript.
- **Executed — Passed:** `node --experimental-strip-types --test src/lib/commerce-integrity.test.ts`: 7/7 (includes all new pure tests).
- **Executed — Passed:** the other app test files that can run without installed packages (`readiness-schedule` 3, `sign-in-gate` 3, `cms-rules` 7, `login-throttle` 7, `preview-path-prefix` 4, `public-profile` 2, `public-shipping` 1, `seo` 3, `stock-release` 2, `tehran-time` 3, `auth` 10, `catalog/rules` 5, `pricing` 6, `migration-0501` 1, `env/runtime` 3, `offers/rules` 3), 0 failures.
- **Executed — Passed (syntax only):** TypeScript 6.0.3 `transpileModule` parse of every edited or new `.ts` file: no syntax errors. This is **not** a typecheck.
- **Executed — Failed (identical to the uploaded Batch 02 archive):** `node --test 'scripts/**/*.test.mjs'`: 204 tests, 193 pass, 11 fail. The same 11 fail on the unmodified batch02 archive (missing `.grok/` platform folder and missing installed packages in this sandbox). The failing-test list is identical before and after.

### Tests not executed, and why
- **Not Executed:** `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `npm run build`, and the full `npm test`. The sandbox has no network and no `node_modules`.
- **Not Executed:** every Drizzle/PGlite test file, including the new `correction.test.ts`, the edited `flow.test.ts`, and the existing `batch02.test.ts` (their packages cannot be imported here). **The new DB tests and the fixture change have therefore never been run.** They must be run with `env -u DATABASE_URL npm test` before approval.
- **Not Executed:** the TypeScript implementation against real multi-connection PostgreSQL (only SQL-level). Browser click-through.
- **Static Inspection Only:** TypeScript behaviour of `recoverStock`, `settlePaidCancel`, the media lock call sites.
- **Not Applicable:** gateway, SMS, carrier, hosted-database tests.

### Remaining risks and limitations
- Because tsc, eslint, the build and the PGlite suites were not run, type errors or a failing new test are possible. This is the main reason this correction should not be treated as verified yet.
- `settlePaidCancel` now refuses an order whose `payment_status` is `verified` but which has no verified payment row (legacy/manual data), and an order with more than one verified payment (ambiguous link). Both need a manual fix; a multi-payment link design is not included.
- `recordRefund` still tolerates a missing source payment when the order has no verified rows (pre-existing, recorded in `REMAINING_ISSUES.md`).
- External-URL media has no file to delete, so it is protected by the same lock but cleanup does not apply.
- Pending file cleanups are retried when another asset is retired; there is no scheduler or admin screen for it.
- Gateway reconciliation, guest checkout throttle and hold scheduler remain open (unchanged).

### Batch 02 approval readiness
**Implementation complete; verification incomplete.** Issue C's lock is proven on real PostgreSQL at SQL level. Issues A and B and the new TypeScript are covered by tests that have been written but not executed in this sandbox. Recommended before approval: `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `env -u DATABASE_URL npm test`, and `PG_RACE_CONFIRM=disposable PGHOST=… scripts/pg-media-race.sh` against a local throwaway server. Batch 03 was not started.

### Batch 03 implementation (historical snapshot, 2026-11-18)

Frontend reliability batch on top of `SHAHOO-v1.0.0-batch02-correction.zip`; full detail in `BATCH_03_REPORT.md`. Delivered as `SHAHOO-v1.0.0-batch03.zip`, waiting for owner review, not approved. Batch 04 not started.

- Wishlist isolation: browser list is owner-tagged (guest/account/unknown, persist v2; superseded by v3 and the pending-migration design in the Batch 03 correction); cleared on logout and login-as-another; only a guest list is merged; failed toggles change nothing.
- Cart UI: duplicate-write guard, stale-response gate, retry on failure, no write per keystroke, server stays the price authority. Shared `useGuardedAction` for order actions, reviews; address book and admin media upload got pending/failure/retry states.
- Routes: Persian not-found and error screens; the raw error is never shown; links/layouts verified by a static test.
- Accessibility: skip link, Escape closes menu, labels, visible focus ring, alt text. Palette unchanged; gold-on-ivory contrast (2.66:1) logged as an open design issue.
- Executed: 18 new pure tests + 9 static source tests pass; 88/88 runnable app tests pass; 11 platform script failures identical to the baseline. Not executed: tsc, eslint, build, PGlite suites, browser/responsive tests, DOM rendering tests. See report.

### Batch 03 correction (historical snapshot, 2026-11-18)

Input: the Claude-generated `SHAHOO-v1.0.0-batch03.zip` (386 regular files, verified identical to the archive delivered earlier). Output: `SHAHOO-v1.0.0-batch03-correction.zip`. Independent review findings only; no Batch 04 work, no redesign, no schema or business-rule change.

### Correction A — guest wishlist data loss during login (verified present)
- **Root cause.** `SignIn.verifyCode` in `account-panel.tsx` called `mergeWishlistFn(...).catch(() => undefined)` and then cleared the browser list unconditionally. `mergeWishlistForSession` returns `{mode:"account",items}` on success, `{mode:"guest",items:[]}` when there is no session and `{ok:false,message}` on failure, and `mergeSaved` silently skips deleted products and accepts at most 40 ids. A rejection, `{ok:false}` or `{mode:"guest"}` all ended in the guest list being wiped.
- **Fix.** New `src/lib/wishlist-sync.ts` (framework-free controller; store and server calls injected) plus rules in `src/lib/wishlist-rules.ts` (`WishlistSnapshot`, `parseMergeReply`, `snapshotAfterLogout`, `snapshotWithoutSession`, `chunk`, `createReadGate`). The store (`cart-store.ts`, persist version 3) gains a persisted `pending` list: guest data not yet confirmed by the server, kept apart from `ids` (the visible list, tagged `guest`/`account`/`unknown`). `migrate()` writes the intent to `pending` before the first request, sends batches of at most 40, treats only an explicit `{mode:"account", items:[...]}` as success, treats a rejection, `{ok:false}`, `{mode:"guest"}` and unknown shapes as failure, removes ids from `pending` only batch by batch after confirmation, reports ids the server skipped because the product no longer exists, and on full success replaces the browser list with the server list (`scope:"account"`, `pending:[]`). A second call while one runs returns `busy` (no duplicate request); retries are idempotent (client de-duplication plus the server's `ON CONFLICT DO NOTHING`). After a failed login-time migration the customer is still signed in and `/account` shows a Persian notice with a retry button (`WishlistMigrationNotice`, reads `pending`, persists across refresh). `logout()` drops an account copy but returns unmigrated `pending` ids to the guest list, so nothing is lost. If the session disappears while data is pending, `load()` folds it back into the guest list. An account copy is never merged into another customer.
- **Decision.** Guest ids that never reached the server belong to the browser, not to a customer, so a later sign-in (even as a different customer, if the first never completed) may receive them; another customer's *account* list is never merged (`idsToMergeOnLogin` ignores `account`/`unknown` scope).

### Correction B — stale wishlist response race (verified present)
- **Root cause.** `ProductView` fired `wishlistStateFn().then(reconcile)` on mount with no ordering against the heart action, so an older read could overwrite a newer toggle.
- **Fix.** `createReadGate` (mutation revision plus read sequence) is owned by the sync controller. `toggle()` and `migrate()` bump the revision when they start and when they finish; `load()` is applied only if no action is running, none ran since the read began, and it is the newest read; otherwise it returns `stale` and changes nothing. A failed read changes nothing and can be retried. `ProductView` and `/wishlist` now use `wishlistSync` (`src/components/site/wishlist-client.ts` binds the real store and server functions). The wishlist route shows its failure/retry state for a failed read and keeps the current list for a stale one. No library added.

### Correction C — documentation
`SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` header and status rewritten (Batch 00–02 history, Batch 03, this correction, limits, Batch 04 only after approval). `FILE_INVENTORY.md` recounted (386 regular files at the start of this pass; method stated in the file). `AGENTS.md` rewritten as portable instructions; the original Grok-platform file is kept as `docs/archive/AGENTS.grok-platform-original.md`. `BATCH_08_PRODUCTION_REPORT.md` marked historical (it describes v0.8.0). Other canonical documents updated.

### Files changed
New: `src/lib/wishlist-sync.ts`, `src/lib/wishlist-sync.test.ts`, `src/components/site/wishlist-client.ts`, `docs/archive/AGENTS.grok-platform-original.md`. Modified: `src/lib/wishlist-rules.ts`, `src/lib/cart-store.ts` (the `clearForLogout` store action was removed; logout goes through `wishlistSync.logout()`), `src/components/site/account-panel.tsx`, `src/components/site/product-view.tsx`, `src/routes/wishlist.tsx`, `scripts/frontend-source.test.mjs` (the one static wishlist test was updated to the new wiring and gained assertions), `package.json` (test script lists `wishlist-sync.test.ts`), `AGENTS.md`, `BATCH_08_PRODUCTION_REPORT.md`, `FILE_INVENTORY.md` and the canonical documents. No existing test was removed or skipped.

### Tests added (`src/lib/wishlist-sync.test.ts`, 19 tests, executed)
They run the real controller and rules. Only the browser store and the three server calls are in-memory fakes that return the exact reply shapes of `src/server/account/wishlist.ts` (idempotent merge, skipped unknown products). Covered: successful migration; `{ok:false}`; rejected request; `{mode:"guest"}` and unknown shapes; intent persisted before the first request; retry after failure and repeated retries without duplicates; second migrate ignored while one runs; partial migration (skipped products; second batch failing keeps only unconfirmed ids); logout after success; logout after failed migration; login as a different customer without leakage; guest list merged only into the signing-in customer; session lost while pending; stale read after a toggle (initial fetch, toggle, old fetch resolves, final state is the toggle); stale read begun during a toggle; only the newest of two reads applied; ordinary successful and failed initial fetch; toggle failure and double click.

### Check results (2026-11-18)
| Check | Status |
|---|---|
| `node --experimental-strip-types --test src/lib/wishlist-sync.test.ts src/lib/wishlist-rules.test.ts` | EXECUTED — PASS (27/27) |
| All app test files importable without installed packages (command per file) | EXECUTED — PASS (107 passed, 0 failed; 15 other app test files cannot import `drizzle-orm`/`@electric-sql/pglite`/etc.) |
| `node --test scripts/frontend-source.test.mjs` | EXECUTED — PASS (9/9); STATIC REVIEW ONLY in nature (reads source text, not an automated behaviour test) |
| `node --test 'scripts/**/*.test.mjs'` | EXECUTED — FAIL: 213 run, 202 pass, 11 fail. The same 11 tests (same names) fail on the unmodified Batch 03 archive: missing `.grok/` platform folder and missing installed packages. Pre-existing (baseline comparison run). Two of them (`brand-check`) pin the old platform `AGENTS.md`; they could not pass before and cannot now |
| TypeScript syntax parse of all new/edited files | EXECUTED — PASS (syntax only, not a typecheck) |
| `npx tsc --noEmit` | NOT EXECUTED — ENVIRONMENT LIMITATION (no network, no `node_modules`; `npm view react` fails) |
| `npx eslint . --quiet` | NOT EXECUTED — ENVIRONMENT LIMITATION |
| `npm run build` | NOT EXECUTED — ENVIRONMENT LIMITATION |
| Database/PGlite tests (`correction.test.ts`, `batch02.test.ts`, `flow.test.ts`, others, 15 files) | NOT EXECUTED — ENVIRONMENT LIMITATION |
| Real PostgreSQL tests | NOT EXECUTED in this pass (the Batch 02 correction ran `scripts/pg-media-race.sh` on PostgreSQL 16; unrelated to this change) |
| Browser tests: login, wishlist migration, retry, logout, account switching; responsive checks | NOT EXECUTED — ENVIRONMENT LIMITATION (app cannot be built or served without dependencies) |
| React rendering test of `WishlistMigrationNotice` | NOT EXECUTED — ENVIRONMENT LIMITATION (no DOM/test renderer installed) |

### Remaining risks
- The zustand adapter (`cart-store.ts`, persist migration v2→v3), `wishlist-client.ts`, `WishlistMigrationNotice` and the three edited components were never type-checked, linted, rendered or run in a browser. Run the checks above first.
- The migration notice appears whenever `pending` is non-empty; a refresh in the middle of a request leaves ids pending and shows the retry notice (safe, slightly conservative).
- Ids skipped by the server (deleted products) are dropped from the list without a customer message.
- Earlier-batch gaps are unchanged (see `REMAINING_ISSUES.md`).

### Approval readiness
Implementation complete for corrections A–C; verification incomplete as listed. Batch 04 was not started.

## 11. Historical handoff snapshots (superseded)

**2026-11-19 — Batch 07 Revision 01 (historical):** See `BATCH_07_REPORT.md` for that checkpoint and the top-of-file Revision 02.1 handoff for current status. The dated snapshots below are historical and superseded; their then-next-batch instructions do not apply now.

**As of 2026-11-18, after the Batch 03 correction:** latest archive `SHAHOO-v1.0.0-batch03-correction.zip` (supersedes `SHAHOO-v1.0.0-batch03.zip`; not owner-approved). History in short: Batch 00 baseline and docs; Batch 01 production safety (+ correction removing sample business data); Batch 02 commerce integrity (+ correction: recovery category validation, refund-to-payment link, media locking proven on real PostgreSQL 16 at SQL level); Batch 03 frontend reliability; Batch 03 correction: safe guest-wishlist migration with retry, stale-read protection, documentation consistency. Actual limits: `tsc`, ESLint, the production build, every PGlite/Drizzle test file (including `correction.test.ts` and the edited `flow.test.ts`) and all browser/responsive tests have never been executed in the agent sandbox (no network, no `node_modules`); 11 platform script tests fail for environment reasons identically before and after. The shop cannot take a real payment. **Next planned batch: Batch 04 (homepage sections, hero carousel, cart drawer), only after the owner approves this correction.** First task for the next agent with network: `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `env -u DATABASE_URL npm test`, build with `DATABASE_URL` unset, then a browser pass.

**As of 2026-11-18, after Batch 03:** latest archive `SHAHOO-v1.0.0-batch03.zip` (built on the Batch 02 correction; not owner-approved). Frontend reliability work only; tsc, eslint, build, PGlite suites and browser tests were NOT executed in the sandbox, so run them first (see `BATCH_03_REPORT.md`). Batch 04 not started.

**As of 2026-11-17, after the Batch 02 correction:** latest archive `SHAHOO-v1.0.0-batch02-correction.zip` (supersedes `SHAHOO-v1.0.0-batch02.zip`, not yet owner-approved). It fixes stock-recovery category validation, the refund-to-payment link in `settlePaidCancel`, and media attach/replace/retire locking; see the Batch 02 correction entry. Real PostgreSQL race proof exists at SQL level only; tsc, eslint, build and the PGlite suites were not executed in the correcting sandbox. Batch 03 not started.

**As of 2026-11-17, after Batch 02:**

- Latest code archive prepared for review: `SHAHOO-v1.0.0-batch02.zip`.
- Input was the owner-approved `SHAHOO-v1.0.0-batch01-correction.zip`.
- Batch 01 safety fixes and the correction remain. Batch 03 has not been started.
- Do not start Batch 03 until the owner reviews this ZIP.
- Migration `0008_batch_02.sql` adds payment currency (IRR) and a refund-to-payment link. It deletes nothing.
- Multi-connection PostgreSQL concurrency was not executed.
- No production database, payment gateway, or SMS provider was used.
- The shop cannot take a real payment.
- Guest merge sums once. Repeated local adopt uses max. The 24-hour hold is unchanged.
- Databases that already contain the old sample rows are not wiped.

### What the Batch 02 reviewer was asked to check (historical)

- Cart merge, checkout replay, payment failure, expiry, refund ceiling, and shared-media tests in `BATCH_02_REPORT.md` match the source.
- PGlite results are not described as PostgreSQL multi-connection proof.
- Batch 01 still fails closed without `DATABASE_URL`, still blocks demo seed and mock payment in production, and `npm run build` still does not migrate.
- `migrations/auth/0001_auth.sql` is still present and unchanged.
- This continuity file is inside the ZIP and still contains the earlier history.
- The archive opens (empty files stored, not deflated) and is named `SHAHOO-v1.0.0-batch02.zip`.

## 12. Change log for this continuity file

- **2026-11-19 (Batch 08 Revision 02.1):** Reconciled the current source identity, remediation stage, prior-versus-fresh evidence, release gates, missing original audit descriptions, deferred integrations and owner-review stop. Found and minimally corrected the direct-server auth whitespace discrepancy with regression tests. Older entries and approved decisions remain as historical context.
- **2026-11-16:** Initial consolidated master context created from project decisions, prior audit summaries, Batch 00 review, approved UI requirements and the agreed Batch 00–08 roadmap.
- **2026-11-16 (Batch 01):** Recorded the implementation results, the `0001_auth.sql` correction, test limits, and the Batch 02 handoff. Earlier sections were updated in place. Historical Batch 00 text in section 5 was kept.
- **2026-11-16 (Batch 01 correction):** Recorded that the fresh baseline no longer publishes sample contact details, invented shipping prices, a free-shipping banner, or the old brand story. Public rendering hides those empty or exact sample values. Admin configuration remains. Batch 02 was not started.
- **2026-11-17 (Batch 02):** The owner had approved the Batch 01 correction. Recorded commerce-integrity work: one-time guest cart merge, max-not-sum local adopt, checkout key inside the order transaction, payment state machine without a gateway, 24-hour hold kept, refund ceiling and explicit one-time restock, shared-media protection, and migration `0008_batch_02.sql`. Tests executed: 205 + 145 + 37 passed, 0 failed. Multi-connection PostgreSQL was not executed. Output archive `SHAHOO-v1.0.0-batch02.zip` is waiting for owner review. Batch 03 was not started.
- Future batches must append dated entries here and update the relevant sections above. Preserve prior decisions and historical batch records; do not erase history when updating current status.
- **2026-11-17 (Batch 02 correction):** Fixed three Batch 02 review findings (recovery category check via shared `isLineSellable`; `refundOfPaymentId` set by `chooseRefundSourcePayment` in `settlePaidCancel`; media asset-row locking in `src/server/media/lock.ts` with retry of pending file cleanup). Added `scripts/pg-media-race.sh` (real PostgreSQL 16, separate connections: passed, with a negative control reproducing the old race). Not executed: tsc, eslint, build, all PGlite tests including the new `correction.test.ts`. One existing `flow.test.ts` fixture needed a verified payment row. Output `SHAHOO-v1.0.0-batch02-correction.zip`. Batch 03 not started.
- **2026-11-18 (Batch 03):** Recorded frontend reliability work (wishlist account isolation, cart/upload/address feedback and duplicate-click guards, Persian not-found/error screens, accessibility basics). Executed: 27 new tests passed, 88 runnable app tests passed, script failures identical to baseline. Not executed: tsc, eslint, build, PGlite, browser, DOM tests. Output `SHAHOO-v1.0.0-batch03.zip`. Batch 04 not started.
- **2026-11-18 (Batch 03 correction):** Rewrote the status header; added the Batch 03 correction entry (confirmed guest-wishlist migration with retry, read-gate against stale responses, `AGENTS.md` made portable, `FILE_INVENTORY.md` recounted, Batch 08 report marked historical). Executed: 27 wishlist tests pass; 107 runnable app tests pass; script failures identical to baseline. Not executed: tsc, ESLint, build, PGlite suites, browser tests. Output `SHAHOO-v1.0.0-batch03-correction.zip`. Batch 04 not started.


## Batch 04 correction handoff (2026-11-19; historical)

Owner-accepted baseline: `SHAHOO-v1.0.0-batch03-correction.zip`; no separate full Batch 03 verification. At that time the initial Batch 04 archive `SHAHOO-v1.0.0-batch04.zip` was amended by review archive `SHAHOO-v1.0.0-batch04-correction.zip`, then the work stopped. Batch 05–08 remained; Batch 09 (SMS.ir and PayPing) was after Batch 08 and documentation-only here. Earlier roadmap/status paragraphs were snapshots superseded at that time by this entry; the current status is stated at the top of this file, not in the historical Batch 07 handoff below.

The original Batch 04 added the accessible server-backed header cart drawer, product image projection, cautious persisted change-intent/retry handling, synchronization with the original cart page, and a narrowly scoped checkout reviewed-cart guard. Product prices remain server-authoritative. Removed legacy `sec-featured` or public title «برگزیده‌ها» remains suppressed without deleting records. Existing migration `0009` retains its audit guard. The Production section gap is now resolved by migration `0010`, which adds only missing section types and preserves CMS edits and order; the homepage renders a graceful empty-product state without fake associations. Production must run the guarded standard migration before serving.

The hero uses three grouped line indicators, automatic/manual controls, reduced-motion/interaction pauses, responsive emphasis and limited image loads; more than three CMS banners remain accessible via previous/next. Banner alt text now comes from CMS media when supplied. Relevant controls have gold hover, active and focus treatments without changing brand assets or palette. Source-level limitations and exact checks: `BATCH_04_REPORT.md`, `REMAINING_ISSUES.md`, and `TEST_REPORT.md`. Full typecheck, ESLint, full suites, build, databases, real browser, mobile/desktop, keyboard/accessibility, cart synchronization and CMS/carousel verification are deferred to Batch 08; do not claim they passed.

`BATCH_09_INTEGRATION_PREPARATION.md` identifies the existing provider interfaces and future payment/SMS boundaries; no new gateway, SMS network call, real credential, speculative schema or provider dependency was added or enabled. Note: a conditional SMS.ir adapter was already present in the accepted source and was not added or enabled by this batch.

Correction evidence: isolated PGlite seed/migration checks 3/3, static frontend checks 10/10, CMS rules 9/9, and migration discovery/order assertion passed. Actual PostgreSQL/Production migration, full typecheck, lint, full suite, build, browser, responsive/accessibility and live CMS checks remain deferred to Batch 08. See `BATCH_04_CORRECTION_REPORT.md`.

## Batch 05 customer account handoff (2026-11-19; historical)

Source: the user-provided `SHAHOO-v1.0.0-batch04-correction.zip`; output: `SHAHOO-v1.0.0-batch05-customer-account.zip` for owner review. Batch 05 was implemented; the stop-for-owner-review instruction applied at that time. Batch 06–08 remained; Batch 09 SMS.ir/PayPing followed Batch 08 and separate approval. The roadmap/status passages above were snapshots for that time; the current status is stated at the top of this file, not in the historical Batch 07 handoff below.

The customer account now has direct Persian subroutes for profile, orders, addresses, settings and contact, active navigation, and a mobile/desktop grid. Customer ticket/support UI and duplicate wishlist navigation are absent; header wishlist and admin support backend remain. Profile fields are first/last name, immutable OTP mobile, and optional gender/age group. Updates are normalized/validated on the server and customer identity is taken from the session. Address CRUD includes recipient details, ownership filters, row locking, audit, default switching/replacement, and checkout compatibility for legacy empty recipient fields. Order history is customer-scoped/bounded and returns Persian labels without raw states or delivery mobile; staff notes remain hidden. Optional demographic reports are aggregate-only under `reports.read`, with answered denominator and missing count separated. No provider integration or Production DB was used.

Migration `0011_batch_05_customer_account.sql` adds profile and saved-address recipient fields, preserves existing rows, cleans duplicate active defaults deterministically and enforces one active default through a partial unique index. Production should run the standard guarded migration on an authorized database, after the usual backup and approved rollout; app startup/build does not migrate.

Verification: 20 pure tests, 4 PGlite account/address tests, 19 existing checkout/completion regressions, and 2 static navigation tests passed. Targeted lint passed; `npx tsc --noEmit --checkJs false` passed. Full `npx tsc --noEmit` is blocked by unchanged `cart-wiring.test.mjs:5` implicit-any TS7006. A local-only Vite route-generation check returned `/account` HTTP 200 and registered all four child routes. Full project tests/lint/typecheck, build, real PostgreSQL, production deployment, browser/responsive/accessibility and backup/restore remain deferred to Batch 08. Exact output and command evidence are in `BATCH_05_REPORT.md` and `TEST_REPORT.md`.

At that time the next agent was told not to start Batch 06 before owner approval. Preserve the completed Batch 00–05 history, inspect the owner-approved batch brief, and do comprehensive verification in Batch 08 with authorized safe infrastructure. Do not call SMS, payment, carrier or storage providers. This dated instruction is historical; the current owner-review stop point and next-batch state are stated above.


## Batch 06 product management and dynamic CMS handoff (2026-11-19; historical)

Source: owner-supplied complete `SHAHOO-v1.0.0-batch05-customer-account.zip`; output for review: `SHAHOO-v1.0.0-batch06-product-cms.zip`. Batch 06 implementation details are retained here as history. The full scope, known limits and check results are in `BATCH_06_REPORT.md`; operational CMS/media guidance is in `docs/CMS_MEDIA.md`.

The existing catalog editor now saves supported optional product facts, homepage/SEO copy, oil-guide values, specs, variants and category English name/order through existing schema. Blank facts remain blank; English names remain optional. Product detail displays the actual gallery, safe optional content, selected active variant/SKU/measurement and existing price/cart/availability behavior. Gallery relationships stay normalized and shared media is not deleted when a product association is detached. Gallery reorder is a locked, audited exact permutation. CMS media selection uses existing HTTPS registration only; no storage provider or production local storage was configured.

CMS can create pages in `site_pages`, publishing them at `/pages/{slug}` while preserving fixed root-route slugs. Article SEO uses existing columns; public article pages retain published-only filtering and now show reading time, cover alt text, and a Persian empty state exists for an empty magazine. Existing menus, banners, homepage sections, migration 0010 copy/order behavior and Batch 04 carousel are preserved. Bodies remain plain text; no HTML editor or alternate CMS was introduced. Media/article pickers are bounded to the 100 newest records with local search, not pagination.

No database migration was added and migrations `0001`–`0011` were not modified. No external service, Production database, storage bucket, migration, or deployment was used. New mutations retain `content.write`/`catalog.write` and audit behavior; no permission was added.

Verification executed: 12 CMS/media PGlite tests; 5 catalog tests including full-migration PGlite create/edit persistence and stock/variant preservation; 41 existing commerce/account regression tests; 16 catalog/CMS/carousel/media pure tests; `npx tsc --noEmit --checkJs false`; targeted ESLint; TanStack route-tree generation for `/pages/$pageSlug`. The temporary GET used a nonexistent/unpublished slug and returned 404, not a browser UI validation. Full JavaScript-aware typecheck, full ESLint/test suite, production build, real PostgreSQL, production migration, full browser/mobile/accessibility, and backup/restore remain Batch 08. PGlite is not PostgreSQL concurrency proof.

Known follow-up retained from Batch 06: the CMS media picker/list exposes only the newest 100 media records; server-side pagination or load-more is not implemented and is a future improvement if the library grows. Existing local-upload modules remain in source but Batch 06 did not expose a CMS file-upload form or configure object storage/local production storage; fixed page slugs cannot be changed; banner deletion is not offered; rich HTML is unsupported. At that historical point Batch 07 Revision 01 was pending owner approval and Batch 08 comprehensive verification was still ahead; see the current handoff for today's gate.

## Batch 07 Revision 01 handoff (2026-11-19; historical snapshot, superseded)

The instructions, open quote question and verification figures in this subsection describe the Batch 07 checkpoint only. Batch 08 and Revisions 01–02 have since occurred; `quoteCart` was fixed and the current stop point is owner review of Revision 02.1. See the current handoff at the top.

At that checkpoint Batch 05 was complete; Batch 06 was implemented and reviewed; Batch 07 (admin orders, customers, inventory) and its focused correction were complete in source and pending owner approval. The instruction then was not to begin Batch 08 or Batch 09 without the required explicit approvals. Output: `SHAHOO-v1.0.0-batch07-revision01.zip`; full evidence is in `BATCH_07_REPORT.md`.

The correction adds PGlite/request-context tests for `loadAdminOrders`, `loadCustomers`, `loadCustomer`, `setCustomerStatus`, `loadInventoryDesk`, and `adjustInventory`, and adds missing-reason plus audit/history assertions to existing fulfillment lifecycle tests. The Batch 07 business implementation is otherwise preserved. Migration `0012_batch_07_inventory_audit.sql` adds nullable stock-before/after snapshots, an optional order foreign key, and its index; existing history is not backfilled. It passed the isolated PGlite migration/integration tests only; real PostgreSQL and production deployment were not tested.

At that checkpoint, `quoteCart` sellability consistency was an unresolved question for the planned Batch 08 investigation, not a confirmed vulnerability. Batch 08 subsequently found and fixed the divergence and added regression tests. Preserve the Batch 06 media-picker limit: newest 100 records only, with no server-side pagination/load-more.

The Batch 07 configured test run had ten platform/script failures out of 215; the exact same ten test names and the same 205/215 result occurred when the Batch 06 archive was run. Their causes and follow-up are itemized in `BATCH_07_REPORT.md`. That batch's application tests passed 214/214 and the PGlite/integration group passed 83/83. PGlite is not proof of PostgreSQL multi-connection behavior.


## Batch 08 original review (historical snapshot, 2026-11-19; superseded)

The original review's audit findings, counts, test outcomes and environment limitations below are historical, before Revisions 01 and 02. The Better Auth advisory and older moderate count are superseded; consult the current handoff and `BATCH_08_FINAL_RELEASE_EVIDENCE.md` for the present gate and fresh rerun results.

Batch 08 comprehensive audit is complete from `SHAHOO-v1.0.0-batch07-revision01.zip` (source SHA-256 `9e9ec41fb296bb587d6431ae98af95ff1b27652b93926d00f22bb5e3c1b3c918`). Dependencies installed from the lockfile. TypeScript passed; ESLint passed with five warnings; application tests passed 214/214; migration-aware PGlite/integration tests passed 90/90; production build passed; and the new quoteCart sellability regression suite passed 7/7.

A confirmed quoteCart consistency defect was fixed: quoteCart now uses the shared sellability rule and rejects unpublished/deleted products, inactive/deleted categories, and inactive/deleted variants. Cart lookup also rejects soft-deleted variants. An explicit postal-code accessible name was added.

The final decision is **NOT READY FOR RELEASE**. Real PostgreSQL fresh/upgrade/concurrency testing, backup/restore, browser/mobile/accessibility runtime checks, target-host verification, and deployment verification of `VITE_AUTH_ENABLED=false` were not executable in this environment. `npm audit` reported 10 findings including one critical Better Auth advisory. The configured platform script group remains 206/215 passed, 9 failed because private `.grok` harness inputs are absent and one upload assertion is obsolete for the supported HTTPS-only media-registration design.

Deliverable: `SHAHOO-v1.0.0-batch08-review.zip`. Batch 09 SMS.ir and PayPing remains pending and was not started. No production deployment or owner approval is claimed. See `BATCH_08_REPORT.md` for exact evidence and the deployment checklist.


## Batch 09 source handoff addendum — 2026-11-19

The owner explicitly authorized Batch 09 from `SHAHOO-v1.0.0-batch08-revision02.1.zip`. This addendum supersedes earlier statements that Batch 09 had not been authorized, while preserving the independent-review stop condition. SMS.ir's official Verify adapter and PayPing's isolated v3 HTTP primitives are present in the Batch 09 working source. The SMS.ir adapter is not a live delivery verification. The PayPing adapter is **not connected** to order initiation, return callback, payment settlement, or reconciliation. **Batch 09 remains incomplete; live PayPing must not be enabled.**

The exact contracts checked on 2026-11-19 are recorded in `BATCH_09_IMPLEMENTATION_REPORT.md`: SMS.ir `POST https://api.sms.ir/v1/send/verify`; PayPing `POST https://api.payping.ir/v3/pay` and `/v3/pay/verify`, with form-encoded provider return. SHAHOO persists order amounts as integer IRR and displays Toman; the PayPing request uses the stored IRR integer, with no implicit conversion. The current PayPing helper validates its request/response shapes but no database attempt is persisted by it.

Preflight reconfirmed no hardcoded shared preview credential in `src/lib/auth/preview.ts`, exact raw auth-flag checks, deleted-variant filtering in checkout/recovery, checked challenge-ID OTP redemption, safe homepage seed handling and existing `.env.example`. Existing OTP throttles, challenge expiry, five-attempt rule and hashed storage were preserved. The policy where an older unconsumed challenge can be selected after a newer one is exhausted remains explicitly unresolved.

No migration was added. Focused deterministic tests cover the new pure/provider adapter layer; full-suite and build evidence, current blockers, actual file list and exact coverage limits are in `BATCH_09_IMPLEMENTATION_REPORT.md`. No real SMS, provider API, PayPing sandbox, payment, production database, PostgreSQL concurrency or deployment was used. The critical existing risk—verified provider money but failed local stock/order settlement—remains a blocker because existing `captureVerifiedPayment` creates and verifies an intent in one call and cannot atomically persist an already-verified PayPing attempt for recovery. A durable pending-attempt/reconciliation design and failure/retry tests are still required before end-to-end PayPing integration. Stop here for independent owner review; do not deploy, contact providers, enable live calls or begin another batch.

## Current handoff — Batch 09 remediation (2026-11-19)

Batch 09 is the current stage after Batch 08 Revision 02.1. The source now contains a durable PayPing attempt lifecycle, callback verification, official Already Verified handling, and reconciliation persistence around local settlement. SMS.ir Verify remains the existing OTP integration. This package is not production-ready: PayPing amount units remain unconfirmed from official documentation, no authorized sandbox or live provider call was used, and PostgreSQL concurrency/deployment evidence is outstanding. The unresolved older-OTP challenge policy was not changed.
