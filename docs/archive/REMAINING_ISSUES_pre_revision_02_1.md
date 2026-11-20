<!-- HISTORICAL ARCHIVE: SUPERSEDED BY BATCH 08 REVISION 02.1 -->
> **Historical record only — superseded:** This is the original `REMAINING_ISSUES.md` as received before Batch 08 Revision 02.1 reconciliation. Its status, blockers, results and instructions may be obsolete or contradictory; use the current `../../REMAINING_ISSUES.md` and `../../BATCH_08_FINAL_RELEASE_EVIDENCE.md` instead. Original contents follow unchanged.

---

<!-- BATCH 08 REVISION 02 CURRENT STATUS -->
> **Batch 08 Revision 02 current status (2026-11-19):** Revision 02 started from the exact Revision 01 archive and remains **NOT READY FOR RELEASE**. Auth is now explicit opt-in/fail-closed; reviewed `typescript-eslint@8.73.0` leaves `npm audit` at 0 vulnerabilities; demo homepage seeding now preserves migration-provisioned section types; typecheck, build, application tests (215/215), migration/PGlite tests (94/94), focused auth tests, and bounded desktop/mobile runtime smoke pass. The configured script group is partial (212/216; four failures require absent private `.grok/skills/og` harness files). Real PostgreSQL fresh/upgrade/concurrency, backup/restore, authorized target-host verification, and complete accessibility review remain unavailable. **Batch 09 has not started; no real providers or production hosting were connected.**

# Remaining issues — v1.0.0 (current through Batch 08 Revision 01, 2026-11-19)

## Current workflow status — Batch 08 Revision 01 (2026-11-19)

Batch 08 implementation/review is complete and Revision 01 is current. QuoteCart/cart consistency is **RESOLVED** through shared `isLineSellable` enforcement and PGlite database-path coverage. Better Auth is upgraded to `1.7.26`; the post-upgrade audit is 7 moderate, 0 low/high/critical.

Release approval remains pending: **NOT READY FOR RELEASE**. Open release blockers are real PostgreSQL fresh/upgrade/concurrency evidence, backup/restore, target-host verification including explicit `VITE_AUTH_ENABLED=false`, browser/mobile/accessibility runtime checks, private `.grok` harness inputs, and owner treatment of remaining moderate dependency findings. The newest-100 CMS media picker boundary remains intentional. Historical Batch 07/“Batch 08 not started” instructions below are superseded.

### Revision 01 remaining verified blockers
1. Run authorized real-PostgreSQL fresh/upgrade, independent-connection concurrency, migration, and backup/restore checks.
2. Verify the deployed build/runtime explicitly sets `VITE_AUTH_ENABLED=false`; the archive intentionally omits private `.grok/app-env.json` and real `.env` files.
3. Run deployed desktop/mobile/keyboard/focus/screen-reader checks.
4. Resolve or explicitly risk-accept the seven remaining moderate npm audit findings.
5. Keep the private platform/script failures separate until the owner-specific `.grok` files are available; do not delete or weaken those tests.

## Batch 06 status snapshot (historical; superseded by current status above)

The following paragraph preserves the Batch 06 handoff state. Its stop instruction applied at the time and is superseded by the current status above.

Batch 04's approved homepage sections remain **RESOLVED in source** by migration `0010_batch_04_home_sections.sql`; Batch 05 account/profile/address/order/report work remains **implemented in source** with migration `0011_batch_05_customer_account.sql`; Batch 06 product/CMS scope is **implemented in source** with no new migration. Focused CMS/media and catalog tests, 41 commerce/account regression tests, TS/TSX checking and targeted lint passed; exact evidence is in `BATCH_06_REPORT.md`. No production database, external provider, storage provider or deployment was used. Known Batch 06 limits: content/media pickers show only the 100 newest records (no server-side pagination/load-more), fixed root page slugs are immutable and new pages use `/pages/{slug}`, text editors remain plain text, banner deletion is intentionally unavailable, and the existing local-upload modules were not enabled or configured in this batch. Full JavaScript-aware typecheck, full lint/suite/build, real-Postgres and production migration, browser/responsive/accessibility, media/upload deployment review and backup/restore remain deferred to Batch 08. Stop for owner approval; do not start Batch 07.


