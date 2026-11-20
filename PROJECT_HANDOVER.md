# PROJECT HANDOVER — SHAHOO v1.0.0

## Current workflow status — Batch 09 remediation (2026-11-19)

Latest completed remediation: **Batch 08 Revision 02**, implementation completed and reviewed. Current stage: **Revision 02.1**, documentation and release-evidence reconciliation. Release decision: **NOT READY FOR RELEASE**; no final approval has been granted. Batch 09 has not started. The next authorized action after delivery is owner review, not implementation of another phase.

Verified input: `SHAHOO-v1.0.0-batch08-revision02.zip`, SHA-256 `eb5aac8b54e0edeb233a2fb2c23e0adda72358b5b36e61812992e015083907cd`; ZIP integrity passed, 385 files and 41 directory entries. Intended output: `SHAHOO-v1.0.0-batch08-revision02.1.zip`; verify its own SHA-256 against the detached final-delivery checksum, not the input checksum. A ZIP cannot contain its own final checksum without changing the ZIP.

The confirmed `quoteCart`/cart sellability drift was fixed: the shared `isLineSellable` rule is used by both, and pure plus PGlite database-path regression tests are present. Revision 02 prevents demo seeding from duplicating already-provisioned homepage section types. Better Auth is pinned at `1.7.26`, and the lockfile has `typescript-eslint@8.73.0`; the old critical advisory and seven-moderate count are superseded by the Revision 02 audit. The approved CMS path is HTTPS URL registration, not a configured object-storage workflow.

**Authentication correction:** Revision 02 left a whitespace-padded raw flag discrepancy in direct gate and Better Auth server paths. Revision 02.1 minimally corrected both comparisons; added tests failed before and passed after (27/27 gate tests), so only raw exact `"true"` opts in across these paths. Explicitly set and verify `VITE_AUTH_ENABLED=false` for both build and runtime; different environment inputs can still diverge. SHAHOO custom OTP/session/RBAC is separate from platform auth.

**Credential exposure / 02.1 correction:** The input archive contained a hardcoded shared platform-preview OAuth client secret in `src/lib/auth/preview.ts`. It has been removed from this output. Optional broker OAuth now needs an injected `GROK_AUTH_CLIENT_SECRET` or `GROK_PREVIEW_CLIENT_SECRET` and remains unavailable without one; exact `VITE_AUTH_ENABLED=true` may still enable the separate gate path. This does not change SHAHOO's custom customer/admin auth. The input may already have exposed the credential: the credential owner should assess and rotate/revoke it and review exposure; rotation and live provider verification were not performed. Keep secrets outside the archive.

**Prior reported Revision 02 results only:** installation, typecheck and build passed; lint: 0 errors, 5 warnings; application: 215/215; migration/PGlite: 94/94; auth wrapper/invariant: 24/24; gate identity: 25/25; bounded homepage desktop/mobile smoke passed; platform/script group: 212/216, with four failures attributed to missing private `.grok/skills/og` files; npm audit: zero vulnerabilities. These are not Revision 02.1 results. The latest rerun is underway; use `BATCH_08_FINAL_RELEASE_EVIDENCE.md` for fresh evidence when available. Do not call the overall configured `npm test` green on the basis of those prior figures.

