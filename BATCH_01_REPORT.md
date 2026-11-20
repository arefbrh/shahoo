# BATCH 01 REPORT

Date: 2026-11-16  
Version: 1.0.0  
Input archive: `SHAHOO-v1.0.0-batch00.zip` (Batch 00 documentation-only baseline)  
Output archive: `SHAHOO-v1.0.0-batch01.zip`  
Correction archive: `SHAHOO-v1.0.0-batch01-correction.zip` (see section 8)

No production database was contacted. No payment gateway, SMS provider, carrier, or bank was called. No secret was written into the repository.

Section 8 supersedes the earlier statement that a fresh baseline inserts shipping methods and filled store settings.

## 1. What changed

Batch 01 is source changes plus tests and docs. There is no new SQL migration. `migrations/0002` through `0007` are unchanged. `migrations/auth/0001_auth.sql` is unchanged.

### A. Production database

Old: a missing `DATABASE_URL` selected embedded PGlite, including in production, and a Postgres error could be treated as a reason to fall back.

New: `resolveDatabasePlan` / `validateProductionEnv` in `src/server/env/runtime.ts`. `readDatabasePlan` in `src/lib/db.ts` throws when `NODE_ENV=production` and `DATABASE_URL` is empty. A configured URL always selects Postgres. `createNeonSql` rethrows connection failures and does not open PGlite. `connectionErrorUsesPglite()` is constantly false. The browser bundle still takes the non-server branch and does not open a database.

Configuration validation does not open a socket. Connectivity is checked only when `getSql()` runs.

### B. Seed

Old: `ensureSeed` inserted the demo catalog and coupons `SHAHOO10` and `ORGANIC20` into whatever database was connected.

New: `seedFoundation` in `src/server/db/seed.ts`. Default `demo` is false. `ensureSeed` passes `demoSeedAllowed(process.env)`, which is true only when `SEED_DEMO=1` and `NODE_ENV` is not `production`. Baseline rows are shipping methods, SMS templates, and store settings (`foundation.baseline`). Permissions still come from `seedAccessControl`. Demo products, articles, banners, navigation, pages, and coupons are inserted only when `demo` is true, then marked with `foundation.seed`. A second call does not duplicate them. Callers (`ensureSeed` from auth, storefront, SEO) share that policy.

Limitation: a database that already has `foundation.seed` from the old seeder is not deleted or cleaned.

### C. Development flags

Old: several behaviors turned on whenever `NODE_ENV` was not `production`.

New, all false in production even if the flag is `1`:

| Behavior | Flag | Function |
|---|---|---|
| OTP echo | `ECHO_OTP=1`, and SMS is not configured | `shouldEchoOtp` / `otpEchoAllowed` |
| Mock payment | `ALLOW_MOCK_PAYMENT=1` and `PAYMENT_PROVIDER=mock` | `mockPaymentAllowed` |
| Mock SMS | `ALLOW_MOCK_SMS=1` and `SMS_PROVIDER=mock` | `mockSmsAllowed` |
| Relaxed CSP | `ALLOW_DEV_CSP=1` | `devCspAllowed` |

`npm run dev` sets `ALLOW_DEV_CSP=1`, `SEED_DEMO=1`, and `ECHO_OTP=1` for the local preview process only. It does not set mock payment or mock SMS. `unsafe-inline` remains because TanStack Start needs it. That was not changed.

### D. Checkout atomicity

Old: the cart was read before the transaction and later deleted without a claim, so two idempotency keys could create two orders.

New: `commitCheckout` → `insertOrder` locks the cart row with `SELECT … FOR UPDATE`, re-reads lines inside that transaction, reserves stock with the existing conditional update, and `consumeCartLines` deletes a line only when `cart_id`, `variant_id`, and `quantity` still match. A mismatch throws `CheckoutError` and rolls the order back. `isIdempotencyConflict` (`src/server/db/sql-error.ts`) requires SQLSTATE `23505` and a constraint name containing `idempotency`. Message text is not used. The orders constraint is `orders_idempotency_key_unique`.

### E. Saved address

Old: the form stayed editable while the server replaced the location with the saved address.