Status key: **CONFIRMED** = seen in current source; **UNVERIFIED** = not examined or not executed; **RESOLVED** = source changed and a named test was executed. Batch 00 evidence remains in `BATCH_00_REPORT.md`. Line numbers drift. Do not treat a single-connection PGlite result as multi-connection PostgreSQL proof.

## Batch 03 correction (2026-11-18)
Resolved in source (executed: 27 wishlist tests; the store adapter, components and a browser flow are NOT executed):
| Issue | Evidence |
|---|---|
| Guest wishlist cleared on login even when the merge failed | `wishlist-sync.test.ts` (executed, 19/19) |
| Initial wishlist read could overwrite a newer toggle | `wishlist-sync.test.ts` stale-read tests (executed) |
| Master context, FILE_INVENTORY, AGENTS.md and Batch 08 report were stale | documents rewritten/marked |
Still open / new:
- Not executed anywhere: tsc, ESLint, build, PGlite suites, browser tests (see `LATEST_HANDOFF.md`).
- Two `scripts/brand-check.test.mjs` tests pin the old platform `AGENTS.md` and `.grok/` skills; they already failed in this repo and will need retiring together with the unused `.grok` scaffolding (not removed here).
- Wishlist ids skipped by the server (deleted products) are dropped silently; no customer message.
- Gold on ivory contrast (2.66:1) and the earlier Batch 03 items remain.

## Batch 03 (2026-11-18)
Resolved in source (tests written/executed as listed in `BATCH_03_REPORT.md`; tsc/eslint/build/browser NOT executed):
| Issue | Evidence |
|---|---|
| Wishlist leaked between accounts via persisted browser state | `wishlist-rules.test.ts` (executed, 8/8); `frontend-source.test.mjs` |
| Cart view: no duplicate-write guard, stale responses, false success | `cart-ui-rules.test.ts` (executed); static test |
| Route errors printed raw error text; no Persian not-found | `frontend-source.test.mjs` (executed) |
| Upload could report success without server `ok`; broken previews | `media-upload-client.test.ts` (executed) |
Still open / new:
- Typecheck, lint, build, PGlite suites and real-browser responsive/keyboard checks were not executed.
- Gold text on ivory/paper contrast is 2.66–2.74:1 (palette decision for the owner).
- Dialog/drawer focus trapping and touch targets not browser-verified; no upload progress bar (pending state only).
- Product page performs one extra wishlist state read per view.

## Batch 02 correction (2026-11-17)
Resolved in source (tests written; PGlite and tsc/eslint **not executed** in the correcting sandbox; lock proven at SQL level on real PostgreSQL 16):
| Issue | Evidence |
|---|---|
| `recoverStock` ignored category/product/variant availability | `isLineSellable`; tests `recovery: ...` in `correction.test.ts`, pure tests in `commerce-integrity.test.ts` (executed, 7/7) |
| `settlePaidCancel` left `refundOfPaymentId` empty | `chooseRefundSourcePayment`; tests `paid cancel ...` (pure part executed) |
| Media attach/replace could race `retireMedia` | `src/server/media/lock.ts`; `scripts/pg-media-race.sh` executed on PostgreSQL 16: 13 PASS, negative control reproduced the old race, 180 simultaneous rounds clean |
New findings, not fixed (out of scope):
- `recordRefund` still allows a refund with no source payment when the order has no verified rows (`refundOfPaymentId` null).
- An order with more than one verified payment cannot be cancelled by `settlePaidCancel` (ambiguous link); needs a design for multi-payment refunds.
- Orders marked `verified` without a payment row (legacy/manual data) now fail paid cancel by design.
- Pending media file cleanups are retried only when another asset is retired; no scheduler or admin screen.
- The race script proves the locking SQL, not the TypeScript; a TypeScript multi-connection test needs a Postgres test harness (`pg` package) not available offline.
- Never executed here: tsc, eslint, build, all PGlite tests.

