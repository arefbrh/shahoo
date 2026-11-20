# DECISIONS

Decisions that later batches must not silently reverse. Newer items are at the bottom.

1. The beta was a client store. The rebuild reads Postgres. Storefront routes were kept.
2. Demo customers, plaintext passwords, sample orders, and sample reviews are not seeded.
3. Contact and newsletter forms do not store phone numbers. Account creation happens only after a valid OTP. Checkout stores the delivery mobile because a real order needs it.
4. Cart prices are re-read on the server. `quoteCart` uses sellable stock.
5. `@electric-sql/pglite` stays external in the Nitro bundle so `pglite.data` resolves.
6. Customer and admin mutations call `requireCustomer` or `requireAdmin`, then `writeAudit`. Guest cart edits use the cart cookie as the credential.
7. Admin bootstrap runs only when `SHAHOO_ADMIN_EMAIL` and `SHAHOO_ADMIN_PASSWORD_HASH` are both set outside the repo. The hash form is `s2$salt$hash`. Neither value is committed.
8. Unpaid orders increase `reserved` and do not decrease `on_hand`. The 24-hour sweep is lazy on the next cart or order read. There is no cron in this runtime.
9. A primary product image is an https URL. There is no file upload and no object storage. A stock adjustment cannot land below `reserved`.
10. Coupon `usedCount` changes only at checkout and when an unpaid hold is released. Shipping methods stay `manual`. Cancel is allowed only from `awaiting_payment` and never writes `paid`.
11. Batch 05.01 adds `migrations/0004_batch_0501.sql` and does not edit `0002` or `0003`. SQL wins if Drizzle drifts.
12. Admin login throttling is durable in `auth_throttle`. IP limits apply only when `SHAHOO_TRUST_PROXY=1`. A client-supplied forwarding header is otherwise ignored. Unknown accounts and wrong passwords share one failure message.
13. Coupon calendar days are Asia/Tehran, start inclusive at 00:00:00 and end inclusive through 23:59:59. Display does not use `toISOString().slice(0, 10)`.
14. Orders keep `coupon_id` plus a code snapshot. Restore decrements that id. Renaming a code must not move the counter.
15. Required audits share the transaction with the mutation. If `reserved` is short, the release aborts and a diagnostic is written after the rollback. Reserved stock is not clamped to zero.
16. New permissions are additive. The last active super admin cannot be removed. Staff management does not create passwords.
17. Confirmed revenue counts only payments in `paid`, `verified`, or `captured`. Until a gateway batch exists, the desk says that figure is zero.
18. Platform `VITE_AUTH_ENABLED` stays false. `src/lib/auth/server.ts` is not the Iranian session implementation.
19. Batch 06 (dynamic CMS and media) does not start until the owner says so.
20. Batch 05.02 does not edit `0004`. Account failures live for 15 minutes (5 tries, then a 15-minute lock). IP failures live for 30 minutes (20 tries, then a 30-minute lock). Success deletes only the account bucket. A live IP bucket stays, so one correct password cannot reset a shared address.
21. Throttle writes lock the `auth_throttle` row. Staff writes lock the `super_admin` role row. The last active super admin cannot be removed or disabled. Expired throttle rows are deleted lazily on the server at login. There is no browser timer and no in-memory counter.
22. `SHAHOO_TRUST_PROXY=1` is an explicit deployment switch. Leave it unset unless the reverse proxy overwrites `X-Forwarded-For` and strips the client value. Otherwise the header is ignored.
23. If two coupons differ only by letter case, `0005` leaves `orders.coupon_id` null rather than guessing. A unique case-insensitive match is still stored. The code snapshot is never rewritten.
24. Batch 06 edits content in the tables that already exist. It does not add a migration. Media registration accepts an https image URL only. Object storage is still not configured, so there is no upload and `byte_size` stays 0. Official brand files and `brand.logos` are not replaced. Homepage order uses buttons, not drag-and-drop.
25. Batch 07 is the storefront pass from the owner prompt, not a payment batch. Visual work may not replace official logos, invent shipment states, or invent an e-trust image. `MASTER_PROMPT.md` is the saved brief for later checkpoints.
26. Batch 08 adds sitemap, robots, and JSON-LD. Canonical hosts come from `APP_URL` or the request, never a guessed domain. Structured data has no `aggregateRating`. Offer prices are IRR. Open Graph stays on the platform share card. Payment capture is still not implemented.
27. v0.9.0 completes the store around the existing cart and desk. `paid` is not a button. A verified capture moves `reserved` and `on_hand` once. Refunds are ledger rows and do not call a gateway. Reviews are not seeded and still have no public average. OTP text is not written to `notifications`. Live SMS requires `NODE_ENV=production`, `SMS_LIVE=1`, `SMS_PROVIDER`, and `SMS_API_KEY` together. `PAYMENT_PROVIDER=mock` is for tests, not the shop. Local uploads use `STORAGE_PROVIDER=local`. A non-local provider returns no storage rather than inventing a bucket. CSP uses `frame-ancestors` and does not set `X-Frame-Options`. Migration `0006_completion.sql` is additive. `0002` through `0005` stay untouched.
28. v0.9.1 does not add a migration. A verified order is not cancelled by a status button. Closing it writes a ledger refund and restocks only while `stock_state` is `captured`. Refund totals are read after the order row is locked, and the order update itself rejects a sum above `total_irr`. `refunded` is not a manual status. A mock SMS provider returns nothing in production.