New: choosing a saved address sets `savedLocked` in `checkout-view.tsx`. Province, city, line, postal code, plaque, and unit are read-only, and the form says so. `resolveCheckoutAddress` stores the saved location and the customer mobile. The name and delivery note still come from the fields the customer can edit. Clearing the selection (`نوشتن نشانی تازه`) uses the typed address.

### F. Nested routes

Old: `admin.orders`, `admin.customers`, and `magazine` rendered a page and no `<Outlet />`, so the detail child did not appear. `account.support` had the same structural bug.

New: those three files are layouts (`OrdersLayout`, `CustomersLayout`, `MagazineLayout`) that return `<Outlet />`. List pages moved to `admin.orders.index.tsx`, `admin.customers.index.tsx`, and `magazine.index.tsx`. `routeTree.gen.ts` was regenerated with the router generator, not hand-edited. The render test mounts each layout in a memory router with a child that prints `CHILD-RENDERED` and asserts that string in the SSR HTML.

Customer online support: `src/routes/account.support.tsx` was deleted and the account panel no longer links to it. `CustomerSupport` remains in `support-desk.tsx` but no customer route mounts it. Admin `/admin/support` is unchanged. Ticket tables and server functions remain.

### G. Payment replay

Old: a verified payment with the same idempotency key was returned as `already` without checking the order or amount.

New: `samePaymentReplay` requires the same `orderId`, `amountIrr`, and currency. There is no currency column; missing currency is treated as `IRR`. A mismatch returns a Persian error and does not report success. `captureVerifiedPayment` loads the order first and applies the check on the early return and on the conflict path.

### H. Build and migrate

Old: `npm run build` also ran migrations.

New: `build` is `node scripts/with-app-env.mjs vite build`. `db:migrate` is `node scripts/migrate.mjs`. The migrator refuses to run without `DATABASE_URL`, refuses production unless `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`, and holds `pg_advisory_lock(814774531042)` for the session. Failure is printed and the process exits non-zero. The read of `migrations/` is not recursive, so `migrations/auth/` is not applied.

### I. Environment example

`.env.example` lists names and comments. Values are empty. It is not a real `.env`.

### J. Admin bootstrap

Old: a later process start could reactivate a suspended bootstrap admin and put `super_admin` back.

New: `ensureAdminFromEnv` inserts only when the email is absent. A suspended or deleted row is left alone unless `SHAHOO_ADMIN_RECOVER=1`, which reactivates and ensures `super_admin`. `SHAHOO_ADMIN_ROTATE=1` updates the password of an active admin and does not restore a role. `applyStaffChange` still refuses to remove the last active super admin. That function was not edited.

### K. Catalog cap

Old: `listCatalog` defaulted `maxToman` to 6,000,000.

New: omitted `max` means no cap (`passesMaxPrice` returns true for null). An explicit max still filters. The zod schema still rejects a max above 50,000,000 toman. The slider ceiling is 50,000,000 and sliding to the end clears the filter.

### 0001_auth.sql

The file is in the input ZIP at `migrations/auth/0001_auth.sql`. Batch 00 reported it missing; that report was wrong. It is the platform Better Auth schema. SHAHOO customer and admin cookies do not use those tables. `scripts/migrate.mjs` and the PGlite glob of `migrations/*.sql` do not apply it. It was not edited and was not copied to `migrations/0001_auth.sql`, because sign-in via Better Auth is off (`VITE_AUTH_ENABLED=false`).

## 2. Files

Added:

- `.env.example`
- `src/server/env/runtime.ts`
- `src/server/env/runtime.test.ts`
- `src/server/db/sql-error.ts`
- `src/server/db/seed-safety.test.ts`
- `src/server/commerce/checkout-safety.test.ts`
- `src/server/auth/admin-bootstrap.test.ts`
- `scripts/migrate-guard.mjs`
- `scripts/migrate-guard.test.mjs`
- `scripts/db-production-guard.test.mjs`
- `scripts/nested-layout.test.mjs`
- `src/routes/admin.orders.index.tsx`
- `src/routes/admin.customers.index.tsx`
- `src/routes/magazine.index.tsx`
- `BATCH_01_REPORT.md`
- `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`

