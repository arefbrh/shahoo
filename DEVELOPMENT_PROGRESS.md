> **Historical document — not current instructions.** This file preserves earlier planning, review guidance, or test snapshots. Some dates, statuses, commands, and next-step instructions may be superseded. For the authoritative current state and roadmap, start with [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), then [REMAINING_ISSUES.md](REMAINING_ISSUES.md) and [BATCH_09_COMPREHENSIVE_AUDIT.md](BATCH_09_COMPREHENSIVE_AUDIT.md). See [docs/README.md](docs/README.md) for the document map.

---

# DEVELOPMENT PROGRESS

Current version: **v1.0.0**  
Batch: **stable release inside the current shop. Not a live-payment release.**  
Resume rule: do not connect a gateway, a live SMS provider, a carrier, or object storage until the owner supplies real credentials and says to turn them on.

## Completed stages

| Stage | Status |
| --- | --- |
| 1. Codebase audit | COMPLETED |
| 2. Architecture split and storefront on server data | COMPLETED |
| 3. PostgreSQL schema, Drizzle models, migration, seed | COMPLETED |
| Checkpoint 01 archive and docs | COMPLETED |
| 4. Customer mobile OTP and HttpOnly session | COMPLETED |
| 5. Admin session against an out-of-band password hash | COMPLETED |
| 6. Server authorization and audit logs on sensitive actions | COMPLETED |
| Checkpoint 02 | COMPLETED |
| 7. Postgres cart for guests and signed-in customers | COMPLETED |
| 8. Unpaid order placement with server prices, coupons, shipping, stock hold | COMPLETED |
| 9. Order visibility for the buyer and the admin read role | COMPLETED |
| Checkpoint 03 | COMPLETED |
| 10. Admin categories and products | COMPLETED |
| 11. Packaging variants, toman prices, https image URL | COMPLETED |
| 12. Inventory adjustments that cannot pass reserved stock | COMPLETED |
| Checkpoint 04 | COMPLETED |
| 13. Admin coupons, percent or toman, without touching used count | COMPLETED |
| 14. Manual shipping methods, toman price and free-shipping threshold | COMPLETED |
| 15. Cancel an unpaid order and release its reserved stock | COMPLETED |
| Checkpoint 05 | COMPLETED |
| 05.01 security: throttle, Tehran dates, coupon id, transactional audit, reservation abort | COMPLETED |
| 05.01 admin desk: orders, customers, inventory, reports, staff | COMPLETED |
| Checkpoint 05.01 | COMPLETED |
| 05.02 login failure windows, atomic throttle, expired-row cleanup | COMPLETED |
| 05.02 last active super admin under concurrent staff changes | COMPLETED |
| 05.02 migration 0004 fresh and v0.5.0 upgrade tests, plus 0005 ambiguous coupon repair | COMPLETED |
| Checkpoint 05.02 | COMPLETED |
| 06. Homepage sections, banners, menus, pages, articles | COMPLETED |
| 06. External https media registry, no object storage | COMPLETED |
| Checkpoint 06 | COMPLETED |
| 19. Homepage and menus on the official identity | COMPLETED |
| 20. Catalog, product, cart, and checkout surfaces | COMPLETED |
| 21. Account, honest order track, mobile menu, footer | COMPLETED |
| Checkpoint 07 | COMPLETED |
| 22. Titles, canonical, sitemap, robots, JSON-LD | COMPLETED |
| 23. Security, commerce, and SEO tests that were actually run | COMPLETED |
| 24. Production notes and backup duty | COMPLETED |
| Checkpoint 08 | COMPLETED |
| 25. Address book, account wishlist, reviews, support | COMPLETED |
| 26. Order statuses, manual shipping, return ledger | COMPLETED |
| 27. Local media upload, internal notices, OTP limits, security headers | COMPLETED |
| 28. Payment and SMS provider seams, without a live call | COMPLETED |
| Checkpoint 09 | COMPLETED |
| 29. Bounded upload, return state machine, one primary image, production storage gate | COMPLETED |
| 30. English name, media picker, banner images, section body, ticket history | COMPLETED |
| Checkpoint 09.2 | COMPLETED |

## Feature status