## Resolved in Batch 02
| Issue | Evidence |
|---|---|
| Guest merge could be repeated and quantity policy was implicit | `mergeCartInto` sums once and deletes the source cart. `adoptLinesIntoCart` uses max. Tests `guest cart merge sums once...`, `repeated local adopt uses the larger quantity...` |
| Concurrent cart adds on one connection could lose a line | `mutateCartLine` locks the cart, then inventory. Test `concurrent cart adds keep one line and both increments` on one PGlite connection |
| Checkout could trust a client price, and the receipt hash was written after commit | `checkout uses the live server price...`; hash is inside `insertOrder` |
| Same checkout could be retried into a second order, or a bad key accepted | `the same checkout key replays...` |
| Failed payment could later verify with the same key; amount and currency were not both enforced | `a failed payment stays unpaid...`, `currency and amount mismatches...` |
| Expiry could release a paid hold, or release twice | `expiry releases a hold once, skips a paid order...`. 24 h `STOCK_HOLD_MS` unchanged |
| Payment after expiry had no recovery, and a race could disagree | `payment after an expired hold does not mark the order paid when stock is gone`, `expiry and payment leave one consistent stock result` (one PGlite connection) |
| Partial refunds were not proven against a verified payment, and restock was not explicit | `partial refunds stay within the verified payment...`, `an explicit full restock runs once...` |
| Shared media could be removed while still referenced | `shared media is not deleted and a replacement leaves the shared file in place` |
| Payment currency and refund-to-payment link were not columns | `migrations/0008_batch_02.sql`. No rows deleted |

## Resolved in the Batch 01 correction
| Issue | Evidence |
|---|---|
| Fresh production baseline published sample phone, WhatsApp, email, address, and social links | `insertBaseline` in `src/server/db/seed.ts` stores empty contact fields. Tests `empty and sample contact values produce no public rows or links`, `contact lines render nothing clickable until a real value is saved`, `fresh baseline publishes no sample contact, shipping price, or brand claim` |
| Fresh baseline published a free-shipping banner and invented 85,000 / 120,000 toman fees | No shipping rows are inserted. `header.promo` is empty. `isUnapprovedSeedShipping` rejects the old price pairs |
| Invented `store.story` was stored as if it were a verified brand history | Baseline story fields are empty. `storyIsConfigured` is false for blanks and for the old seeded text |

The correction does not delete rows already stored in an existing database. Display code hides the exact old sample contact strings, the exact old promo sentence, and the exact old shipping price pairs. Any other saved contact or shipping price still renders.

## Resolved in Batch 01
| Issue | Evidence |
|---|---|
| Production PGlite fallback when `DATABASE_URL` is missing (SH-002) | `src/lib/db.ts` `readDatabasePlan`; tests `production database configuration fails closed`, `production startup throws without DATABASE_URL` |
| Demo seed and coupons `SHAHOO10` / `ORGANIC20` in production (SH-001) | `seedFoundation`; test `production initialization stores no demo products or coupons` on PGlite. Already-contaminated databases are not wiped |
| OTP echo, mock payment, mock SMS, relaxed CSP keyed only on `NODE_ENV` (SH-003) | `otpEchoAllowed`, `mockPaymentAllowed`, `mockSmsAllowed`, `devCspAllowed` |
| Concurrent checkout with different idempotency keys | `FOR UPDATE` plus `consumeCartLines`. Multi-connection Postgres: **NOT EXECUTED** |
| Idempotency detection by error text | `isIdempotencyConflict` (SQLSTATE `23505`) |
| Nested admin order, admin customer, and magazine article routes | Layout `Outlet`; test `admin, customer, and magazine layouts render the child route` |
| Customer online support route | `src/routes/account.support.tsx` removed. Admin `/admin/support` kept |
| Saved checkout address could differ from the stored snapshot | `resolveCheckoutAddress`; checkout form `savedLocked` |
| Payment replay ignored order and amount | `samePaymentReplay`; test `payment replay rejects a different order or amount` |
| Build ran migrations (SH-011) | `package.json` `build` is `vite build` only |
| Admin bootstrap revived a suspended admin | `ensureAdminFromEnv`; test `bootstrap creates once and does not revive a suspended admin` |
| Default catalog cap of 6,000,000 toman (SH-008) | `passesMaxPrice` treats null as no cap |
| Missing `.env.example` | `.env.example` placeholders only |