## Batch 04 decisions (2026-11-19)

29. Owner accepts the Batch 03 correction as baseline and moves comprehensive verification to Batch 08. Batch 04 stops for review; Batch 05–08 are unstarted; Batch 09 SMS.ir and PayPing is after Batch 08.
30. Keep the server cart authoritative and the standalone cart route. Use the existing Radix dialog for the new drawer. Persist tab-scoped intent before writes and fail closed when it cannot be stored; do not auto-repeat a possibly committed add. Quantity comparison is not a server version/idempotency guarantee.
31. Because the drawer can change the cart during checkout, require the new checkout UI to compare its reviewed cart with locked server rows and block uncertain changes. This is a narrow safety correction, not a payment integration; old callers retain compatible optional expectations.
32. Suppress the removed legacy section without deleting CMS records or concealing unrelated featured sections. Migration `0009` updates only unedited recognized old seed copy; editor-owned copy wins. Existing production foundation is not populated with demo CMS data.
33. Three indicator lines represent the current group of up to three banners; previous/next reaches all CMS banners. Reduced motion and active interaction pause automatic rotation.
34. Batch 09 preparation is documentation only. The already-present conditional SMS.ir adapter was not enabled or modified; PayPing remains unimplemented. Do not add real secrets or claim a provider was tested.

## Batch 04 Production homepage correction (2026-11-19)

35. Provision the three approved homepage product sections through additive migration `0010_batch_04_home_sections.sql`, not Demo Seed or app-startup fallback. Use section type as the structural key, canonical IDs for fresh installs, skip every existing type without touching its CMS fields, and append only missing rows. The public home remains database-driven and displays an empty state when products do not match. Production must run the existing guarded migration command before serving; full verification remains in Batch 08.

## Batch 05 decisions (2026-11-19)

36. Customer mobile remains the OTP-authenticated identity and cannot be edited through profile update. Required first/last name fields and optional gender/age-group values are self-service and session-owned; no client-supplied customer ID is accepted. Optional profile answers may remain blank or “prefer not to say.”
37. Migration `0011_batch_05_customer_account.sql` is additive. Existing addresses receive empty recipient-name/mobile defaults and remain editable; checkout keeps compatibility fallbacks for those legacy rows. One non-deleted default address per customer is enforced with a partial unique index after deterministic duplicate cleanup. Address writes remain owner-filtered and transactional/audited.
38. Account order history remains customer-scoped and bounded to 20 rows, and returns Persian lifecycle/payment labels without raw internal states or delivery mobiles. Staff-only shipment/event notes are suppressed from customer projections. Current account sections are exactly profile, orders, addresses, settings and contact; unsupported customer ticket/security settings and duplicate wishlist navigation are not invented.
39. Optional gender/age reporting is available only through `reports.read`, and only as aggregate counts and percentages among answered values with missing responses shown separately. No customer-level demographic report rows are exposed.
40. No real database, SMS, payment, carrier or storage provider is contacted by Batch 05. Production rollout requires the guarded standard migration command and is not certified until Batch 08 verification.


## Batch 06 decisions (2026-11-19)

41. Batch 06 is code-only: do not add or edit a migration; preserve `0001`–`0011`. New CMS, product and gallery behavior uses existing tables and columns.
42. Product facts remain owner-supplied and optional. English name is not required. Blank origin, ingredients, usage/storage, SEO, oil-guide and specification data remain blank; no product facts or claims are synthesized. The homepage title may fall back to the product’s own entered name only.
43. Product gallery continues to use normalized `product_images` links to shared `media_assets`. Gallery order changes are complete permutations under row locks and are audited. Detach removes only a product association; shared media remains. Existing media URL validation and lock/retirement rules are preserved.
44. Existing fixed page slugs remain tied to their public routes. New CMS pages use the existing `site_pages` table and a dedicated `/pages/{slug}` route; only published pages are public. Page bodies remain plain text, with paragraph breaks, not HTML.
45. Article SEO title/description use existing article columns. Existing article status, cover, category, related-product, reading-time and plain-text contracts remain; only published content is projected publicly.
46. CMS article/media pickers return at most the 100 newest records and provide client-side search within that set. Pagination or loading older records is a future compatibility follow-up if actual data volume requires it.
47. This batch exposes URL-only media registration in the CMS. It does not configure or enable object storage, binary uploads, or production local storage; existing local-upload source modules remain unchanged and must be reviewed separately before any deployment.


