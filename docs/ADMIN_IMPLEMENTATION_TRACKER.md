# SHAHOO — Admin Platform Implementation Tracker

**Last updated:** 2026-11-20  
**Repository:** https://github.com/arefbrh/shahoo  
**Active implementation branch:** `feat/admin-cms-phase2` (stacked on `feat/admin-catalog-ux-phase1`)  
**Current phase:** Phase 2 — CMS, central brand/content controls, and admin usability guidance  
**Release posture:** NOT APPROVED. No Production promotion or merge authorization is implied by this tracker.

This is the canonical continuation note for the admin-platform work. Update it in the same pull request as meaningful implementation milestones. Keep facts, test evidence, and remaining work separate.

## 1. Owner's product requirement

The owner wants ordinary store operations to be performed entirely through the admin panel. A value should be edited once and then appear everywhere that consumes it: storefront, product pages, navigation, homepage, checkout, reports, and future channels. Repeated manual edits in source files are not acceptable for routine content and configuration.

The admin platform must remain portable across:
- Vercel deployments;
- Linux servers;
- Windows servers;
- Neon PostgreSQL;
- another supported PostgreSQL host;
- local/test execution using the repository's supported embedded test database.

**Portability does not mean every deployment can run without durable storage.** The application must expose a storage contract and provider adapters. A production deployment must use a durable, backed-up database. Neon is one provider, not a hard dependency in domain logic. PGlite is currently a development/test adapter and must not silently become a Production fallback. A future non-Neon PostgreSQL setup should work through standard PostgreSQL connection configuration and the same migrations. A file-based or embedded production adapter is a separate design decision requiring concurrency, backup, locking, and multi-process safety evidence before it can be supported.

## 2. Architecture rules

1. **Single source of truth:** admin writes canonical records/settings; storefront components read through shared server-side services. No duplicated constants for values already editable in admin.
2. **Provider independence:** business rules must depend on repository interfaces/services, not Vercel or Neon SDKs. Hosting-specific adapters belong at infrastructure boundaries.
3. **Durable production state:** production requires a durable database and persistent media storage. Never use ephemeral server filesystem storage for customer uploads.
4. **One write path:** validate at the API boundary, enforce authorization on the server, write related records in one transaction, and emit an audit event.
5. **No silent failure:** every mutation returns a safe, understandable result. Unexpected exceptions receive a correlation ID and server-side log entry; never expose SQL, credentials, stack traces, or provider internals to the browser.
6. **Data safety:** preserve order-time price snapshots and historical variant references; prefer archive/disable over destructive deletion; never seed demo records into Production.
7. **Environment separation:** Preview and Production use distinct databases and secrets. Database changes are not run against Production without explicit owner approval and a backup/recovery plan.
8. **Portable configuration:** environment variables configure infrastructure (database, storage, mail/SMS/payment providers, public origin). Store-specific content and merchandising settings belong in the database and admin panel.
9. **Test the real contract:** cover unit tests, PGlite behavior, disposable PostgreSQL integration/concurrency, and browser-level admin workflows. A green build alone is not sufficient.
10. **Document every handoff:** record branch/PR/commit, tests, deployment URL/state, DB target, changed files, known limitations, and exact next step.

## 3. Phase plan

### Phase 1 — Catalog save reliability and operator guidance
- [x] Create isolated branch from current `main`.
- [x] Add safe server-side handling for unexpected category/product mutation failures with correlation IDs.
- [x] Translate API schema failures into Persian field-level guidance.
- [x] Fix category form's missing exception handling and silent submission failure.
- [x] Add category required-field, slug, and sort-order validation before submission.
- [x] Add product/package field explanations and required-field cues.
- [x] Clarify that the product image must be a direct product image, not the site header logo.
- [x] Run CI: typecheck, lint, build, project tests, PostgreSQL integration.
- [x] Verify the generated Vercel Preview with the connected Preview database.
- [x] Owner smoke test: owner confirmed successful admin login and that all tested catalog actions worked correctly.
- [x] Close Phase 1 implementation/testing checklist; PR remains unmerged pending explicit owner authorization.

