# BATCH 02 REPORT

Date: 2026-11-17  
Version: 1.0.0  
Input archive: `SHAHOO-v1.0.0-batch01-correction.zip` (owner-approved)  
Output archive: `SHAHOO-v1.0.0-batch02.zip`

Status: implemented and packaged for owner review. **Not approved.** Do not start Batch 03 until the owner reviews this ZIP.

No production database was contacted. No payment gateway, SMS provider, carrier, or bank was called. No secret was written into the repository. No customer, order, payment, inventory, or audit rows were deleted.

## 1. What was inspected

Checkout, cart, orders, payments, inventory holds, refunds, media upload/replace/retire, and migrations `0002`–`0007` plus `migrations/auth/0001_auth.sql`. Batch 01 protections that the source still contains, and that the existing tests still exercise: production fails closed without `DATABASE_URL`; demo seed is opt-in and blocked in production; mock payment, mock SMS, OTP echo, and relaxed CSP cannot turn on in production; checkout locks the cart and consumes lines only when the quantity still matches; idempotency conflicts use SQLSTATE `23505`; saved-address checkout is locked; nested admin/magazine routes render; customer `/account/support` stays removed; admin bootstrap does not revive a suspended admin; the catalog has no default 6,000,000 toman cap; `npm run build` does not migrate.

`0001_auth.sql` was not edited and is still outside the shop migrator glob.

## 2. Quantity and hold policy

These policies were already implied by the code. Batch 02 made them explicit and tested them. They were not replaced with a new business timeout.

- Guest cart → customer cart (`mergeCartInto`): **sum once**, inside one transaction. Both carts are locked in id order. The sum is clamped to sellable stock and `MAX_LINE_QTY` (20). The source cart is deleted, so a second merge is a no-op and cannot double the quantity. Valid lines are not dropped except when the clamped quantity is zero (nothing sellable).
- Local cart adopt (`adoptLinesIntoCart`): **max, not sum**. Repeating the same payload does not grow the line. A higher local quantity can raise it. A lower one does not reduce it.
- Add and set lock the cart row, then the inventory row, and read the live sellable quantity before writing.
- One line per cart and variant. The unique `(cart_id, variant_id)` key from `0003` is unchanged.
- Checkout ignores client prices. The order stores the live variant price and the usual name, variant, SKU, quantity, and unit-price snapshot.
- Stock hold remains **24 hours** (`STOCK_HOLD_MS` in `src/server/commerce/pricing.ts`). No new payment timeout was invented. Expiry still runs when the existing release path is called. No scheduler was added.

## 3. What changed

### A. Cart

`src/lib/commerce-integrity.ts` `combinedCartQuantity`. `src/server/commerce/cart.ts` uses it. Guest claim calls `mergeCartInto`. Adopt uses max. The old private merge that capped at 99 was removed.

### B. Checkout

`insertOrder` writes the validated idempotency key and the receipt-token hash inside the order transaction. The post-commit token update was removed. Keys must match `^[A-Za-z0-9._:-]{1,80}$`. Replay still requires the same buyer. The Batch 01 `FOR UPDATE` cart lock, conditional line delete, and SQLSTATE `23505` detection were not weakened.

### C. Payment lifecycle (no gateway)

`paymentTransition`: null or pending may become verified, failed, or expired. Verified is terminal (a repeated success is an idempotent success; fail or expire is rejected). Failed and expired are terminal for that idempotency key. A later success with the same key is rejected. A new key can still pay.

`captureVerifiedPayment` rejects a non-IRR currency and an amount that is not the order total before it stores a row. A second key on an already captured order fails and does not pretend the replay already matched. A failed verify inserts a failed payment row and a `payment.failed` audit in the same transaction and does not mark the order paid. The success audit `payment.verified` is inside the success transaction. If stock cannot be taken, the payment, order update, and audit roll back. Mock payment remains impossible in production. No provider is called.

### D. Reservation expiry

