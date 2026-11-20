# Batch 00 Report — Source Verification & Baseline (inspection only)

Date: 2026-11-16 · Declared version: 1.0.0 · Application source, migrations, packages and tests: **unmodified**. Only documentation was added/updated (see §7).
Verification labels: **VERIFIED-STATIC** (read in source), **EXECUTED** (run here), **NOT VERIFIED** (could not run/observe).

## 1. Investigation performed
Full static read of the auth, commerce, payments, SMS, admin, media, CMS, support, SEO and security-header code, all migrations (0002–0007), build/deploy config and existing documents; targeted re-inspection for the Batch 00 issue list (§4). Not re-read where earlier analysis sufficed. No external service, no database other than the in-process test engine, and no browser was used.

## 2. Archive completeness
| Item | Result |
|---|---|
| `src/`, `server/`, `migrations/0002–0007`, `scripts/`, `public/` (incl. brand logos under `public/assets`), `package.json`, `package-lock.json`, `vercel.json`, `tsconfig.json`, `vite.config.ts`, docs, screenshots | present |
| `node_modules` | absent (expected) |
| `.grok/` | **absent** — 8 platform script tests need it (they fail without it) |
| `.env.example` | **absent** |
| `src/routeTree.gen.ts` | present (generated, committed) |
| Migration `0001_auth.sql` | **not in archive**; `scripts/migration-plan.mjs:9` refers to it as a platform migration (presumably Better Auth tables). Numbering therefore starts at 0002. Contents and whether the shop depends on it: NOT VERIFIED |
Conclusion: source is sufficient for development once dependencies are installed and `.grok/` is restored from the platform; not sufficient to run the platform test group.

## 3. Verified stack (from `package.json`)
React 19, TanStack React Start (`@tanstack/react-start`), Vite `^8.2.0`, TypeScript `^5.7.0`, Drizzle ORM, `pg` Pool (Neon) + `@electric-sql/pglite`, Tailwind 4, Zod, Zustand, `better-auth ~1.6.30`, `jpeg-js`, `jose`, Nitro `preset: "vercel"`; 60 production / 14 dev dependencies. Installed versions NOT VERIFIED (`npm ci` could not run).

## 4. Status of the ten required issues
| # | Issue | Status | Evidence | Next action |
|---|---|---|---|---|
| 1 | Production DB fallback to PGlite | **CONFIRMED** | `src/lib/db.ts:19`; `scripts/migrate.mjs:12,24` skips and build passes | Fail fast in production (Batch 01) |
| 2 | Production seed | **CONFIRMED** | `db/seed.ts:34-47`, called from `auth/db.ts:5`, `storefront/api.ts:100`, `report.ts:19`, `seo/paths.ts:9`; active coupons `SHAHOO10`/`ORGANIC20` (`seed.ts:279-295`) | Gate behind explicit dev flag |
| 3 | Dev/mock activation | **CONFIRMED (fail-open)** | `auth/crypto.ts:45-48` OTP echo; `payments/service.ts:43,64`; `security-headers.ts:13-19` all keyed on `NODE_ENV !== "production"` | Explicit opt-in flags |
| 4 | Cart atomicity | **CONFIRMED** | `checkout.ts:104-165`: cart read before the transaction (`resolveCart`), items re-read inside `insertOrder` (`:196-216`) without a lock, cart emptied at `:348`. Idempotency key stops only identical keys (unique `orders.idempotency_key`; conflict detected by regex on error text, `:452`). Two concurrent requests with different keys on the same cart can each create an order and reserve stock. Reproduction needs two connections: NOT EXECUTED | Lock/claim the cart row (`FOR UPDATE` or conditional `UPDATE carts SET checked_out…`) inside the order transaction |
| 5 | Checkout address persistence | **CONFIRMED (static)** | With `addressId`, server replaces form data with the saved address (`checkout.ts:111-126`) and stores that snapshot (`:279-287`); the UI keeps province/city/line/postal fields editable after choosing a saved address and sends them (`checkout-view.tsx:60-68,133-145`). Edits made in the form are silently ignored → shipped address can differ from what the customer saw. Browser behaviour NOT VERIFIED | Either lock the fields when a saved address is chosen or persist edits as a new address |
| 6 | Nested routes lack `<Outlet/>` | **CONFIRMED** | `routeTree.gen.ts` nests `admin.orders.$code` (`:770`), `admin.customers.$customerId` (`:763`), `account.support` (`:651`), `magazine.$articleId` (`:742`) under parents whose components (`admin.orders.tsx`, `admin.customers.tsx`, `account.tsx`, `magazine.tsx`) never render `Outlet` (grep: only `__root.tsx` and `admin.tsx` do). Children render blank/parent only. Rendering NOT EXECUTED | Convert parents to layout + index, or rename children out of nesting (`admin_.orders.$code`) |
| 7 | Admin bootstrap / access control | **PARTIAL** | `auth/admin-bootstrap.ts`: env-only first admin (hash, not plaintext); runs on every call and **re-activates** a suspended/deleted bootstrap admin and re-grants `role-super_admin` whenever env differs (`:46-63,66-76`). Per-function permission checks otherwise intact | Make bootstrap one-shot or explicit; document rotation |
| 8 | CSRF / cookies | **NOT REPRODUCED** | Cookies `HttpOnly`, `SameSite=Lax`, `Secure` in production (`auth/cookies.ts:11-30`); mutations are POST server functions; no Origin/Referer check or CSRF token exists in `src/server` | Add Origin assertion as hardening |
| 9a | Payment idempotency validation | **CONFIRMED** | `payments/service.ts:87-88`: a prior `verified` payment with the same `idempotencyKey` returns `{ok:true, already:true}` without checking it belongs to `input.orderId` or the same amount | Compare `orderId`/amount on replay |
| 9b | Reservation expiry | **CONFIRMED (design gap)** | Lazy sweep `commerce/holds.ts:13-35`, no cron; capture rejects expired orders (`service.ts:92`) → paid-after-expiry has no path | Scheduler + payment-pending state (later batch) |
| 10 | Partial refund handling | **NOT REPRODUCED (static)** | `fulfillment.ts:236-330`, `order-flow.ts` (`refundAmount`, `orderStatusAfterRefund`): ceiling under `FOR UPDATE`, partial → `partially_refunded`/`partial_refund_recorded`. Ledger only; refund permitted at return status `approved` (before receipt); returns never restock. DB-backed tests could not run | Verify with tests once PGlite is installed |
Not examined (open from earlier reports): cart merge/retry duplication (`adoptLocalCartFn`), media-deletion consistency, wishlist cache isolation → **UNVERIFIED**.