### Phase 2 — CMS and central brand/content controls
- [x] Review and port the central brand settings implementation from PR #7 into the Phase 2 branch; PR #7 remains unmerged and separate.
- [x] Add the CMS route to admin navigation, gated by `content.write`; `/admin/content` retains its server-side permission check.
- [x] Make existing banners, homepage sections, navigation, pages, magazine/articles, store profile/contact and brand settings discoverable from the CMS desk.

- [x] Add centralized carousel autoplay and interval controls (3–15 seconds), with reduced-motion support on the public homepage.
- [x] Add centralized header/footer layout controls: sticky-header toggle, header/footer logo heights with bounded validation, and footer content alignment. Settings are stored under `store.layout`, audited, and consumed by the public shell; defaults preserve the current layout.
- [ ] Complete responsive layout refinements after the next available Preview review.
- [ ] Audit every public component for canonical settings consumption and consistent cache invalidation/revalidation.
- [x] Add admin-only saved-content preview links for pages and articles (including drafts); unsaved changes preview in-editor. Saved preview is served through a noindex, permission-guarded route. Explicit publish/unpublish workflow remains to be completed.
- [x] Add immutable page/article revision history, transactional restore, and audit events (migration 0017).
- [x] Add explicit permission-guarded publish/unpublish actions for pages and articles, with validation and transactional audit events.

### Phase 3 — Media library
- [x] Implement provider-neutral media storage interface and provider-qualified object keys.
- [x] Add documented S3-compatible persistent object-storage adapter for Vercel and Linux/Windows hosting.
- [x] Add guarded upload, file validation, size limits, safe object names, alt text, usage references and provider-aware safe retirement/cleanup.
- [ ] Add image processing/thumbnail generation and verify all product/category/banner/article/logo workflows share the same media library. GIF upload sanitization now validates frame bounds, LZW clear/end codes and decoded pixel counts; focused regression tests are registered.
- [ ] Never rely on local ephemeral disk for production uploads.
- [ ] Ensure product/category/banner/article/logo images share the same media library.
- [x] Add S3-compatible upload/read/delete adapter tests, provider-aware retirement cleanup and fail-closed configuration tests. Latest code head includes these tests; current CI project-test job is still running.

### Phase 4 — Admin dashboard and reports
- [ ] Add date-range controls and server-side aggregation.
- [ ] Add order counts, verified payment/refund ledger, revenue semantics, trend charts and top products.
- [ ] Clearly distinguish paid/verified internal ledger amounts from bank settlement.
- [ ] Add export and report filters; avoid presenting unverified payments as revenue.

### Phase 5 — Admin accounts and access lifecycle
- [ ] Create/invite admin, edit name/email, reset credentials, revoke sessions, disable accounts.
- [ ] Review roles/permissions and enforce them server-side on every mutation.
- [ ] Add last-login/activity/audit views and prevent accidental lockout of the final owner.
- [ ] Require secure one-time invitation/reset flows; never expose password hashes.

### Phase 6 — Store operations and polish
- [ ] Dedicated price/bulk-price management while retaining variant as canonical price owner.
- [ ] Customer/order/support/review/coupon/shipping/SEO/notification/provider configuration.
- [ ] Search, pagination, bulk actions, safe exports, loading/empty/error states.
- [ ] Responsive Persian RTL UI and accessibility review.
- [ ] Verify operational portability and deployment instructions for Vercel, Linux and Windows.

## 4. Current infrastructure facts