`releaseExpiredHolds` now also requires `payment_status = unpaid` and `stock_state = held`. A paid or captured order is skipped. A second expiry does not release the same units again. After a real expiry, payment may recover stock only when the product is still published and the sellable quantity covers the line (`capture_recovered` decrements `on_hand` only, because `reserved` was already released). If it cannot, the order stays expired and unpaid and no payment row is written.

Limitation, not a reconciliation queue: the idempotency key is not consumed when stock recovery fails. That is safe while no live gateway moves money. A future gateway must not treat a rejected recovery as “charged but unrecorded” without its own reconciliation step. This batch does not add that step.

### E. Refunds

`refundCeiling` is `min(order total, sum of verified payment amounts)` when verified payment rows exist. If none exist, the ceiling stays the order total, so older rows that only set `payment_status` still have a ceiling. `recordRefund` accepts optional `{ restock?: boolean; paymentId?: string }`. Restock is rejected unless the resulting status is a full `refunded`. `restockCaptured` claims `stock_state` from captured to restocked once, then adds `on_hand`. A refund row stores currency `IRR` and `refund_of_payment_id` when there is a single verified payment or an explicit payment id. The wrong payment id is rejected. A duplicate return refund returns `already` and does not increase the amount. Paid cancellation uses the same ceiling and the same one-time restock claim. Refunds do not restock unless the caller asks.

### F. Inventory and order transitions

Conditional stock updates stay. Negative stock is still rejected by those conditions. Manual moves to paid or refunded are still blocked and write no success audit. Inventory adjustment still requires a 2–200 character note (`adjustInventory` was not changed).

### G. Audit

Success audits for the new payment, refund, hold, and media paths are written in the same transaction as the mutation. A rolled-back payment does not leave a success audit. Tokens and secrets are not written into these audit rows.

### H. Media

`retireMedia` soft-deletes and audits inside the transaction, then deletes the local file only if that transaction committed. If `remove` throws, an `ops_diagnostics` row with kind `media.file_cleanup` is inserted. The row stays soft-deleted. The file can remain. That orphan is the documented limitation of a database that cannot enlist the filesystem. Shared product images cannot be retired. `replaceProductMediaLink` retargets a product image and does not delete the previous file. `storeUploadedImage` inserts the row and the audit in one transaction and removes the new file if that transaction fails.

### I. Migration

`migrations/0008_batch_02.sql`:

- `payments.currency text not null default 'IRR'`, check constraint `payments_currency_irr` (`currency = 'IRR'`). Existing rows backfill to IRR.
- `payments.refund_of_payment_id` foreign key to `payments(id)`, nullable.

Idempotent `add column if not exists` and drop-then-add of those two constraints. No data is deleted. Rollback consideration: dropping the two columns would discard only the currency (always IRR today) and the refund link. Do not drop them on a database that already stores refund links. Shop migrators still do not apply `migrations/auth/0001_auth.sql`.

Drizzle `payments` in `src/server/db/schema.ts` matches the new columns. Test databases that apply `0002`–`0008` were updated to include `0008`. `package.json` test script lists the two new test files. No dependency and no version was added or bumped. `package-lock.json` was not changed.

## 4. Files

Created:

- `src/lib/commerce-integrity.ts`
- `src/lib/commerce-integrity.test.ts`
- `src/server/commerce/batch02.test.ts`
- `migrations/0008_batch_02.sql`
- `BATCH_02_REPORT.md`

Changed:

- `src/server/commerce/cart.ts`
- `src/server/commerce/checkout.ts`
- `src/server/commerce/holds.ts`
- `src/server/commerce/fulfillment.ts`
- `src/server/payments/service.ts`
- `src/server/media/storage.ts`
- `src/server/cms/content.ts`
- `src/server/db/schema.ts`
- `src/server/commerce/checkout-safety.test.ts`
- `src/server/completion/flow.test.ts`
- `src/server/db/seed-safety.test.ts`
- `src/server/db/baseline-public.test.ts`
- `src/server/auth/admin-bootstrap.test.ts`
- `package.json` (test script only)
- `PROJECT_STATE.md`, `REMAINING_ISSUES.md`, `LATEST_HANDOFF.md`, `NEXT_BATCH_BRIEF.md`, `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `docs/PRODUCTION.md`

## 5. Tests

Command: `env -u DATABASE_URL npm test`  
Exit code: 0

| Group | Tests | Result |
|---|---|---|
| `node --test scripts/**/*.test.mjs` | 205 | Executed — Passed (0 failed) |
| `node --experimental-strip-types` app/lib group, including `src/lib/commerce-integrity.test.ts` | 145 | Executed — Passed (0 failed) |
| alias group, including `src/server/commerce/batch02.test.ts` | 37 | Executed — Passed (0 failed) |

`@tanstack/react-start` version printed before that run: `1.168.60`.

Also executed, all exit 0:

- `npx tsc --noEmit` — Executed — Passed (after the Batch 02 test file was in its final form).
- `npx eslint . --quiet` — Executed — Passed.
- `env -u DATABASE_URL npm run build` — Executed — Passed. The script is `vite build` only. It did not migrate. This build ran on the Batch 02 application source. Later edits in this batch are documentation only.

Batch 02 behavior covered by `batch02.test.ts` (PGlite, one connection, migrations `0002`–`0008`) and `commerce-integrity.test.ts` (pure):

- Guest merge sums once; a second merge does not duplicate quantity.
- Repeated local adopt uses the larger quantity.
- Concurrent cart adds on one connection keep one line and both increments.
- Checkout uses the live server price and rolls back when the product is not for sale.
- Same checkout key replays; a different buyer or a broken key does not create an order.
- Failed payment stays unpaid and cannot later flip to verified with the same key.
- Currency and amount mismatches are rejected before a payment is stored.
- Expiry releases a hold once, skips a paid order, and payment can recover stock.
- Payment after an expired hold does not mark the order paid when stock is gone.
- Expiry and payment together leave one consistent stock result (single PGlite connection).
- Partial refunds stay within the verified payment and do not restock unless asked.
- An explicit full restock runs once. An illegal order move writes no audit.
- Shared media is not deleted. Replacement leaves the shared file in place.

The earlier Batch 01 checkout, seed, route, and flow tests are in the same green run.

### Not Executed

- Multi-connection PostgreSQL concurrency. This environment has no `psql`, Docker, or Postgres server. The PGlite `Promise.all` cart and expiry-versus-payment tests are **not** that proof.
- `npm ci`. The lockfile was not changed.
- A browser click-through of cart, checkout, or refund screens.
- A forced filesystem `remove` failure after a committed media retire. The diagnostic insert is in source; the throw was not simulated.
- Migration of Neon or any other hosted database.
- A live payment callback.

### Static Inspection Only

- `migrations/auth/0001_auth.sql` was not modified (shop migrators still skip it; covered by the existing migration-plan tests, which passed).
- Inventory adjustment still requires a note (`adjustInventory` was not edited).

### Not Applicable

- Real Zarinpal, Zibal, IDPay, bank refund, SMS, or carrier calls. This batch forbids them.

## 6. Limitations that remain

- The shop still cannot take a real payment.
- Guest checkout can still hold stock for 24 hours with no extra throttle.
- There is still no hold-expiry scheduler. Release happens when the existing path runs.
- If a future gateway verifies money and stock recovery then fails, this code stores no verified row and does not consume the key. Do not connect a gateway until that gap has an explicit reconciliation design.
- A media file can remain on disk if cleanup fails after the database commit. The row is soft-deleted and a diagnostic is stored.
- An existing database is not wiped. `0008` only adds columns and constraints.
- `SEED_DEMO=1` can still insert sample about-page and homepage copy. That path is not production.
- Homepage, cart drawer, carousel, profile, CSRF, and wishlist-cache isolation were not changed.

## 7. Ready for review

Ready for owner review of `SHAHOO-v1.0.0-batch02.zip`. Not approved. Not able to take payment. Batch 03 was not started.

---

## Batch 02 correction (2026-11-17)

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
