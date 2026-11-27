# Batch 05 Report — Customer Account, Profile & Address Management

**Date:** 2026-11-19. **Source:** user-supplied `SHAHOO-v1.0.0-batch04-correction.zip`, extracted to a separate workspace. **Status:** implementation complete, packaged for owner review; stop here and await approval. No Batch 06 work was started.

## Implemented

- Refactored the signed-in customer account into the five requested Persian sections: personal information, order history, saved addresses, account settings and contact. The tab-like links use direct nested routes, active-page state, small-screen two-column layout and desktop five-column layout. Removed the customer ticket/support and duplicate wishlist account entries. Existing header wishlist functionality and all administrative support/ticket backend routes/tables were preserved.
- Added self-service first/last name and optional gender and age-group fields. The OTP customer mobile remains immutable through this action. Server validation normalizes names and validates optional enums, derives the customer identity from the existing authenticated session, and does not accept a browser-supplied customer ID. Empty optional answers are supported; no date of birth or demographic default is stored.
- Added migration `0011_batch_05_customer_account.sql`: nullable demographic columns, normalized-name columns, and saved-address recipient name/mobile columns with empty legacy-compatible defaults. The migration preserves customer/address rows, deterministically removes duplicate active-default flags before creating a partial unique index, and applies enum constraints. Existing migrations are untouched.
- Completed address CRUD with recipient name/mobile, province, city, complete street, postal code, plaque and unit. Mutations remain authenticated, owner-filtered, transactional and audited; row locking serializes default/delete operations. Setting a default replaces the old one; deleting a default selects a remaining live address consistently. Legacy addresses with blank recipient details remain usable through authenticated checkout fallbacks. Checkout pre-fills saved recipient details and submits the server-owned saved location; changing to a new address clears stale values.
- Kept customer order history scoped to the authenticated customer and bounded to 20 results. Summaries expose Persian order/payment labels rather than raw lifecycle values and omit the delivery mobile. Existing customer order-detail access checks remain in place; staff shipment/event notes are not projected to customers. Unit price was added to order-detail display; no customer status, payment, cancellation or refund mutation was added.
- Added aggregate demographic reporting under the existing `reports.read` permission. Percentages use only recognized non-empty responses as the denominator; missing counts are separate. The report returns categories and counts, never individual customer records.
- Account address loading now has explicit loading/error/retry behavior, and destructive deletion retains its existing confirmation interaction. Verified store contacts are read from configured store profile values; unsupported ticket/security controls are not fabricated.

## Routes, components and APIs

New direct child route files: `src/routes/account.orders.tsx`, `account.addresses.tsx`, `account.settings.tsx`, and `account.contact.tsx`. `/account` remains the parent/profile route. Main UI changes are in `src/components/site/account-panel.tsx`, `address-book.tsx`, `checkout-view.tsx`, `order-view.tsx`, and `admin-pages.tsx`.

Server-side changes are in `src/server/auth/customer.ts`, `auth/api.ts`, `auth/sessions.ts`, `account/addresses.ts`, `commerce/orders.ts`, and `admin/desk.ts`. Shared types and validators are in `src/lib/session-types.ts`, `commerce-types.ts`, `admin-types.ts`, `address-rules.ts`, `customer-profile.ts`, `customer-demographics.ts`, and `order-display.ts`. Migration and schema are `migrations/0011_batch_05_customer_account.sql` and `src/server/db/schema.ts`.

## Security and compatibility

The customer principal remains session-derived. Address read/write queries filter by customer ownership; order history filters by authenticated customer ID; order detail retains existing authorized lookup. Profile update validates a strict allow-list, not mass assignment. Demographic information is optional and only aggregate reporting is exposed. Existing OTP identity, auth flows, checkout, price/stock calculations, payment rules, wishlist migration, admin RBAC, support backend and historical rows were preserved. No network/provider call or production database operation was made.

## Verification

All commands below ran in the isolated sandbox with no `DATABASE_URL`; in-memory PGlite only where noted.

| Check | Result |
|---|---|
| `node --experimental-strip-types --test src/lib/customer-profile.test.ts src/lib/customer-demographics.test.ts src/lib/order-display.test.ts src/lib/completion-rules.test.ts src/server/commerce/pricing.test.ts` | **Executed — Passed, 20/20** |
| `node --experimental-strip-types --import ./scripts/ts-alias-register.mjs --test src/server/account/addresses.test.ts src/server/account/account.test.ts` | **Executed — Passed, 4/4**, fresh in-memory PGlite and migrations through 0011 |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/commerce/checkout-safety.test.ts src/server/completion/flow.test.ts` | **Executed — Passed, 19/19** |
| `node --test src/components/site/account-wiring.test.mjs` | **Executed — Passed, 2/2** |
| Targeted `npx eslint` over edited Batch 05 TS/TSX and tests | **Executed — Passed** |
| `npx tsc --noEmit --checkJs false` | **Executed — Passed** for TS/TSX; JavaScript checking deliberately disabled for this scoped run |
| `npx tsc --noEmit` | **Executed — Failed due to existing/unmodified `src/components/site/cart-wiring.test.mjs:5` implicit `any` parameter (`TS7006`)**. No Batch 05 TS/TSX errors remained; this was not suppressed or “fixed” by changing unrelated existing code. |
| Temporary local-only `vite dev` route generation and `GET /account` | **Executed — Passed**; HTTP 200 and generated tree included all four direct child routes. `DATABASE_URL` was unset, so the preview used the non-production local DB path. |
| Real PostgreSQL migration, production migration/deploy, full project lint/test/build, full browser E2E, mobile/responsive/keyboard/screen-reader audit, backup/restore | **Not executed — deferred to Batch 08 / environment authorization** |
| SMS, payment gateway, carrier, object storage | **Not applicable — explicitly out of scope; no calls made** |

The earlier first checkout regression invocation using Node `--experimental-strip-types` failed at Node’s unsupported TypeScript parameter-property syntax before executing that test file; it was rerun with `--experimental-transform-types` and passed. This command correction is recorded to avoid overstating evidence.

## Known issues and deferred work

- Migration 0011 has only been exercised in isolated PGlite, not real PostgreSQL or a production-like upgrade. Review and run the guarded standard `npm run db:migrate` only on an authorized database, after backup/restore planning; production additionally requires its existing safeguards. The migration deterministically retains the first existing default by `created_at, id` when legacy duplicate live defaults exist.
- Run Batch 08 full TS/JS typecheck, full ESLint, full project suites, production build, authorized real-Postgres migration and concurrency review, browser E2E, responsive and accessibility checks, plus regression review of Batch 04 cart/carousel. The repository-wide TypeScript command currently has the above unchanged MJS test error.
- Account settings deliberately expose logout only; there are no supported session-revocation, password reset, or OTP-setting controls to implement. Contact channels appear only when already configured. No support-ticket customer UI is provided.
- Customer order history is bounded to the latest 20; pagination was not added because an established account pagination contract does not exist. Evaluate pagination if actual customer order volumes require it.
- A full view-level browser test for confirmation, loading/error states and narrow viewport overflow remains part of Batch 08.

## Batch 06 prerequisites and handoff

No Batch 06 work is started. The next agent should begin only after owner approval of this ZIP, inspect this report and the canonical master context, preserve migration `0011` and existing Batch 00–05 work, and follow the separately authorized Batch 06 brief. Run comprehensive verification on an authorized safe environment before deployment. Do not enable SMS.ir, PayPing or any other provider; Batch 09 remains after Batch 08 and separate owner approval.