Removed:

- `src/routes/account.support.tsx`

Application source edited:

- `package.json` (scripts only; no dependency version changes)
- `scripts/migrate.mjs`
- `src/lib/db.ts`
- `src/lib/security-headers.ts`
- `src/lib/store-types.ts`
- `src/lib/completion-rules.test.ts`
- `src/routeTree.gen.ts` (regenerated)
- `src/routes/admin.orders.tsx`
- `src/routes/admin.customers.tsx`
- `src/routes/magazine.tsx`
- `src/routes/magazine.$articleId.tsx` (parameter types only)
- `src/routes/product.$productId.tsx` (parameter type only)
- `src/components/site/account-panel.tsx`
- `src/components/site/catalog-view.tsx`
- `src/components/site/checkout-view.tsx`
- `src/server/auth/admin-bootstrap.ts`
- `src/server/auth/auth.test.ts`
- `src/server/auth/crypto.ts`
- `src/server/catalog/rules.ts`
- `src/server/catalog/rules.test.ts`
- `src/server/commerce/checkout.ts`
- `src/server/completion/flow.test.ts`
- `src/server/db/seed.ts`
- `src/server/payments/service.ts`
- `src/server/sms/providers.ts`
- `src/server/storefront/api.ts`

Docs edited: `PROJECT_STATE.md`, `REMAINING_ISSUES.md`, `LATEST_HANDOFF.md`, `NEXT_BATCH_BRIEF.md`, `docs/PRODUCTION.md`, `docs/RELEASE_1.0.0.md`, `DEPLOYMENT_NOTES.md`, `PROJECT_HANDOVER.md`, `DEVELOPMENT_PROGRESS.md`.

`package-lock.json` was not modified. No package version was bumped.

## 3. Database migrations

None added. None rewritten.

## 4. Commands and results

Final gate, run after the import-extension fix, with `DATABASE_URL` unset in the environment:

```text
env -u DATABASE_URL npm test
```

PASS — EXECUTED. Exit 0.

| Group | Command shape | tests | pass | fail |
|---|---|---:|---:|---:|
| Platform and shop scripts | `node --test scripts/**/*.test.mjs` | 204 | 204 | 0 |
| Pure app tests | `node --experimental-strip-types --test` on the `package.json` list, including `runtime.test.ts` | 137 | 137 | 0 |
| Database-backed tests | `node --experimental-strip-types --import ./scripts/ts-alias-register.mjs --test` on migration, seed, flow, checkout, and admin bootstrap | 23 | 23 | 0 |

```text
npx tsc --noEmit
```

PASS — EXECUTED. Exit 0.

An earlier run failed on `runtime.test.ts` (narrowing) and on four implicit-any callbacks in magazine and product routes. Those callbacks were untyped before this batch as well (`product.$productId.tsx` was not otherwise changed). Annotations were added so the final typecheck is clean. No behavior change.

```text
npx eslint . --quiet
```

PASS — EXECUTED. Exit 0.

```text
env -u DATABASE_URL npm run build
```

PASS — EXECUTED. Exit 0. Vite reported the client build and Nitro wrote `.vercel/output/nitro.json`. The log does not run `scripts/migrate.mjs`. `DATABASE_URL` was unset, so this was not a migration against any database.

`npm ci` — NOT EXECUTED in this final gate. Dependencies were already installed from the existing lockfile. `package-lock.json` matches the Batch 00 archive.

`node -p "require('@tanstack/react-start/package.json').version"` printed `1.168.60`.

### Targeted tests (all inside the suite above)