## P0 — still open before a real deployment
| Issue | Status | Where |
|---|---|---|
| Guest checkout can hold stock for 24 h with no throttle (SH-007) | CONFIRMED, not in Batch 02 scope | `checkout.ts` stock hold |
| No health endpoint and no hold-expiry scheduler (SH-016) | CONFIRMED. Release is still lazy | `commerce/holds.ts` |
| Real multi-connection PostgreSQL concurrency | NOT EXECUTED — no `psql`, Docker, or Postgres | PGlite `Promise.all` is not that proof |
| A database that already received the old demo seed still contains demo products and coupons | CONFIRMED limitation | `seedFoundation` returns early when `foundation.seed` exists |
| `SEED_DEMO=1` still inserts a sample about page and homepage section copy | CONFIRMED, not production | `insertDemo` / `seedPages` |

## P1 — before real payments
- Internal payment states exist. There is still no storefront caller and no live gateway callback (SH-004).
- If a future gateway takes money and stock recovery then fails, this code does not store a verified row and does not consume the idempotency key. That needs an explicit reconciliation design before any gateway is connected.
- A refund can still be recorded before goods are received (SH-010). Restock is now explicit and tested. It is not automatic, and it is rejected on a partial refund.
- Guest checkout throttle and a hold scheduler are still open.

## P1 — before real SMS
- 5-digit OTP, attempts counted per challenge only, no per-mobile lockout beyond the existing bucket (SH-006). Echo is opt-in. Provider hardening was not expanded.

## P2 — recommended
- Thin DB CHECK coverage beyond the new IRR check (SH-009); `unsafe-inline` remains in CSP on purpose (SH-012); Persian search normalisation and pagination (SH-013); admin MFA (SH-014); no shipping-provider API (SH-015); upload tests exist but are not a full sanitizer audit (SH-017); platform `extensions.js` (SH-018); Origin/CSRF coverage not re-audited.
- Unused dependencies (SH-019); `better-auth` remains in the scaffold while `VITE_AUTH_ENABLED=false` (SH-020).

## UNVERIFIED (deferred)
Wishlist cache isolation between accounts; real Neon behaviour; response headers on Vercel; browser end-to-end of Batch 02. The missing-logo screenshot issue was not rechecked. A thrown filesystem delete after a committed media retire was not simulated. The source writes `media.file_cleanup` and can leave the file.

## Blocked on real credentials (unchanged)
Zarinpal/Zibal/IDPay not connected; Kavenegar/SMS.ir never called; no carrier API; no cloud bucket.

## Not claimed
No live Neon migration. WebP is structurally checked, not decoded. Coupons have no per-customer limit. The contact page does not store messages. Ledger revenue stays zero until a verified payment row exists. PGlite checkout, cart, and expiry races are not a PostgreSQL multi-connection proof. The shop cannot take payment.


## Batch 04 source findings and deferred work (2026-11-19; historical snapshot; some follow-ups remain for Batch 08)