Release blockers and gaps include real PostgreSQL fresh/upgrade, transactional and independent-connection concurrency verification; backup/restore; full browser E2E and accessibility; target-host/deployment, proxy/cookie and auth-off verification; and the incomplete private platform harness. The original Claude descriptions for 11 medium and 6 low findings remain **UNVERIFIED — ORIGINAL SOURCE MISSING** based on the Revision 02 report; they are not resolved merely by absence. Payment-provider reconciliation after failed stock recovery, lazy hold expiry/no scheduler, guest checkout throttling, and remaining security/operational questions require explicit review. See `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `REMAINING_ISSUES.md`, and the evidence register for context.

Do not begin Batch 09 or connect SMS.ir, PayPing, live payments, real SMS/OTP, shipping APIs, cloud storage or production hosting without separate owner approval. The final Iranian hosting environment has not yet been selected or purchased.

## Continue from here

Addresses, account wishlists, pending reviews, support tickets, fulfillment, local image upload, and internal notices are in. Checkout still creates an unpaid order. `paid` comes only from `captureVerifiedPayment` after a provider verifies a token. The shop has no pay button. `PAYMENT_PROVIDER=mock` is ignored in production. Migration `0006_completion.sql` added the completion tables. Migration `0007_media_primary.sql` allows one primary image per product. Do not edit `0002` through `0006`.

Login windows and locks live in `src/lib/login-throttle.ts` and `src/server/auth/throttle.ts`. OTP send limits live in `src/server/auth/otp-limit.ts`. Staff protection is `src/server/admin/access-control.ts`, which locks the `super_admin` role row. `SHAHOO_TRUST_PROXY=1` is safe only behind a proxy that overwrites `X-Forwarded-For`. Migration `0005` repairs ambiguous coupon links.

## Architecture


- UI routes in `src/routes` call server functions in `src/server/storefront/api.ts`, `src/server/auth/api.ts`, `src/server/commerce/api.ts`, `src/server/catalog/api.ts`, `src/server/offers/api.ts`, `src/server/admin/api.ts`, `src/server/account/api.ts`, `src/server/support/api.ts`, and `src/server/commerce/fulfillment-api.ts`.
- Those functions use Drizzle (`src/server/db`) after `ensureSeed()`.
- Drizzle sits on the platform database from `@/lib/db`:
  - `DATABASE_URL` set → PostgreSQL via `pg` (the code labels this backend `neon`).
  - unset → embedded PGlite only outside production, same instance as `getSql()`; production without a URL fails closed.
- Executable schema is `migrations/*.sql`. Drizzle tables in `src/server/db/schema.ts` mirror that file. If they drift, SQL wins until a new migration is added. Never edit an applied migration in place.
- Non-production PGlite initialization applies `migrations/*.sql`. PostgreSQL migrations run separately through `npm run db:migrate`; production build/startup does not run them. Seed is application code, not a second migration.
- Platform scaffold auth is separate from SHAHOO's custom OTP/session auth. `.env.example` documents `VITE_AUTH_ENABLED=false`; absent flag defaults false. Exact raw `"true"` is required in the wrapper/client and the corrected server/gate paths. Verify the actual build/runtime environment explicitly keeps the flag false before deployment. Do not enable it for Iranian OTP.
- Customer and admin sessions are separate HttpOnly cookies: `shahoo_customer`, `shahoo_admin`. The server stores only `sha256` of the token. OTP codes and admin passwords are `scrypt` hashes in the `s2$salt$hash` form.
- Guest carts use HttpOnly `shahoo_cart`. The database stores only the sha256 of that token. Customer carts are unique per customer. Login merges the guest cart and clears the guest cookie.
- Order pages use HttpOnly `shahoo_receipts` (`publicCode.token`). The database stores only the sha256. A customer who owns the order, or an admin with `orders.read`, can open it without that cookie.
- Plain helpers that touch the database must not live in a file that also exports `createServerFn` if a route imports that file. The client split will otherwise pull `pg` into the browser and hydration dies (`Buffer is not defined`). Foundation counts live in `src/server/storefront/report.ts` for this reason. Commerce mutations live in `src/server/commerce/*.ts` and only `api.ts` exports server functions. Catalog mutations live in `src/server/catalog/admin.ts`. Pure slug, price, and stock rules live in `src/lib/catalog-rules.ts` so the admin form can parse toman without importing the database.

## Stack versions that matter

- `@tanstack/react-start` 1.168.60 (meets the Vercel security floor).
- `drizzle-orm` 0.45.x
- React 19, Tailwind 4, Nitro, Zod 4, Postgres via `pg` and `@electric-sql/pglite`
- Fonts: Vazirmatn and Cinzel, self-hosted.

## Folder map

```text
src/routes                  storefront routes preserved from the beta
src/components/site         shell, catalog, product, cart, checkout, account, admin
src/server/db               Drizzle schema, client, seed
src/server/storefront       public catalog server functions and the guarded report helper
src/server/auth             OTP, cookies, guards, audit, admin bootstrap
src/server/commerce         cart, unpaid checkout, stock holds, order reads, fulfillment
src/server/catalog          admin category, product, and inventory writes; reviews
src/server/offers           coupons, manual shipping, cancel unpaid order
src/server/admin            dashboard, orders, customers, inventory, reports, staff
src/server/cms              homepage, banners, menus, pages, articles, media
src/server/account          address book and account wishlist
src/server/support          tickets
src/server/payments         provider interface; live gateways are not called
src/server/sms              provider interface; live SMS stays off
src/server/media            local disk storage and admin upload
src/server/notify           internal order and support notices
src/lib/order-flow.ts       legal status moves and refund amounts
src/lib/cms-rules.ts        pure content and media rules
src/lib/tehran-time.ts      Asia/Tehran civil day bounds
src/lib/login-throttle.ts   pure admin lockout policy
src/lib/offer-rules.ts      coupon and shipping drafts, cancel guard
src/lib/money.ts            IRR ↔ toman
public/assets/brand         official logo files, do not redraw
migrations/0002_*.sql       foundation schema
migrations/0003_*.sql       order idempotency, receipt hash, stock hold, one cart per customer
migrations/0004_*.sql       auth throttle, ops diagnostics, orders.coupon_id, new permissions
migrations/0005_*.sql       clear ambiguous coupon links; fill a unique null coupon id
migrations/0006_*.sql       addresses stay; payments, reviews, notices, tickets, returns, OTP buckets
```

## Database

Reference currency is IRR. Display toman with `formatTomanFromIrr`.

Important tables: `products`, `product_variants`, `inventory`, `inventory_logs`, `product_categories`, `homepage_sections`, `banners`, `navigation_menus`, `navigation_items`, `site_pages`, `articles`, `coupons`, `shipping_methods`, `orders`, `order_items`, `payments`, `payment_logs`, `customers`, `customer_addresses`, `wishlists`, `wishlist_items`, `reviews`, `support_tickets`, `support_messages`, `return_requests`, `notifications`, `admin_users`, `otp_challenges`, `otp_request_buckets`, `customer_sessions`, `admin_sessions`, `auth_throttle`, `ops_diagnostics`, `media_assets`, `settings`, `sms_templates`, `audit_logs`.

`customers` is the shopper account table (the brief's `users`) so it does not collide with a future Better Auth `user` table. Coupons cover the brief's discounts table so there is one source of truth.

Opening stock is an `inventory_logs` row with reason `opening_balance`. No orders are seeded. Approved reviews are shown only after a person writes one. No public average. No admin password is seeded.

Order status values: `awaiting_payment`, `paid`, `processing`, `ready_to_ship`, `shipped`, `delivered`, `cancelled`, `returned`, `refunded`, `partially_refunded`, `expired`. `paid` is written only by a verified capture. Payment status is separate (`unpaid`, `verified`, `refund_recorded`, `partial_refund_recorded`). `orders.coupon_id` is the durable coupon link. `coupon_code` is only the snapshot.

## Environment

Do not create or commit a real `.env` file in this workspace. An eventual deployment must securely provide `DATABASE_URL`; provider injection is not verified. The following historical names are illustrative, not an exhaustive list of requirements or a statement that a provider has been selected; consult `.env.example` and `docs/PRODUCTION.md`:

```text
DATABASE_URL=
AUTH_SECRET=
APP_URL=
ZARINPAL_MERCHANT_ID=
ZIBAL_MERCHANT=
IDPAY_API_KEY=
SMS_PROVIDER=
SMS_API_KEY=
SMS_SENDER=
SHAHOO_ADMIN_EMAIL=
SHAHOO_ADMIN_PASSWORD_HASH=
SHAHOO_ADMIN_NAME=
SHAHOO_ADMIN_MOBILE=
SHAHOO_TRUST_PROXY=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

Generate the admin hash outside the repo:

```text
node scripts/hash-admin-password.mjs '<password, at least 10 characters>'
```

The same `scrypt` parameters are in `src/server/auth/crypto.ts`. Do not commit the hash or the password.

The source archive does not include private `.grok/app-env.json`; its `deploy.database` setting cannot be verified from this ZIP. The absent auth flag defaults false, but explicitly confirm the intended `VITE_AUTH_ENABLED=false` in build and runtime and verify the deployed server and build use consistent values.

SMS: a live send needs production, `SMS_LIVE=1`, a provider, and `SMS_API_KEY`. The login code is echoed only when `ECHO_OTP=1`, the process is not production, and SMS is not configured. `npm run dev` sets `ECHO_OTP=1` for local preview. `shouldEchoOtp` stays false in production even if the flag is set.

## Run

Run the local preview through `npm run dev` as appropriate for the environment.  
Schema applies on PGLite startup for development and tests. `npm run build` does not migrate. Postgres migrations run only from `npm run db:migrate`.  
Typecheck: `npx tsc --noEmit`.

A new SQL file is picked up by the PGLite glob when the dev server process starts. Restart the preview after adding a migration; hot reload does not always see a brand-new file.

## Brand

Header uses `shahoo-logo-minimal.png`. Footer and hero use `shahoo-logo-primary.png`. Keep aspect ratio. Do not recolor. WebP masters in the same folder are archives only; they showed extraction artifacts, so they are not referenced by the UI.

## Decisions

1. Beta source was missing, so behavior was recovered from the SSR bundle and reimplemented. Routes were kept.
2. Fake commercial data was dropped on purpose.
3. Contact and newsletter forms do not store phone numbers. Account creation happens only after a valid OTP. Checkout stores the delivery mobile because a real order needs it.
4. Cart prices are re-read on the server. The browser no longer stores the cart. `quoteCart` remains for callers and now uses the same `isLineSellable` product/variant/category rule as cart mutations. Regression tests cover the shared rule and PGlite query path; this is not PostgreSQL concurrency proof.
5. Nitro marks `@electric-sql/pglite` external so the production bundle can find `pglite.data`.
6. Customer profile and admin mutations call `requireCustomer` or `requireAdmin`, then `writeAudit`. Guest cart edits are allowed without an account because the cart cookie is the credential. `placeOrder` audits the actor it actually has.
7. Admin bootstrap is idempotent and audited. It does not run unless both env values are present and the hash matches `s2$...`.
8. Unpaid orders reserve stock instead of decrementing `on_hand`, so a later payment batch can still capture or release. The 24-hour sweep is lazy, not a cron job, because this runtime has no durable scheduler.
9. Catalog edits do not upload files. A primary image is an https URL on `product_images`. Deactivating a category or unpublishing a product removes it from the shop and from the cart. Stock adjustments cannot land below `reserved`.
10. Coupon `usedCount` is only changed by checkout and by releasing an unpaid hold, and only through `coupon_id`. Shipping methods stay `manual`. Cancel is allowed only from `awaiting_payment` and never writes `paid`.
11. Further decisions for 05.01 are in `DECISIONS.md`. Open backlog is `TASK_BACKLOG.md`.

## Known gaps

There is no connected live payment gateway, SMS provider, carrier API, or object storage. Shipment registration is manual recordkeeping; payment verification is not manually asserted by order tools, and refunds are internal ledger entries only. Checkout and cancel retain their existing stock rules. Guest wishlist state is browser-side; account wishlists use server persistence and the guarded sync design. Homepage sections can be reordered and edited, but there is no drag-and-drop canvas. CMS media registration uses external HTTPS URLs; production file upload/storage is not configured. Open security/commerce and release evidence gaps are summarized in the current status above.

## Exact next task

Stop after delivery for owner review of the Revision 02.1 archive, evidence and blockers. Any subsequent remediation, environment-dependent verification, or Batch 09/provider work requires the appropriate owner authorization. Do not call Zarinpal, Zibal, PayPing, SMS.ir, or a carrier, and do not invent credentials or a storage bucket.


## Batch 08 original review (historical snapshot, 2026-11-19; superseded)

The figures, release gaps and dependency findings below describe the original Batch 08 review, before Revisions 01 and 02; they are not current. See the Revision 02.1 status above and `BATCH_08_FINAL_RELEASE_EVIDENCE.md` for the current release gate and fresh rerun evidence.

Batch 08 comprehensive audit is complete from `SHAHOO-v1.0.0-batch07-revision01.zip` (source SHA-256 `9e9ec41fb296bb587d6431ae98af95ff1b27652b93926d00f22bb5e3c1b3c918`). Dependencies installed from the lockfile. TypeScript passed; ESLint passed with five warnings; application tests passed 214/214; migration-aware PGlite/integration tests passed 90/90; production build passed; and the new quoteCart sellability regression suite passed 7/7.

A confirmed quoteCart consistency defect was fixed: quoteCart now uses the shared sellability rule and rejects unpublished/deleted products, inactive/deleted categories, and inactive/deleted variants. Cart lookup also rejects soft-deleted variants. An explicit postal-code accessible name was added.

The final decision is **NOT READY FOR RELEASE**. Real PostgreSQL fresh/upgrade/concurrency testing, backup/restore, browser/mobile/accessibility runtime checks, target-host verification, and deployment verification of `VITE_AUTH_ENABLED=false` were not executable in this environment. `npm audit` reported 10 findings including one critical Better Auth advisory. The configured platform script group remains 206/215 passed, 9 failed because private `.grok` harness inputs are absent and one upload assertion is obsolete for the supported HTTPS-only media-registration design.

Deliverable: `SHAHOO-v1.0.0-batch08-review.zip`. Batch 09 SMS.ir and PayPing remains pending and was not started. No production deployment or owner approval is claimed. See `BATCH_08_REPORT.md` for exact evidence and the deployment checklist.

## Batch 09 implementation handoff — 2026-11-19

The owner authorized Batch 09 on the supplied Revision 02.1 source. SMS.ir's official Verify request adapter and isolated PayPing v3 payment/verification HTTP primitives are implemented, with deterministic mocks. This is not a complete gateway lifecycle: there is no order payment-start endpoint, PayPing callback handler, persisted PayPing attempt, settlement bridge or reconciliation workflow. **Keep PayPing live disabled.** The blocker is the previously identified case where provider verification succeeds but stock recovery/local order settlement fails; current `captureVerifiedPayment` starts and verifies in one invocation and does not durably preserve external verification before settlement. Do not wire PayPing into it. The SMS provider implementation has no live provider test; merchant template configuration must be confirmed.

Preflight checks reconfirmed Revision 02.1 auth exact-flag, soft-deleted variant, exact OTP challenge redemption and seed collision fixes; the previously hardcoded shared preview credential is absent. The older-unconsumed OTP challenge policy remains unresolved. No migration or new database schema was added, and no real secrets, provider operations, PostgreSQL service or deployment were used. Current modified files, official documentation citations, verification commands/results and the exact no-go decision are in `BATCH_09_IMPLEMENTATION_REPORT.md`. Stop for independent review. Do not deploy, enable live integrations, send SMS, make payments or start a further batch.

## Batch 09 remediation handoff — 2026-11-19

Continue from Batch 08 Revision 02.1 with Batch 09 remediation as the current stage. Apply migration `0013_batch_09_payment_attempts.sql` only on an authorized disposable or staging PostgreSQL database. PayPing is integrated in source but must remain disabled until amount-unit confirmation, provider sandbox evidence, and PostgreSQL concurrency verification are complete. The callback is `POST /api/payment/payping/callback`; initiation and settlement retry are server functions. No real SMS, payment, production credentials, or deployment was used.