| Feature | Status |
| --- | --- |
| Official SHAHOO logos on header, footer, and hero | COMPLETED |
| Catalog, variants, stock, articles, pages in Postgres | COMPLETED |
| Homepage sections and navigation read from the database | COMPLETED |
| Product variant price and stock on the product page | COMPLETED |
| Postgres cart, guest cookie or customer account, server prices | COMPLETED |
| Wishlist in the browser only | COMPLETED on the account; guests stay in the browser until login |
| Customer mobile OTP, session, and name | COMPLETED |
| Admin login, durable throttle, and role check | COMPLETED |
| Unpaid orders, coupon id, shipping quote, 24-hour stock hold | COMPLETED |
| Customer order list and receipt-cookie order page | COMPLETED |
| Admin order search, filters, and unpaid cancel | COMPLETED |
| Admin category and product editor | COMPLETED |
| Packaging variants (volume, weight, custom) with one default | COMPLETED |
| Primary product image by https URL or an uploaded `/media/file` image | COMPLETED |
| Inventory adjustment with a written reason | COMPLETED |
| Admin coupons on Asia/Tehran dates | COMPLETED |
| Admin shipping prices, still manual, no carrier API | COMPLETED |
| Cancel unpaid order without clamping reserved stock | COMPLETED |
| Admin customers, reports, and staff roles | COMPLETED |
| Iranian gateways (Zarinpal, Zibal, IDPay) | WAITING FOR EXTERNAL CREDENTIALS — adapters throw and do not fetch |
| SMS OTP and order messages | WAITING FOR EXTERNAL CREDENTIALS — live send stays off |
| Object storage for the media library | WAITING FOR EXTERNAL CREDENTIALS — development uses local disk only |
| Homepage drag-and-drop builder | NOT IMPLEMENTED (order is edited with buttons) |
| Content desk for sections, banners, menus, pages, articles | COMPLETED |
| Local image upload and https media registry | COMPLETED |
| Carrier tracking APIs | NOT IMPLEMENTED — manual carrier and tracking code only |
| Customer address book | COMPLETED |
| Product reviews, pending until approval | COMPLETED — no seeded reviews, no public average |
| Support tickets | COMPLETED |
| Return and refund ledger | COMPLETED — no gateway refund |
| Production SEO pack (sitemap, JSON-LD) | COMPLETED |
| Sample orders, fake reviews, demo passwords | NOT IMPLEMENTED (intentionally omitted) |

## Files created

- `INITIAL_PROJECT_AUDIT.md`, `DEVELOPMENT_PROGRESS.md`, `PROJECT_HANDOVER.md`, `CHANGELOG.md`, `TEST_REPORT.md`
- `BATCH_05_01_AUDIT.md`, `BATCH_05_01_SECURITY_REPORT.md`, `BATCH_05_01_ADMIN_GUIDE.md`, `BATCH_05_01_DATABASE_CHANGES.md`, `DECISIONS.md`, `TASK_BACKLOG.md`
- `migrations/0002_shahoo_foundation.sql`, `migrations/0003_commerce_cart.sql`, `migrations/0004_batch_0501.sql`, `migrations/0005_batch_0502.sql`
- `src/server/db/schema.ts`, `client.ts`, `seed.ts`, `seed-data.ts`
- `src/server/storefront/api.ts`, `report.ts`
- `src/server/auth/*` OTP, sessions, guards, SMS adapter, admin bootstrap
- `src/server/commerce/*` cart, checkout, holds, order reads, pricing
- `src/server/catalog/*` category, product, and inventory mutations
- `src/server/offers/*` coupons, shipping methods, unpaid-order cancel
- `src/lib/catalog-rules.ts`, `src/lib/offer-rules.ts`, `src/lib/tehran-time.ts`, `src/lib/login-throttle.ts`, `src/lib/stock-release.ts`
- `src/server/admin/*` desk queries and server functions
- `src/server/cms/*` content desk writes and server functions
- `src/lib/cms-rules.ts`, `src/lib/cms-types.ts`
- `MASTER_PROMPT.md`, `BATCH_07_DESIGN_REPORT.md`, `BATCH_08_PRODUCTION_REPORT.md`, `docs/PRODUCTION.md`
- `src/routes/*` storefront routes, `src/router.tsx`, `src/styles.css`
- `src/components/site/*`
- `public/assets/brand/*` official rasters
- `scripts/hash-admin-password.mjs`
- `startup.sh`

## Files changed

- `package.json` / `package-lock.json` — `drizzle-orm`, Vazirmatn, Cinzel, catalog and offer rules in `npm test`
- `.grok/app-env.json` — `deploy.database: true`, auth remains off
- `vite.config.ts` — keep PGLite external in the Nitro bundle so `pglite.data` resolves

## Database