| Test | Result |
|---|---|
| `production database configuration fails closed` | PASS — EXECUTED (no socket) |
| `demo seed and development flags cannot turn on in production` | PASS — EXECUTED |
| `migration requires a database and an explicit production confirmation` | PASS — EXECUTED |
| `production startup throws without DATABASE_URL` | PASS — EXECUTED (child process, import of `src/lib/db.ts`) |
| `a refused postgres connection does not become a successful pglite start` | PASS — EXECUTED against `127.0.0.1:1`, not a real server. stdout did not contain `connected` |
| `migrate exits before connecting when production confirmation is missing` | PASS — EXECUTED. Exits on the guard. Does not migrate |
| `migrate guard refuses an empty or unconfirmed production database` | PASS — EXECUTED |
| `production initialization stores no demo products or coupons` | PASS — EXECUTED on disposable PGlite |
| `saved address fields win over edited form text and are what the order stores` | PASS — EXECUTED on PGlite |
| `one cart cannot create two orders from different idempotency keys` | PASS — EXECUTED on one PGlite connection (`Promise.all` of two `commitCheckout` calls) |
| `a cart line changed after the snapshot is not deleted` | PASS — EXECUTED on PGlite |
| `idempotency conflicts are recognized by SQLSTATE and constraint name` | PASS — EXECUTED on PGlite |
| `admin, customer, and magazine layouts render the child route` | PASS — EXECUTED (TypeScript transpile + `renderToString`; HTML contains `CHILD-RENDERED`) |
| `generated route tree nests detail pages and removes customer support` | PASS — EXECUTED |
| `payment replay rejects a different order or amount` | PASS — EXECUTED on PGlite |
| `a mock payment provider cannot confirm money in production` | PASS — EXECUTED |
| `bootstrap creates once and does not revive a suspended admin` | PASS — EXECUTED on PGlite |
| `catalog price filter does not hide products when no maximum is set` | PASS — EXECUTED |
| `security headers stay strict unless the preview flag is explicit` | PASS — EXECUTED |

### Not executed

| Check | Label | Why |
|---|---|---|
| Two independent PostgreSQL connections racing checkout | NOT EXECUTED — ENVIRONMENT LIMITATION | `psql`, `pg_isready`, and Docker are not available. PGlite is one embedded database. It does not prove multi-connection locking. |
| `npm run db:migrate` against Postgres | NOT EXECUTED | No disposable Postgres, and a real `DATABASE_URL` was not set. The guard tests stop before a successful connection. |
| `npm ci` | NOT EXECUTED this gate | Lockfile unchanged and modules already present. |
| Browser walkthrough of admin detail, magazine article, and checkout | NOT EXECUTED | Route rendering was verified with `renderToString` of the layouts, not a full browser session of those pages. |
| The 8 platform script failures Batch 00 saw without `.grok/` | NOT RE-EXECUTED without `.grok/` | This sandbox has the platform `.grok/` directory, so the script group was 204/204. `.grok/` is not part of the SHAHOO ZIP. A clean unpack without that folder can still fail those platform tests. They were not "fixed" by inventing platform files. |

An intermediate `npm test` before the `.ts` extension fix exited 1: script tests 204/204, pure tests 121 pass and 2 file-load failures (`completion-rules.test.ts`, `auth.test.ts`, `ERR_MODULE_NOT_FOUND` for extensionless `runtime`), database tests 23/23. The final command above is the one that passed.

## 5. Deployment change

Order is now: build, set environment, `npm run db:migrate`, start.

Production requires `DATABASE_URL`. Production migrate also requires `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`.

Do not set `SEED_DEMO`, `ECHO_OTP`, `ALLOW_MOCK_PAYMENT`, `ALLOW_MOCK_SMS`, or `ALLOW_DEV_CSP` in production. They would be ignored, but they should stay unset.

First admin: set `SHAHOO_ADMIN_EMAIL` and `SHAHOO_ADMIN_PASSWORD_HASH` once. Leave `SHAHOO_ADMIN_ROTATE` and `SHAHOO_ADMIN_RECOVER` unset unless an operator is deliberately rotating or recovering that account.

Local preview (`npm run dev`) still loads demo content because the script opts in.

## 6. Remaining

See `REMAINING_ISSUES.md`. Nothing in Batch 02 was started. Guest-checkout throttle, hold scheduler, health endpoint, cart merge, partial refunds, payment recovery, and live integrations remain open.

## 7. Confirmation

No production credential, production database, or external payment/SMS/shipping call was used.

## 8. Batch 01 correction (2026-11-16)

Input: `SHAHOO-v1.0.0-batch01.zip`. Output: `SHAHOO-v1.0.0-batch01-correction.zip`. No new SQL file. Batch 02 was not started.