- GitHub repository: `arefbrh/shahoo`, default branch `main`.
- Vercel project: `shahoo`, project ID `prj_xG91Dq0QOMB5m4lUir3v9aiJpMC9`.
- Team ID: `team_qzgaQxkmfv6MsnBo4sDJ0LFU`.
- Public domain: `https://shahoo.vercel.app`.
- Last known Production deployment: `dpl_4StaaRhcXQoxCU78LfuoXgRbJMQK`, READY, source `main` at `cdaf98f8a162aa267a7ebf1f591ffe55c90e3f3a`. This deployment does not include the active branch changes.
- Neon Production project: `shahoo-production`, project ID `billowing-queen-40432154`, branch `production`, branch ID `br-curly-dust-ba1kq0xb`, database `shahoo`, role `shahoo_app`.
- Never copy connection strings, passwords, tokens, or hashes into this file.
- Never run migrations, seed, truncate, delete, or mutate Production data as part of routine feature work.
- Production catalog was previously verified empty (zero products/categories/variants). Re-check read-only before making claims; never seed demo data into Production.

## 5. Related open work

### PR #7 — central brand identity (source implementation; not merged)
- URL: https://github.com/arefbrh/shahoo/pull/7
- Branch: `feat/admin-brand-settings`
- Latest known head: `0518a803a600c8d316d4eb42eed141884f92d693`
- CI run: `44749203317`; all required jobs passed (Quality, Project tests, PostgreSQL integration/migrations, Security, migration inventory, Payment/SMS mocks). Private platform harness was skipped.
- Latest known Preview deployment: `https://shahoo-bmkzqtvtn-shahoo.vercel.app`, READY.
- Not merged. Review and integrate separately; do not silently merge it as part of Phase 1.
- Direct upload is not implemented by PR #7; it adds editable HTTPS/local asset paths.

## 6. Phase 1 implementation record

- Branch created: `feat/admin-catalog-ux-phase1`, based on `main`.
- API file changed: `src/server/catalog/api.ts`.
  - Added a safe Zod validation adapter that reports the first invalid field in Persian.
  - Added server-side catch/log wrapper for unexpected catalog mutation failures; browser receives a short correlation ID instead of internal error details.
- UI file changed: `src/components/site/catalog-desk.tsx`.
  - Category submission now has pending state, required-field/slug/order validation, try/catch, actionable errors and cancel-edit behavior.
  - Category field purposes and slug/order examples are explained.
  - Product and package fields show required indicators and practical examples.
  - Product image guidance explicitly says to use a direct image for that product, not the header logo.
  - Product save exceptions no longer collapse silently to a generic untraceable failure.
- Commits on the branch:
  - `df368c7be68bded15c4e7ebbbaa01d8c16f7f712` — API validation/error handling.
  - `2976facfef1717e88fe07512af58e014cce97772` — category/product form reliability.
  - `8d1199ad52673cbdb90b794bc40ccfb5bafea9d0` — add required cues and examples for product/package fields.
  - `e3953720c1c6a18914153ab01ea4d0141db9570c` — add client-side product identity checks.
- No database schema/migration changes in Phase 1 so far.
- No Neon data has been changed.
- No Vercel Production environment variables or Production deployment have been changed.
- Latest Preview deployment: `https://shahoo-j3j1ndmtu-shahoo.vercel.app` (`dpl_Hg83VWXQBrzkjMYiqtKr2ijmvjb6`), READY for docs-updated branch head `66b799933ef22ce1c455ab754ab4b9389a987267`. The immediately preceding code deployment for `e3953720c1c6a18914153ab01ea4d0141db9570c` also reached READY.
- CI run `44761442398` applies to code head `e3953720c1c6a18914153ab01ea4d0141db9570c`: Quality (typecheck/lint/build), Project tests, PostgreSQL integration/migrations including contention and backup/restore, migration inventory, Security, and Payment/SMS mocks all passed. Manus private platform harness was skipped.
- Owner completed the Preview admin smoke test and confirmed that login and all tested catalog workflows worked correctly. This is owner-reported browser verification, not a claim that the private platform harness ran.
- Preview admin bootstrap deployment used for the owner test: `https://shahoo-47810kea7-shahoo.vercel.app` (`dpl_EqqjPtkXRD8yVN4krmf9n8Pa34jo`), READY, commit `0e0e5079672423c2945186ba61daf3fbda3c2316`.
- Vercel environment metadata confirms a Preview `DATABASE_URL` and Preview `SEED_DEMO` variable are configured (values not read); Production `DATABASE_URL` is separately configured. No secrets were retrieved.
- Read-only Neon Production check confirmed database `shahoo`, role `shahoo_app`, 52 public tables, and zero non-deleted categories/products/variants. No Production rows were modified.

