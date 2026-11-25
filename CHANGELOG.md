## 2026-11-25 — Self-hosted integration and repository documentation

- Merged the audited self-hosted candidate, including server and worker support, Linux and Windows recovery, CMS and order changes, into `main` at `c282747`. [PR #11](https://github.com/shahoo-workspace/shahoo/pull/11)
- Recorded the pre-merge CI evidence, Preview verification and remaining release gates. [Test report](TEST_REPORT.md) · [Milestone](https://github.com/shahoo-workspace/shahoo/milestone/1)
- Added a repository overview, contributor guide, and issue and PR templates. [README](README.md) · [Contributing](CONTRIBUTING.md)
- Prepared additional migration tests in draft PR #12. Execution is deferred at the owner's request. [PR #12](https://github.com/shahoo-workspace/shahoo/pull/12)

## 2026-11-20 — Repository documentation consolidation

- PR #2 added the canonical `PROJECT_HANDOFF.md` and was merged after all required GitHub CI jobs completed successfully (merge commit `299b85a7aa1b76d05bd03594915b888d7d469ca9`).
- A cleanup branch now updates `AGENTS.md` to make the canonical handoff the first read, adds `docs/README.md` as the documentation map, and labels stale batch snapshots as historical rather than current instructions.
- Historical batch reports, test records, and decisions are retained; no unique evidence, tests, migrations, application source, or data were deleted in this documentation-only cleanup.
- The cleanup branch is not merged yet; its CI and PR review remain pending.

## 2026-11-20 — Batch 09 independent remediation pass

- PayPing verification HTTP errors, malformed success payloads, and identity mismatches remain recoverable; the code no longer treats generic HTTP 4xx as proof that no payment occurred.
- Admin order details now expose authorized same-attempt verification/settlement recovery actions. `manual_review` can be retried without creating a new payment attempt.
- Guest checkout and OTP verification gained durable cross-request rate buckets.
- Expired unpaid inventory holds can be released by a scheduled Node task; the process examines bounded batches and does not let inconsistent rows starve later orders within one run.
- PostgreSQL raw SQL and Drizzle share one process-wide pool.
- Windows VPS build/start commands and a cross-platform Node test runner were added.
- WebP uploads are temporarily disabled until a maintained decoder/encoder can be installed; chunk-only validation is no longer accepted.
- These source changes have not passed typecheck/lint/build/tests in the current environment because `npm ci` could not complete (registry timeout; missing offline `zustand@5.0.15`). External PostgreSQL, provider, Windows VPS, MFA, browser E2E, and backup/restore gates remain open.

<!-- BATCH 08 REVISION 02.1 CURRENT STATUS -->
# Current change notice — Batch 08 Revision 02.1

- Revision 02 is the latest completed remediation; 02.1 reconciles current documentation, preserves the old issue register as historical, and records release blockers without changing application source as part of this documentation update.
- [REMAINING_ISSUES.md](REMAINING_ISSUES.md) distinguishes resolved quote/cart and prior dependency findings from actual open issues and unverified deployment checks. [BATCH_08_FINAL_RELEASE_EVIDENCE.md](BATCH_08_FINAL_RELEASE_EVIDENCE.md) records actual 02.1 test/audit results; Revision 02 numbers are previous evidence only.
- Decision remains **NOT READY FOR RELEASE**. Final approval has not been granted. Batch 09 has not started; no provider integration or production hosting is authorized.

**Historical content notice:** Entries below are historical batch/version records, not current approval, security, test or roadmap status. Conflicting current-status claims are superseded by this 02.1 notice and the linked current documents.

---

# Changelog

## Batch 04 correction — 2026-11-19 (Production homepage initialization)

- Added ordered migration `0010_batch_04_home_sections.sql` to provision only missing approved homepage product-section types, independent of Demo Seed and without overwriting existing CMS rows.
- Fresh sections use stable IDs and the approved Persian copy; missing types append after existing order. No fake products, product associations, banners, orders, customers or business details are added.
- The homepage keeps section content CMS/database-driven and now shows a Persian empty-product state when a section's existing dynamic selection is empty.
- Focused in-memory PGlite, frontend source, CMS rules and migration-order checks passed. Production PostgreSQL, full typecheck/lint/suite/build, browser and responsive/accessibility checks remain deferred to Batch 08. See `BATCH_04_CORRECTION_REPORT.md`.

## Batch 04 — 2026-11-19 (owner review; source-level implementation)

- Added an accessible server-backed header cart drawer, Persian error/recovery notices, persisted uncertain-write intents and shared same-tab write guards; the standalone cart remains available.
- Bound checkout submission to the server-reviewed cart lines/prices and current account, hiding prior-session address/order details until identity verification. This is not payment processing.
- Removed the legacy featured section from public rendering without deleting its CMS record; added copy updates only for recognized untouched seed content and preserved editor-owned copy.
- Added a three-indicator grouped carousel, manual navigation, reduced-motion/interaction pauses, limited image loads and CMS banner alt-text mapping. Applied restrained gold focus/active/hover treatments.
- Added ordered migration `0009_batch_04_home_copy.sql`, page route manifest, Batch 04 implementation report and Batch 09 payment/SMS source-only preparation. No new provider call, real credential, schema for future gateways or dependency.
- Full typecheck, lint, complete suites, build, database, browser, responsive/accessibility and real cart/CMS integration verification remain deferred to Batch 08. See `BATCH_04_REPORT.md`.

## Batch 03 correction — 2026-11-18

- Guest wishlist is no longer cleared on login unless the server confirms the merge; failures keep it, show a Persian retry notice on /account, and retries are safe.
- Wishlist reads can no longer overwrite a newer customer action.
- Logout keeps unmigrated guest data as the guest list; another customer's list is never merged.
- Documentation: master context status, file inventory, portable `AGENTS.md`, Batch 08 report marked historical.

## Batch 03 — 2026-11-18 (frontend reliability, not approved)

- Wishlist is tagged by owner and isolated per session; logout and login-as-another clear it; failed toggles change nothing.
- Cart, address book, order actions, reviews and admin media upload: single-flight actions, disabled buttons while pending, Persian failure messages with retry, success only after the server confirms.
- Persian not-found and error screens; raw errors are never shown to customers.
- Accessibility: skip link, Escape closes the menu, labels, visible focus ring, alt text.
- No migration, dependency or schema change. Homepage, hero, cart drawer unchanged.

## v1.0.0 — stable shop inside the current boundary

- Production CSP allows `frame-ancestors 'self'` only. Development still allows the Grok preview hosts so the live shell can embed the shop. Production `script-src` and `connect-src` do not include Grok, and `unsafe-eval` is absent. `unsafe-inline` stays in `script-src` and `style-src` because TanStack Start emits an inline bootstrap and the pages use inline style attributes. A nonce would need a framework SSR change, so it is not pretended here.
- Responses send `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment, and USB disabled), and HSTS only on HTTPS.
- The return desk reloads from the server after approve, reject, receipt, or a ledger refund. The action response itself carries the new status, order status, and event history, so the row updates even if the follow-up list read fails. A failed action keeps the previous list and shows the server message. A second click is ignored while one action is in flight.
- JPEG uploads are decoded and encoded again with `jpeg-js` (BSD-3-Clause). Marker metadata and bytes after the end marker are not stored. PNG uploads are inflated, unfiltered to pixels, and compressed again. GIF frames are LZW-decoded; the parsed animation is kept because a second GIF encoder would drop animation. WebP is chunk-checked and trimmed, not pixel-decoded. Broken, interlaced PNG, and non-image files are refused. The server still names the file. A failed insert removes the disk object.
- The admin dashboard and reports sum verified ledger payments and recorded refunds in toman. That figure is not a bank settlement. With no verified payment row, confirmed revenue stays zero.
- `PAYMENT_PROVIDER=mock` does not resolve in production. Local disk stays off in production unless `ALLOW_LOCAL_STORAGE=true`. No cloud bucket was added.
- No new SQL file. `0002` through `0007` are unchanged.

## v0.9.2 — upload safety, return states, and the desks that were still thin

- Media upload checks the admin session before reading the body, stops when the real byte count passes the cap, and still accepts only sniffed JPEG, PNG, GIF, or WebP under a server-generated name.
- A return request can move only along requested → reviewing or approved or rejected, then approved → received. Rejected and received stay put. The row is locked. Receiving goods does not restock and does not call a bank. A second open return for the same order is refused.
- Attaching a product image is one transaction. The product row is locked, and the database allows only one primary image.
- Production no longer treats local disk as the default store. `ALLOW_LOCAL_STORAGE=true` is required there. Development is unchanged. No cloud bucket was added.
- The product form can edit the English name, deactivate a saved package instead of deleting it, and pick a primary or gallery image from the media library.
- Banner forms store desktop and mobile media ids. A new banner form clears after a successful save. Homepage section body can be edited and is shown on the public page.
- Support tickets show the full thread, sender, and time for the customer and the admin. Another customer still cannot read the thread.
- Production CSP drops `unsafe-eval` and `grok.com` from script and connect. `unsafe-inline` stays because the framework emits an inline bootstrap. The preview frame-ancestors stay so the shop can still be embedded. The Grok PWA head injector stays; it writes the production Open Graph tags and does not leave the public pages without them.

## v0.9.1 — paid-order settlement and archive cleanup

- Cancelling a paid order no longer returns stock while leaving the payment marked verified. Unpaid cancellation still releases the hold once. A paid order closes only through an internal refund ledger. No bank is called.
- Refund totals are calculated inside the locked order transaction. A second concurrent refund cannot pass the order total, and the same return cannot be recorded twice.
- Manual buttons no longer jump an order to `paid`, `refunded`, or `partially_refunded`.
- A mock SMS provider cannot report success in production.
- Unreferenced logo archives under `attachments/` were removed. Migrations, brand files used by the shop, and platform files stayed.

## v0.9.0 — store completion


- Customer address book: list, add, edit, delete, default, and checkout selection. Ownership is checked on the server.
- Wishlists live on the account. A guest list stays in the browser until login, then merges. Inactive products stay visible as unavailable.
- Product reviews can be submitted by a signed-in customer, stay pending until an admin approves them, and are not seeded. There is still no public average and no `aggregateRating`.
- Support tickets have categories, a customer inbox, and an admin reply desk. Statuses are open, reviewing, and closed.
- Order status and payment status are separate. `paid` is set only by a verified capture. Manual moves reject illegal steps. Stock is captured once.
- Manual shipping can record a carrier, a tracking code, a handoff time, and a note. No carrier API is called.
- Returns and refunds are a ledger. Full and partial amounts are checked. No gateway refund is sent.
- Admins can upload JPEG, PNG, GIF, or WebP up to 4 MB. Names are random. Executables and path traversal are refused. A referenced file is not deleted. The storage interface is local disk in development. No cloud credentials were added.
- Internal notices record order, shipping, return, and support events. OTP text is not stored.
- OTP send limits for the mobile and the IP are rows locked in the database.
- Security headers are `nosniff`, a referrer policy, HSTS only on HTTPS, and a CSP that still allows the preview frame and `https://grok.com`.
- Payment and SMS providers are interfaces plus disconnected adapters. Live SMS needs production, `SMS_LIVE=1`, a provider, and a key. Checkout still does not call a gateway.
- Share-card tests keep the real title «شاهو SHAHOO». Fixture cases no longer read that title by accident.

## v0.8.0 — Batch 08 SEO and production notes

- Public pages get a canonical URL when the request host or `APP_URL` is a real origin. No host is invented.
- `/sitemap.xml` lists published pages, products, and articles. `/robots.txt` hides the desk, account, cart, checkout, orders, search, and wishlist.
- Organization, product, article, page, and breadcrumb JSON-LD are emitted. There is no star rating and no review. Structured prices are IRR.
- Remote product images lazy-load. The official hero logo is unchanged.
- `docs/PRODUCTION.md` records environment names, what stays off without credentials, and that database backup belongs to the host. No payment call was added.

## v0.7.0 — Batch 07 storefront design

- Homepage, menus, catalog, product, cart, checkout, account, order tracking, and footer were restyled on the official forest, gold, and cream palette. Routes and server prices did not change.
- The header marks the current menu item and the phone menu uses larger rows. The hero image is still the official primary logo.
- Order tracking shows only a registered hold and an unpaid or closed state. It does not claim shipment or delivery. The footer does not invent an e-trust badge.
- `MASTER_PROMPT.md` stores the owner batch contract for later checkpoints. No payment, SMS, upload, or new migration.

## v0.6.0 — Batch 06 content desk and external media

- `/admin/content` edits homepage sections, hero slides, header and footer links, existing pages, magazine articles, the store story, and the top promo. It requires `content.write`.
- Section, banner, and menu order is a full permutation under a row lock. The last active homepage section and the last active link in a menu cannot be removed.
- Hero slides can carry a Tehran date window. The hero image remains the official primary logo.
- Media is an https image address plus alt text. Files are not uploaded. Official brand files cannot be deleted, and a media row that is still referenced cannot be retired.
- Page slugs stay fixed. A new article uses the existing magazine route. Sensitive writes and their audits commit together.
- No payment, SMS, carrier, or object-storage call was added. Migrations `0002` through `0005` were not edited.

## v0.5.2 — Batch 05.02 throttle windows and last super admin

- Admin login failures now expire. An account allows 5 failures inside 15 minutes, then a 15-minute lock. An address allows 20 failures inside 30 minutes, then a 30-minute lock. An active lock is not cleared just because the window is old.
- A successful login deletes that account's failure row. It does not clear a live IP bucket or an IP lock.
- Failure counters are updated under a row lock, so overlapping attempts cannot overwrite each other. The failure audit is written in that same transaction.
- Expired throttle rows are deleted on the server during login. Open windows and active locks stay. There is still no cron; a deploy job may call the same cleanup.
- `SHAHOO_TRUST_PROXY` must stay unset unless the reverse proxy replaces `X-Forwarded-For`. A client-supplied value is otherwise ignored.
- Staff changes lock the super-admin role row. The last active super admin cannot be demoted or disabled, including when two such requests run together. The audit stays in the same transaction.
- Migration `0005_batch_0502.sql` clears a coupon link when more than one coupon matches the stored code by case, and fills a null id only when the match is unique. `0004` was not edited.

## v0.5.1 — Batch 05.01 security and admin foundation

- Admin login is throttled in Postgres (`auth_throttle`), by account and, when `SHAHOO_TRUST_PROXY=1`, by the forwarded client IP. Five account failures lock the identifier for 15 minutes. Twenty IP failures lock for 30 minutes. The failure message is the same for unknown accounts. Audit rows stop after the first failures and one lock event.
- Coupon dates are Asia/Tehran civil days: start at 00:00:00 and end through 23:59:59. Display no longer uses `toISOString().slice(0, 10)`.
- Orders store `coupon_id` plus the code snapshot. Cancel and expiry return the use by that id, not by whatever coupon currently wears the old code.
- Catalog, inventory, coupon, shipping, checkout, cancel, and hold-release audits commit in the same transaction as the change.
- Releasing a reservation aborts when `reserved` is smaller than the line quantity. The order status stays put and an `ops_diagnostics` row is written. Reserved stock is not clamped to zero.
- `/admin` is a sidebar desk: overview, orders, customers, catalog, inventory, offers, reports, and staff. Counts come from the database. Confirmed revenue stays at zero until a verified payment exists. The last active super admin cannot be removed.

## v0.5.0 — Batch 05 coupons, shipping, unpaid cancel


- An admin with `settings.write` can create and edit coupons. A code is a percent or a toman amount, not both. The used count is visible and cannot be typed in.
- The same role can edit shipping methods: title, toman price, free-shipping threshold, order, and whether checkout offers it. New methods stay `manual`. No carrier API is called.
- An admin with `orders.write` can cancel an order that is still `awaiting_payment`. Reserved stock is released, the coupon use is returned, and the status becomes `cancelled`. `on_hand` is not reduced. No `payments` row is written. Paid, refunded, and shipped states are not available.
- Checkout quotes use the saved coupon and shipping price. A cancelled order still says that no gateway was called.

## v0.4.0 — Batch 04 catalog desk

- An admin with `catalog.read` sees categories and products. `catalog.write` saves them. `inventory.write` adjusts stock. The super-admin role already has all three.
- Categories can be created, renamed, and turned off for the shop. An inactive category disappears from the catalog, the product page, the cart, and checkout.
- A product is a draft until it is published. Publishing requires at least one active package. Exactly one package is the default, and an active package wins that role.
- Packages are volume (ml), weight (g), or custom. Prices are typed in whole toman and stored as integer rials. A previous price must be higher than the selling price.
- The primary picture is an https URL only. There is no file upload and no object storage. Empty URL removes the picture and the botanical panel returns.
- Existing packages stay on the product. The editor can deactivate them. It does not delete them.
- Opening stock on a new package writes an `opening_balance` log when the admin also has `inventory.write`. Later changes are `adjustment` logs with a note and the admin id.
- A stock change is rejected when the result would be negative or below units already reserved by unpaid orders. `on_hand` is still not reduced by checkout.
- Catalog saves and stock changes are audited. No payment gateway, SMS send, or homepage builder was added.

## v0.3.0 — Batch 03 cart and unpaid orders

- The cart lives in Postgres. A guest is bound to an HttpOnly `shahoo_cart` cookie. Signing in merges that cart into the customer cart. The old browser cart is imported once and then removed.
- Prices, stock, and line totals are read on the server. Sellable stock is on-hand minus reserved. The shopper cannot raise a line above stock or 20.
- Checkout creates an order with status `awaiting_payment`. Shipping and coupons are priced on the server. SHAHOO10 and ORGANIC20 are the seeded codes, not a fake success screen.
- Placing an order reserves stock for 24 hours and writes an inventory log. It does not insert a payment, does not call Zarinpal, Zibal, or IDPay, and does not show a paid state.
- A repeated submit with the same idempotency key returns the same order for the same buyer and does not reserve stock again.
- The buyer can reopen the order from an HttpOnly receipt cookie. A signed-in customer sees their orders on the account page. An admin with `orders.read` can read recent orders. Anyone else gets an unavailable page, even if they know the code.
- When the hold expires, the next cart or order read releases reserved stock, returns the coupon use, and marks the order `expired`.
- Sensitive order actions are audited with the public code and a masked mobile. The address is not copied into the audit log.

## v0.2.0 — Batch 02 sessions

- Customer sign-in uses a mobile one-time code. The code is stored only as a salted hash, expires in two minutes, and locks after five attempts. Requests are limited to one a minute and five in fifteen minutes.
- A successful code opens an HttpOnly customer session. The browser script cannot read the cookie.
- Until `SMS_PROVIDER` and `SMS_API_KEY` are set, production does not issue a code. The internal preview shows the code on the account page and does not pretend an SMS was sent.
- Admin sign-in is separate. No password or password hash is committed. An admin is created only when `SHAHOO_ADMIN_EMAIL` and `SHAHOO_ADMIN_PASSWORD_HASH` are supplied outside the repository.
- `/admin` no longer shows stock or order counts to anonymous visitors. Signed-in roles need `reports.read` to see the foundation report and the audit list.
- Sensitive actions write `audit_logs`: OTP request and rejection, customer login, logout, and name change, admin login, logout, failure, and bootstrap. Metadata stores a masked mobile or email, never a code, password, or session token.
- Future mutations are expected to call `requireCustomer` or `requireAdmin` and `writeAudit`. Platform `VITE_AUTH_ENABLED` stays off. `src/lib/auth/server.ts` was not rewritten.
- Payments, checkout, and carrier APIs were not started.

## v0.1.0 — Batch 01 foundation

- Audited the supplied SHAHOO beta. It is a Nitro build with a `localStorage` store, not a database.
- Rebuilt the store on the workspace TanStack Start app without deleting platform files (`src/lib`, `server/`, `scripts/grok-pwa-*`, `public/__grok`).
- Added Drizzle ORM on top of the platform Postgres helper (Neon when `DATABASE_URL` is set, PGLite in preview).
- Added `migrations/0002_shahoo_foundation.sql` covering catalog, inventory, orders, payments, shipping, CMS, media, coupons, sessions, SMS templates, and audit logs.
- Seeded the beta catalog into the database: categories, products, volume/weight variants, opening stock, articles, pages, homepage sections, menus, banners, coupons, and shipping methods.
- Did not migrate demo customers, plaintext passwords, sample orders, or sample reviews.
- Storefront routes from the beta resolve again and read from the database.
- Official logo PNGs are served from `public/assets/brand/`. The beta's redrawn SVG logo is not used.
- Prices are stored as integer IRR and shown as toman.
- Customer OTP, admin login, checkout placement, and payment gateways are not part of this version.

## v0.0.0 — Workspace before SHAHOO source

- Empty App Builder scaffold. No SHAHOO routes, no app database schema.


## v1.0.0 — Batch 06 product management and dynamic CMS (2026-11-19)

- Extended the existing product admin form for stored product text/SEO/oil-guide/spec fields and retained the current variant, pricing, inventory, status and SKU model; optional product facts are not fabricated.
- Added product gallery selection, primary promotion, safe association removal and audited exact-order changes through the existing normalized media relationships.
- Added owner-created CMS pages at `/pages/{slug}` and a public-only SSR route; preserved fixed route slugs and the existing page table.
- Added article SEO editing/public metadata, cover alt and reading-time display, and a Persian no-published-articles empty state.
- Capped article/media/picker reads to the 100 newest records with search. Existing banners, homepage sections, menus, migration 0010 behavior and Batch 04 carousel were preserved.
- No migration, new permission, storage provider or production deployment was added. See `BATCH_06_REPORT.md` for verification and limitations.