### Problem

A fresh production baseline still wrote sample contact details, a free-shipping banner, invented shipping prices, and an invented brand story, and the storefront showed them.

### What changed

- `insertBaseline` no longer inserts shipping methods. Contact fields, `store.story`, and `header.promo` are empty. Brand name, tagline, copyright, and logo paths stay.
- `contactRows` drops empty, invalid, and the exact old sample phone, email, address, and social strings. Footer and contact page render only those rows. Empty state has no `href`.
- `publicPromo` hides a blank promo and the exact old free-shipping sentence.
- `storyIsConfigured` is false for a blank story and for the exact old seeded story. `getHome` does not send that text.
- `isUnapprovedSeedShipping` rejects the old post, tipax, and manual price pairs. Checkout listing, quote, and order placement skip them. With no publishable method, checkout says shipping is not configured instead of showing 0 toman as a fee.
- Content desk can save real contact details (`applyStoreProfile`). Offers desk can still save a real shipping method (`applyShippingDraft`).
- Demo shipping and FAQ page copy no longer states a free-shipping threshold or invented carrier fees. The sample about page is still inserted only when `SEED_DEMO=1`.

Existing database rows are not deleted.

### Files

Added: `src/lib/public-profile.ts`, `src/lib/public-profile.test.ts`, `src/lib/public-shipping.ts`, `src/lib/public-shipping.test.ts`, `src/components/site/contact-lines.tsx`, `src/server/db/baseline-public.test.ts`, `scripts/contact-lines.test.mjs`.

Edited: `src/server/db/seed.ts`, `src/server/db/seed-data.ts`, `src/server/db/seed-safety.test.ts`, `src/components/site/shell.tsx`, `src/components/site/contact-form.tsx`, `src/components/site/home-view.tsx`, `src/components/site/checkout-view.tsx`, `src/components/site/content-desk.tsx`, `src/server/storefront/api.ts`, `src/server/commerce/checkout.ts`, `src/server/cms/content.ts`, `src/server/cms/api.ts`, `src/server/offers/admin.ts`, `src/lib/cms-types.ts`, `package.json` test script, and the docs listed in the continuity file.

### Tests executed

Correction gate, `DATABASE_URL` unset:

```text
env -u DATABASE_URL npm test
```

PASS — EXECUTED. Exit 0.

| Group | tests | pass | fail |
|---|---:|---:|---:|
| `node --test scripts/**/*.test.mjs` | 205 | 205 | 0 |
| `node --experimental-strip-types --test` (package.json app list) | 140 | 140 | 0 |
| alias-register database tests, including `baseline-public.test.ts` | 24 | 24 | 0 |

```text
npx tsc --noEmit
npx eslint . --quiet
env -u DATABASE_URL npm run build
```

All three PASS — EXECUTED. Exit 0. The build did not migrate.

| Test | Result |
|---|---|
| `empty and sample contact values produce no public rows or links` | PASS — EXECUTED |
| `an explicit contact profile is rendered with real links` | PASS — EXECUTED |
| `contact lines render nothing clickable until a real value is saved` | PASS — EXECUTED (`renderToString`) |
| `invented baseline shipping prices are not publishable` | PASS — EXECUTED |
| `fresh baseline publishes no sample contact, shipping price, or brand claim` | PASS — EXECUTED on disposable PGlite, including an admin profile save and a shipping-method save |
| `production initialization stores no demo products or coupons` | PASS — EXECUTED. Shipping count is now 0 |

### Not executed

| Check | Label | Why |
|---|---|---|
| Multi-connection PostgreSQL | NOT EXECUTED | Still no Postgres server |
| Browser click-through of the new contact form | NOT EXECUTED | Contact rendering was `renderToString`, not a browser session |
| Automatic cleanup of an already-seeded production database | NOT APPLICABLE | Explicitly out of scope. Rows are not deleted |
| `npm ci` | NOT EXECUTED | Lockfile was not changed |

### Ready for review

The correction ZIP is ready for the owner to review. It is not approved until that review. It is not a claim that the shop can take payment.