## 5. Commands and baseline
| Command | Executed | Result |
|---|---|---|
| Inspect `package.json` scripts | yes | `build` = `vite build && npm run db:migrate`; `db:migrate` skips when `DATABASE_URL` unset → safe locally only without that variable. Never run with a real URL |
| `npm ci --ignore-scripts` | yes | failed ("Exit handler never called"; no network); partial `node_modules` removed |
| `npx tsc --noEmit` | yes | exit≠0: TS2688, TS5102 (sandbox tsc 7.0.2 vs project `^5.7`) — environmental, not code evidence |
| `npx eslint .` | yes | exit≠0: `@eslint/js` not found — environmental |
| `node --test 'scripts/**/*.test.mjs'` | yes | **190 pass / 8 fail** of 198; the 8 need `.grok/` |
| App tests, per file, `node --experimental-strip-types --import ./scripts/ts-alias-register.mjs --test <file>` | yes | **56 pass, 0 assertion failures** in 13 files; 9 files fail at import (missing `@electric-sql/pglite`, `jose`, `jpeg-js`, `@tanstack/react-start`) |
| `npm run build` | **no** | needs packages; migration step inspected, not run |
Test classification — pass: the 13 pure files; fail: 8 platform tests (environmental); cannot run: 9 DB/dependency files; unrelated to app behaviour: platform script tests (PWA/preview/gate); missing for key scenarios: media upload/sanitizer, payment callbacks, customer order isolation, concurrent checkout, return restock, search, reports, nested-route rendering. No test was deleted, skipped or modified.
Prior claims "339/347 platform results, 4 SQL tests, tsc/lint/build passed" are **not reproduced**: the same 8 failures appear here, but the 347 total and the tsc/lint/build results could not be re-verified.

## 6. Differences between prior reports and source
- `REMAINING_ISSUES.md` said `better-auth` is unused because `VITE_AUTH_ENABLED` "stays false"; code treats the flag as enabled unless it equals `"false"` (`src/lib/auth/*`). Runtime reachability NOT VERIFIED.
- `TEST_REPORT.md` clean-console claim vs. production screenshot showing a missing logo (cause NOT VERIFIED; logo files exist in `public/assets`).
- `PROJECT_HANDOVER.md` "Known gaps" is stale vs `REMAINING_ISSUES.md`.
- `REMAINING_ISSUES.md` omitted: seed-in-production, cart race, address mismatch, missing Outlets, payment replay check, `NODE_ENV` fail-open, 5-digit OTP without cross-challenge lockout, catalog default 6,000,000-toman price cap (`storefront/api.ts:344`).

## 7. Documentation changed
Added: `PROJECT_STATE.md`, `BATCH_00_REPORT.md`, `LATEST_HANDOFF.md`, `NEXT_BATCH_BRIEF.md`. Updated: `REMAINING_ISSUES.md`. No other file touched. Old reports (`BATCH_08_PRODUCTION_REPORT.md`, `CLEANUP_PLAN.md`, `DEVELOPMENT_PROGRESS.md`, `MASTER_PROMPT.md`, `CLAUDE_REVIEW_README.md`, `FILE_INVENTORY.md`) were left as historical records.

## 8. Limitations
No network, no installed dependencies, no real Postgres/Neon, no browser. All "confirmed" items are static-source confirmations unless a row says executed. Concurrency and rendering findings must be reproduced in Batch 01 before and after fixing.