## 7. Required handoff checklist

Before handing this work to another agent:
1. Read this file and `PROJECT_HANDOFF.md`.
2. Inspect the active branch and PR, not only `main`.
3. Verify the exact latest commit SHA and workflow run results.
4. Re-read any files the previous agent changed; do not trust a prose-only summary.
5. Keep Production untouched and keep demo seed disabled there.
6. Do not merge PRs or promote Production without the owner's explicit instruction.
7. Update this tracker with completed tasks, exact evidence, remaining blockers, and the next command/action.


## 8. Staging admin access bootstrap (2026-11-20)

- Root cause of the reported Preview login failure: Production and Preview use different Neon databases. The Production `admin_users` table had one active owner account and audit logs showed two successful Production logins. The staging `admin_users` table was empty.
- Added sensitive Vercel **Preview-only** environment variables `SHAHOO_ADMIN_EMAIL`, `SHAHOO_ADMIN_PASSWORD_HASH`, and `SHAHOO_ADMIN_NAME`. No Production environment variable was changed.
- New Preview deployment: `https://shahoo-47810kea7-shahoo.vercel.app`, deployment `dpl_EqqjPtkXRD8yVN4krmf9n8Pa34jo`, READY, branch `feat/admin-catalog-ux-phase1`, commit `0e0e5079672423c2945186ba61daf3fbda3c2316`.
- The admin account is created lazily by `ensureAdminFromEnv` on the first request to `/admin`; therefore open the Preview `/admin` route once before login. Verify the staging `admin_users` row after that request.
- A unique staging-only password was generated and provided to the owner in the conversation. Do not store it in this repository.
- Production account and database were not modified. Production login credentials remain separate.


## 9. Phase 1 completion confirmation (2026-11-20)

- Owner confirmed: "همه رو انجام دادم همه چیز درست بود" after testing the Preview admin login and catalog workflows.
- CI run `44761442398` was re-polled after the owner confirmation; every required job completed successfully, including Project tests. The Manus private platform harness was skipped by workflow configuration.
- Phase 1 implementation and owner smoke-test checklist are complete on `feat/admin-catalog-ux-phase1`.
- PR #8 remains open/draft and is **not merged**. No Production deployment, Production data mutation, or Production configuration change was made as part of this completion.
- Next workstream: Phase 2, CMS and central brand/content controls. PR #7 remains a separate, unmerged change and must be reviewed/integrated deliberately; the admin navigation still needs a discoverable CMS entry.


## 10. Phase 2 initial implementation (2026-11-20)