- Migration `0002_shahoo_foundation.sql`, `0003_commerce_cart.sql`, and `0004_batch_0501.sql` apply on preview startup. `0004` adds `auth_throttle`, `ops_diagnostics`, `orders.coupon_id`, and four permissions. `0002` and `0003` were not edited.
- As of Batch 01, `npm run build` does not migrate. Postgres migrations run only from `npm run db:migrate`.
- Seed key `foundation.seed` version 1. Re-running does not duplicate rows.
- Money unit: IRR integer. UI toman = trunc(IRR / 10). The editor accepts whole toman and stores rials.
- No admin user is seeded. Bootstrap reads `SHAHOO_ADMIN_EMAIL` and `SHAHOO_ADMIN_PASSWORD_HASH` (`s2$salt$hash` from `scripts/hash-admin-password.mjs`) at runtime and never writes the hash into source.
- Sellable quantity is `on_hand - reserved`. An unpaid order increases `reserved` for 24 hours, then a lazy sweep releases it and marks the order `expired`. `on_hand` is not reduced until a later paid-capture batch.
- An inventory adjustment is a separate `inventory_logs` row with reason `adjustment`. The update is refused when `on_hand + delta` would be negative or below `reserved`.
- Cancelling an `awaiting_payment` order sets `cancelled`, returns reserved units, and returns one coupon use by `coupon_id`. It does not change `on_hand` and does not insert a payment. If `reserved` is already short, the status change rolls back and `ops_diagnostics` records it.
- `orders.idempotency_key` stops a double submit from reserving stock twice. `buyer_key` is `c:<customer>` or `g:<cart>` so another browser cannot replay that key.

## APIs created

Server functions in `src/server/storefront/api.ts`:

- `getShell`, `getHome`, `listCatalog`, `getProduct`, `getPage`, `listArticles`, `getArticle`, `quoteCart`, `listOilProducts`

`loadFoundationReport` is a plain server helper, not a public function. It is called only after an admin session with `reports.read`.

Server functions in `src/server/auth/api.ts`:

- `getCustomerAccount`, `requestCustomerOtpFn`, `verifyCustomerOtpFn`, `logoutCustomerFn`, `updateCustomerNameFn`
- `getAdminSession`, `loginAdminFn`, `logoutAdminFn`

Server functions in `src/server/commerce/api.ts`:

- `getCart`, `addCartItemFn`, `setCartItemFn`, `adoptLocalCartFn`
- `getCheckoutContext`, `quoteCheckoutFn`, `placeOrderFn`, `getOrderFn`

Server functions in `src/server/catalog/api.ts`:

- `getAdminCatalog` requires `catalog.read`
- `saveCategoryFn` and `saveProductFn` require `catalog.write`. Opening stock above zero also requires `inventory.write`
- `adjustInventoryFn` requires `inventory.write`

Server functions in `src/server/offers/api.ts`:

- `getOfferDesk` requires `settings.read` or `settings.write`. `saveCouponFn` and `saveShippingFn` require `settings.write`
- `cancelUnpaidOrderFn` requires `orders.write` and only accepts `awaiting_payment`

Server functions in `src/server/admin/api.ts`:

- `getDashboardFn`, `listAdminOrdersFn`, `listCustomersFn`, `getCustomerFn`, `setCustomerStatusFn`
- `getInventoryDeskFn`, `getReportsFn`, `getStaffFn`, `setAdminAccessFn`

Server functions in `src/server/cms/api.ts` require `content.write`:

- `getCmsDesk`, `saveSiteCopyFn`, `saveSectionFn`, `saveSectionOrderFn`, `saveBannerFn`, `saveBannerOrderFn`
- `saveNavFn`, `saveNavOrderFn`, `savePageFn`, `saveArticleFn`, `retireArticleFn`, `registerMediaFn`, `retireMediaFn`

No payment API. `placeOrderFn` never inserts a `payments` row. No file upload and no object-storage call.

## External services

None connected. Kavenegar is called only when `SMS_PROVIDER=kavenegar` and `SMS_API_KEY` are both set. Otherwise production refuses the code, and the non-production preview echoes it once on the account page.

## Tests run

See `TEST_REPORT.md`. Do not treat unlisted checks as passed.

## Known issues

- Wishlist is still only in the browser.
- Products without an https image still use the typographic panel. The media desk registers an https URL; it does not upload a file or attach it to a product by itself.
- Supplied WebP logos contain extraction artifacts. The site uses the transparent PNGs.
- Share card uses the official primary logo on `public/og.jpg`. Logo masters in `public/assets/brand` were not redrawn.
- Real SMS and payment credentials are still absent. Checkout records an unpaid order and says so. It does not pretend a payment succeeded.
- A guest order is attached to an account only when the same browser still has the receipt cookie and the account mobile matches the order mobile.
- Abandoned unpaid orders keep stock reserved until the 24-hour sweep runs on the next cart or order read.
- A missing product route still uses the generic not-found page.
- Existing packages cannot be deleted from the editor. They can be deactivated so old order lines keep their variant.

## Next stage (do not start until named)

Do not call Zarinpal, Zibal, or IDPay, and do not invent merchant credentials or a storage bucket. Gateway capture, stock decrement of `on_hand` on payment, refunds, SMS, and file upload stay blocked.