- **UNVERIFIED / Batch 08:** Full project typecheck, ESLint, full application suite, build, PGlite migrations and transaction tests, real multi-connection PostgreSQL, browser E2E, responsive desktop/mobile, keyboard/focus/screen readers, cart/session synchronization and CMS/carousel integration. No current-batch runtime or browser success is claimed.
- **RESOLVED / Production homepage sections:** The original Batch 04 fresh-database gap is superseded by migration `0010_batch_04_home_sections.sql`, which adds only missing approved product section types and preserves existing CMS rows. Production must run its guarded migration command. The earlier copy migration `0009` remains unchanged and retains its audit-based legacy-copy behavior; review it separately for older databases.
- **UNVERIFIED / cart concurrency:** Session storage markers and the shared write gate are per tab. An add with a lost response may commit after the customer reviews/acknowledges; safe exactly-once handling requires server-side add idempotency/versioning. Quantity compare-and-set has an ABA hole; legacy callers can omit expectations. Session-storage failures block changes rather than lose intent. A non-sellable server variant may be cleaned up irrespective of the expectation.
- **UNVERIFIED / checkout:** A reviewed-cart expectation is checked under the cart lock, but is not yet proven on a real multi-connection database. Shipping/coupon values are still server-recalculated and are not bound to the quote. An uncertain earlier order response followed by an empty cart may not be replayable through the current UI; investigate in Batch 08.
- **UNVERIFIED / hero:** With >3 banners, indicators represent the current group; all are accessible through previous/next. Active-slide sizing avoids oversized whitespace but very unequal copy lengths can move content below, and a fading outgoing long slide may clip. CMS-provided alternate text is used when present, with desktop preferred if both images differ; review image alternatives and layout on real viewports.
- **PARTLY VERIFIED / migration:** Isolated PGlite tests for `0010` creation, rerun idempotence and edit preservation passed. Actual PostgreSQL/Production execution, multi-connection behavior and deployment rollout were not tested; run them on an authorized disposable copy during Batch 08.

## Batch 04 Production homepage correction (2026-11-19)

- **RESOLVED in source; focused checks EXECUTED — PASS:** Missing section types are created by `0010`; existing type rows (including custom IDs), text, config, activation and order are not overwritten. Repeated application did not add duplicates. See `BATCH_04_CORRECTION_REPORT.md` for exact evidence.
- **CONFIRMED operational requirement:** Production SQL migrations are explicit, not applied at app startup. Run the standard guarded `npm run db:migrate` before serving the updated app. No Production database was migrated here.
- **UNVERIFIED / deferred to Batch 08:** Full typecheck, lint, complete suite, build, real PostgreSQL, browser/mobile/desktop, accessibility and live CMS validation. Pre-existing duplicate section types are not consolidated. If a canonical ID is occupied by another section type, migration 0010 chooses an unused deterministic fallback ID instead of overwriting it.


## Batch 08 current state — 2026-11-19

Batch 08 comprehensive audit is complete from `SHAHOO-v1.0.0-batch07-revision01.zip` (source SHA-256 `9e9ec41fb296bb587d6431ae98af95ff1b27652b93926d00f22bb5e3c1b3c918`). Dependencies installed from the lockfile. TypeScript passed; ESLint passed with five warnings; application tests passed 214/214; migration-aware PGlite/integration tests passed 90/90; production build passed; and the new quoteCart sellability regression suite passed 7/7.

A confirmed quoteCart consistency defect was fixed: quoteCart now uses the shared sellability rule and rejects unpublished/deleted products, inactive/deleted categories, and inactive/deleted variants. Cart lookup also rejects soft-deleted variants. An explicit postal-code accessible name was added.

The final decision is **NOT READY FOR RELEASE**. Real PostgreSQL fresh/upgrade/concurrency testing, backup/restore, browser/mobile/accessibility runtime checks, target-host verification, and deployment verification of `VITE_AUTH_ENABLED=false` were not executable in this environment. `npm audit` reported 10 findings including one critical Better Auth advisory. The configured platform script group remains 206/215 passed, 9 failed because private `.grok` harness inputs are absent and one upload assertion is obsolete for the supported HTTPS-only media-registration design.

Deliverable: `SHAHOO-v1.0.0-batch08-review.zip`. Batch 09 SMS.ir and PayPing remains pending and was not started. No production deployment or owner approval is claimed. See `BATCH_08_REPORT.md` for exact evidence and the deployment checklist.