- Branch: `feat/admin-cms-phase2`, based on the completed Phase 1 branch `feat/admin-catalog-ux-phase1` at `e6190c66aacb5f1b2172ec6f7804725ea9d5379f`.
- PR #9: https://github.com/arefbrh/shahoo/pull/9 (draft, stacked on PR #8; base is `feat/admin-catalog-ux-phase1`). Merge order must be PR #8 first, then PR #9. Neither has been merged.
- Added `/admin/content` to `src/components/site/admin-shell.tsx`, visible only when the session includes `content.write`. The route itself independently checks `content.write` before rendering the CMS desk.
- Ported central brand settings from PR #7 into `src/components/site/content-desk.tsx`, `src/server/cms/content.ts`, `src/server/cms/api.ts`, and `src/lib/cms-types.ts`: brand name, tagline, copyright, header logo and footer logo. Saves are validated and transactional, preserving unrelated store-profile/logo settings and recording an audit event.
- Updated public header/footer logo alt text to use the canonical brand name in `src/components/site/shell.tsx`.
- No database migration, Production environment change, Production deploy, or Production data mutation. No direct binary media upload; logo values remain approved asset paths or HTTPS image URLs.
- Existing CMS functions remain: homepage copy/sections, banners, nav menus, pages, magazine/articles, media URL registration and store contact details. Carousel/header/footer layout controls and media upload/publish/revision workflow remain outstanding.
- CI status for PR #9 head `c489893bee1b26ccf38ce6299358c9ce40bffadd`: workflow run not yet returned at the time of this update. Do not mark tests passed until a run is available and all required jobs complete.
- Required next step: poll PR #9 CI, fix any failures, then inspect its Preview and ask the owner to smoke-test CMS navigation, brand save/reload, and storefront reflection. Keep Production untouched.
\n\n## 11. Admin usability guidance pass (2026-11-20)\n\n- Owner confirmed the CMS/brand settings Preview worked: a brand setting was changed, saved, and reflected on the public site. This is owner-reported browser verification.\n- Owner feedback: admin navigation felt crowded; many areas had no explanation and some appeared empty without context.\n- Added reusable Persian help panel at `src/components/site/admin-help.tsx`.\n- Grouped admin navigation into: «مدیریت روزانه»، «کالا و فروش»، «سایت و محتوا»، and «کنترل و دسترسی». Permission filtering remains unchanged.\n- Added contextual descriptions and practical examples to dashboard, orders, customers, inventory, reports, staff, catalog, CMS tabs/forms, coupons/shipping, support/returns, and reviews. Clarified empty banner/media states and distinguished catalog prices from inventory adjustments and store copy.\n- No schema changes, production data changes, environment changes, or Production deployment.\n- CI for pre-guidance PR #9 code commit `c489893bee1b26ccf38ce6299358c9ce40bffadd` completed successfully: Quality, Project tests, PostgreSQL integration/migrations, migration inventory, Security, Payment/SMS mocks passed; private platform harness skipped. Guidance commits require a new CI run before merge.\n- Owner smoke-tested CMS brand save/render successfully on Preview. Full admin guidance changes need a fresh Preview review, especially navigation grouping and the new explanatory copy.\n

## 12. Admin guidance validation follow-up (2026-11-20)

- Latest guidance branch head: `32875c63c5601ad5bc52b751c399a2ffced48151`.
- The first guidance CI attempt reported a TypeScript error because the shared offer-field component did not yet accept the new `hint` prop. Added the optional prop and rendered its help text; this was a code-level issue, not a data or migration failure.
- Fresh CI run: `44768520455` for commit `a6ed3bc42e5ca474dbbb2962b62ea9b7a219be2c` was started; a subsequent small formatting commit `32875c63c5601ad5bc52b751c399a2ffced48151` is the current branch head and must also be covered by CI/Preview.
- Latest Preview deployment for current head: `https://shahoo-mg8u5earf-shahoo.vercel.app`, deployment `dpl_8QtFdwxmRtyYCcrRWA4ZW6F83kb3`; last observed state BUILDING. Do not ask owner to test until READY.
- Production remains untouched. PR #9 remains draft and stacked on PR #8; no merge or Production promotion.


## 13. S3-compatible media storage adapter (2026-11-20)

- Added `S3ObjectStorage` using native Node crypto and Fetch with AWS Signature Version 4; supports S3-compatible PUT, GET and DELETE, including Cloudflare R2-style endpoints.
- `STORAGE_PROVIDER=s3` selects the adapter only when endpoint, bucket, region, access-key ID and secret are all present and valid. Incomplete/invalid configuration fails closed; local ephemeral disk is not used as a fallback.
- Media database rows now persist provider-qualified object keys (`local:` or `s3:`). The public media route resolves either configured provider, and storage read failures return 503 rather than silently masquerading as missing assets.
- Added `docs/MEDIA_STORAGE.md` with Vercel and self-hosted setup, environment variable names, backup considerations and staged rollout guidance.
- No storage credentials were configured, no bucket was created, no Vercel environment variables were changed, and no Production data or deployment was touched. S3 uploads remain unavailable until an operator provisions a bucket and adds Preview-only credentials.
- CI for the previous upload UI commit `1f4c4ef12bffec1555e1c9cfc6b076158696406d` passed. The S3 adapter changes in the following commit require a fresh CI run; do not claim them verified until all required jobs pass.
- Next: validate S3 signing/path behavior with focused tests and CI, configure a dedicated Preview bucket only with owner-approved credentials, then smoke-test upload/read/delete and image display before considering Production.