## Batch 08 Revision 01 decisions (2026-11-19)
48. QuoteCart and cart mutations must use the shared `isLineSellable` rule: published, non-deleted products; active, non-deleted variants; and at least one active, non-deleted category. Database-backed quote tests are required for these state transitions.
49. Better Auth remains in the active platform scaffold and is pinned to `1.7.26` after a reviewed compatibility update. SHAHOO deployment still requires explicit `VITE_AUTH_ENABLED=false`; the custom SHAHOO cookie/RBAC path remains the intended shop authentication.
50. CMS media registration is HTTPS URL-only for this batch. Do not claim binary uploads, object storage, or persistent local media unless a target deployment proves them.
51. The configured private platform/script tests remain part of verification and are reported separately when their `.grok` inputs are absent; tests are not weakened or deleted to obtain a green result.
52. Batch 08 Revision 01 remains a release-readiness checkpoint, not production approval. Real PostgreSQL, backup/restore, target-host, browser/accessibility, and provider verification are release prerequisites.


## Batch 08 Revision 02 decisions (2026-11-19)

50. `VITE_AUTH_ENABLED` is explicit opt-in: only the exact string `true` enables the platform scaffold; absent, empty, malformed, and `false` values fail closed to auth-off.
51. Demo seeding must preserve any existing homepage section type provisioned by migrations or CMS and insert only missing types.
52. The Revision 02 release decision remains **NOT READY FOR RELEASE** until real PostgreSQL, backup/restore, authorized target-host configuration, complete platform-harness, and accessibility evidence are obtained.
53. The missing complete Claude audit source is recorded as unavailable; missing finding descriptions are not fabricated.
54. Batch 09 and all real provider/production integrations remain out of scope.

## Batch 09 implementation disposition — 2026-11-19

No new product or security policy decision was approved. In particular, the OTP policy for an older unconsumed challenge becoming selectable after a newer challenge is exhausted remains unresolved. PayPing must remain disabled until a durable provider-attempt and verified-charge reconciliation flow is implemented and tested for local stock/settlement failure. The current Batch 09 report documents provider contract research and implementation limits; it does not constitute approval for provider credentials, live calls, deployment, or a policy change.

## Batch 09 remediation decisions — 2026-11-19

- Reuse the existing payment provider and settlement architecture; do not route PayPing callbacks into the old one-shot helper before durable evidence exists.
- Persist provider verification before local settlement and mark local failures as reconciliation-required rather than claiming distributed atomicity.
- Accept PayPing Already Verified only for HTTP 409 with `metaData.code=110`, with exact persisted reference and amount matching.
- The official PayPing OpenAPI did not identify the amount unit. The source retains one integer IRR boundary but PayPing activation remains blocked until the merchant contract confirms the unit.
- The unresolved OTP older-challenge selection policy is preserved and requires explicit owner/security disposition.

## Batch 09 comprehensive audit decisions — 2026-11-20

- Keep PayPing unknown initiation attempts blocked; do not invent a provider lookup endpoint. Use the audited admin manual-review/cancel path only after dashboard review.
- Recover a stale `settling` attempt after a five-minute lease into `local_settlement_pending`; preserve provider evidence and reuse the same local idempotency key.
- Make SMS modes explicit: disabled by default, sandbox mock only, and live only with production plus explicit live flags.
- Treat SMS timeout/network/5xx outcomes as unknown and never automatically resend the same OTP.
- Preserve `.env.example` with an explicit negation rule after the broad `.env.*` ignore pattern.

## Batch 09 final decisions — 2026-11-20

- Adopt **latest-issued OTP wins**: a new login challenge atomically consumes prior unconsumed login challenges for the same mobile/purpose; exhausted latest challenges do not reveal older codes.
- Treat PayPing verification network/5xx/202 outcomes as `provider_outcome_unknown`, persist the original verification reference, and retry only the same owned attempt; never create a replacement payment automatically.
- Keep real provider and PostgreSQL verification deferred; the source verdict is **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration, not live release approval.