### S3 media lifecycle hardening

- Added provider-aware media retirement and retry cleanup: a `local:` asset is removed only by the local adapter and an `s3:` asset only by the matching S3 adapter.
- Cleanup failures create diagnostics; retries leave provider-mismatched items pending rather than marking them skipped or deleting from the wrong bucket.
- Added mocked tests for signed S3 PUT/GET/DELETE, endpoint path prefixes, unsafe names, fail-closed production configuration, provider-qualified keys and local traversal protection. Registered the test in `scripts/run-tests.mjs`.
- These additions are awaiting CI on the latest branch head; do not consider the adapter validated until the new suite passes.


## 14. CMS revision history and media storage verification (2026-11-20)

- Latest PR #9 head: `c6b7fcf8f9cd2a14a4e32178816ea168a7459730`; branch `feat/admin-cms-phase2`; PR remains open/draft and stacked on PR #8. The PR compares 50 commits ahead of `feat/admin-catalog-ux-phase1`, with no commits behind.
- CI run [`44781020108`](https://github.com/arefbrh/shahoo/actions/runs/44781020108) on that exact head completed successfully:
  - Quality (typecheck, lint, build): success.
  - Project tests: success.
  - PostgreSQL integration/migrations, multi-connection contention, backup/restore: success.
  - Migration inventory: success.
  - Security checks: success.
  - Payment/SMS mocks: success.
  - Manus private platform harness: skipped by workflow configuration; not counted as passed.
- Added migration `0017_content_revisions.sql` and the Drizzle schema for immutable page/article snapshots. Page/article create/update operations append snapshots transactionally. Admin history shows the latest 30 versions; restore validates the stored snapshot, restores page/article content and related product links transactionally, appends a new revision, and records an audit event.
- Added permission-guarded `getContentHistoryFn` and `restoreContentRevisionFn`; both require `content.write`. The history UI is present in page/article editor forms.
- Added S3-compatible storage adapter using AWS Signature Version 4, provider-qualified keys, fail-closed configuration, media route reads, and provider-aware retirement/retry cleanup. Added mocked PUT/GET/DELETE, path-prefix, unsafe-name, fail-closed config, provider-key and traversal tests.
- The exact latest CI run above passed the full project test suite and Quality, PostgreSQL, migration, security, and payment/SMS checks, including the S3 lifecycle test coverage.
- No S3 bucket or credentials have been provisioned. Upload remains disabled until an operator configures a persistent S3-compatible bucket and Preview-only credentials. No Vercel environment variables, Preview deployment, Production deployment, or Production data were changed in this work.
- Vercel's deployment creation limit previously blocked new Preview builds after the project exceeded its 24-hour deployment quota. The owner asked to defer deployment until the final review; no manual Preview deployment was triggered.
- PR #8 and PR #9 remain open/draft; neither is merged. PR #9 is stacked on PR #8. No Production changes or release approval.
- Remaining Phase 2 work: admin-only content preview/publish workflow, final responsive review, and an end-to-end audit of canonical settings/cache invalidation.
- Remaining Phase 3 work: image processing/thumbnail generation, shared-media-library coverage across all asset types, and an owner-approved Preview bucket configuration followed by upload/read/delete smoke testing.
- Next implementation step: add a safe admin-only preview path for unpublished pages/articles without exposing drafts publicly; then add explicit publish/unpublish actions with permission checks, transactional audit history and regression tests.

## 15. New roadmap phase — order fulfillment, invoices, shipping labels and printing (2026-11-20)

Owner requirement: expand order management beyond a basic status field into an end-to-end pick, pack, document, dispatch and tracking workflow. This is a planned product phase; no implementation or order-data changes are implied by this roadmap entry.

### Phase 7 — Order fulfillment and print center

- [ ] Map the complete order lifecycle: received, payment verification, picking, packing, ready to dispatch, handed to carrier, in transit, delivered, failed delivery, returned/cancelled. Keep payment state separate from fulfillment/shipping state.
- [ ] Add an order fulfillment workspace with item-level picking checklist, quantities, variant/SKU, stock validation, packing notes, package count/weight/dimensions, operator and timestamps.
- [ ] Preserve immutable order-time product names, SKUs, quantities, discounts, shipping/tax and price snapshots on the invoice; never recalculate historical invoices from current catalog prices.
- [ ] Create a distinctive SHAHOO invoice design using the approved minimal brand logo. First deliver a visual draft for owner review; do not add the template or implementation to the app until explicit design approval.
- [ ] After approval, generate invoice exports as print-quality PDF, PNG preview/image, and Excel-compatible XLSX. Define Persian RTL typography, numerals, currency formatting, page breaks, long-item handling, order number/date, buyer details, line items, totals, payment/shipping details and return/contact policy.
- [ ] Support customer-facing invoice and internal picking/packing slip as separate document modes, with configurable visibility of prices and internal notes.
- [ ] Add a sender profile in admin (name/business name, phone, return address, postal code and optional contact details). Sender details must be editable centrally and snapshotted onto each shipment label when created.
- [ ] Generate a shipping address label from the order recipient details plus the configured sender profile. Validate recipient name, phone, full address and 10-digit postal code; allow authorized correction before label generation and retain an audit trail.
- [ ] Research and document carrier-specific requirements before claiming compliance. Initial research found general address/legibility guidance and references to sender/recipient address, postal code and phone, but did not establish one authoritative current National Post label size/layout specification. Treat A5/A4 and 100×150 mm (4×6 inch) thermal layouts as configurable candidate formats, not officially approved dimensions. Confirm current requirements with the National Post / carrier or its merchant integration documentation before finalizing.
- [ ] Build a print center with selectable paper/label size, orientation, margins, scaling, copies, printer destination via the browser/system print dialog, print preview, and safe retry. Support ordinary laser/inkjet printers and common thermal label printers without hard-coding one printer model.
- [ ] Provide dedicated layouts for A4/A5 sheet printing and configurable 100×150 mm / 4×6 thermal labels; add calibration/test page and preserve barcode quiet zones and minimum readable sizes where carrier barcodes are used.
- [ ] Keep carrier tracking number/barcode distinct from SHAHOO order number. Only print a carrier barcode/official tracking identifier when issued by the carrier or its approved integration; never fabricate one.
- [ ] Add shipment records, carrier/service, tracking number, dispatch date, shipping cost, label generation history, reprint action, delivery/exception events and customer notification hooks.
- [ ] Investigate official carrier APIs/merchant portals (starting with Iran National Post) for address validation, shipment registration, postage, tracking and label generation. Keep carrier integration behind an adapter so other carriers can be added.
- [ ] Add permissions, audit events, idempotency and tests for duplicate label generation, reprints, address edits, partial shipments, refunds/returns and concurrent fulfillment.
- [ ] Test print output on PDF and real hardware: at least one standard printer and one thermal label printer, across desktop browsers. Browser printing is the portable baseline; direct silent printing/device management may require an optional local print bridge or supported network-print service and must be evaluated separately.
- [ ] Do not mark carrier compliance or hardware compatibility complete based only on generated PDFs or mocked tests; require owner verification on actual devices and confirmation from the selected carrier.

### Research notes (initial, non-final)

- Public guidance located during initial research emphasizes a legible complete recipient address, city/province, postal code and placement on the parcel; supplementary operational guidance recommends recipient/sender names, phone numbers and complete address. See the carrier-neutral guidance at https://peyksanati.ir/ and public postal-address guidance reported at https://www.hamedanpayam.com/file/0xb5407d15ede41191.pdf.
- A Tapin merchant agreement document refers to an address label, parcel contents information, accompanying sales invoice, and use of a digital scale and laser printer in that specific contractual workflow: https://www.tapin.ir/wp-content/uploads/2020/01/اعتبار-حقوقی.pdf. This is not a universal National Post specification.
- A public label generator advertises A5 output and multi-carrier use, but this is third-party evidence, not proof of official approval: https://postprinter.ir/.
- Before final design, obtain the current requirements for the actual service used by SHAHOO (National Post, including any merchant/contract workflow, or another carrier). Determine whether the carrier provides its own barcode/label, mandatory fields, label stock size, placement, and whether merchant-generated labels are accepted.

### Delivery sequence

1. Complete the currently active CMS/media work and its review; do not interrupt the active branch with order-print implementation.
2. Audit the existing order/payment/shipping schema and admin routes; write an order lifecycle and data-gap proposal before schema changes.
3. Produce the SHAHOO invoice visual concept and sample data preview in PNG/PDF/XLSX for owner approval. Keep it outside the application until approved.
4. Research and confirm the chosen carrier's label requirements; produce a separate shipping-label concept for owner review.
5. Implement immutable invoice snapshots, fulfillment workflow, sender settings, label generation and print center in isolated PR(s), with migrations/tests.
6. Validate browser print and real standard/thermal printers, then owner-smoke-test Preview.
7. Only after explicit owner approval, merge and promote through the normal release process.



## 16. Saved content previews, GIF validation and order-schema audit (2026-11-20)

- Latest observed PR #9 head: `a88dd6af38ed906d64c411b9c0e062b22925ae3c`; PR #9 remains draft and stacked on PR #8. No merge or deployment was performed.
- Added saved page/article preview loading for drafts and published content, with an admin-only server function and a noindex preview route. The editor offers a new-tab preview of saved content while retaining an in-form preview for unsaved edits. Preview tests cover page and article drafts.
- Hardened GIF sanitization: require an initial LZW clear code, validate frame rectangles against the logical canvas, validate decoded pixel counts, and correct dictionary phrase-length handling. Regression tests include valid and malformed GIF fixtures.
- Latest CI run `44797010227` on the observed head: Quality, Security, PostgreSQL integration/migrations, migration inventory, and Payment/SMS mocks passed. Project tests were still in progress at the last poll; do not claim the full suite passed until it completes. Private platform harness is skipped by workflow configuration.
- Order-schema audit (read-only): existing `orders` rows already snapshot recipient name/mobile/address/province/city/postal code/plaque/unit, shipping method/title, tracking code, monetary totals and payment status. `order_items` already snapshot product name, variant label, SKU, quantity, unit price and line total. `order_events` and `shipping_logs` provide event history; `payment_attempts` and `payments` are separate records. Existing admin actions support manual fulfillment status transitions and manual carrier/tracking entry.
- Media-library audit (read-only): the `media_assets` table exists and product images plus article covers can reference it, but category imagery, banners/homepage section visuals and brand/header/footer logos still use URL/path fields rather than a shared `mediaId` relation. The CMS upload flow registers assets, but it is not yet a complete searchable/selectable media desk reused by every content editor. Thumbnail/derivative generation is also absent. This is why Phase 3 remains open.
- Identified gaps for the planned Phase 7: no dedicated immutable invoice/document snapshot or invoice numbering/version record; no configurable sender profile or sender snapshot per shipment; no package/parcel, weight/dimensions, pick/pack item checklist or partial-fulfillment model; no carrier-issued label artifact/barcode record, label reprint history or print-job settings; and no verified carrier API integration. These are audit findings from schema/code inspection, not changes to live data.
- Next: finish and verify the running Project tests; then close the remaining CMS/media gaps without deploying. Phase 7 implementation stays deferred until Phase 2/3 review. Invoice visual concept must be shown to the owner and explicitly approved before its template is added to the application.
