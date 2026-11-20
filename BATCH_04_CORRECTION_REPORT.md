# Batch 04 correction report — Production homepage sections

**Date:** 2026-11-19

**Status:** The missing Production homepage-section initialization is corrected in source. One clean correction archive is prepared for owner review. No real Production database, publish action, or later batch was used.

## 1. Root cause

The accepted Batch 04 source was inspected directly. `seed.ts` splits the empty-store baseline from demo content: `insertBaseline()` provisions settings and SMS templates but no `homepage_sections`; all sample homepage sections are inside `insertDemo()`, which is excluded in Production. `readyDb()` calls `ensureSeed()`, but that baseline initializer does not repair homepage sections. The CMS loads and edits existing section rows, and has no section-creation form. `getHome()` reads active section rows from `homepage_sections`, so a fresh Production database could have no product-section records to render.

The production migrator is explicit by project design: `npm run db:migrate` applies ordered migrations under an advisory lock; Production also requires `DATABASE_URL` and `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`. The app does not automatically run SQL migrations on Production startup, and the build does not migrate.

## 2. Exact implementation

Added `migrations/0010_batch_04_home_sections.sql`. It declares the three approved product section types and their Persian title/description defaults, then inserts only those types absent from `homepage_sections`. The canonical fresh-install IDs are `sec-best`, `sec-new`, and `sec-offers`, matching the existing demo-seed identifiers. `section_type` is the structural idempotency key, so an existing CMS row with a non-canonical ID is retained rather than duplicated.

The migration does not update existing rows or reset their title, subtitle, body, activation, order, configuration, ID, or relationships. Missing sections append after the current maximum `sort_order`; a fresh empty table gets the three sections in their approved order. It inserts no products, product associations, customers, orders, banners, coupons, contact information, or other invented business data. Its configuration uses the existing dynamic flags (`best`, `newest`, `offer`) and a four-item limit, not product IDs. The deleted `featured_products` / «برگزیده‌ها» section is not inserted. Historical migration 0009 was not modified.

No production fallback or demo-seed dependency was added. The existing ordered migration discovery picks up `0010` automatically.

## 3. Homepage and CMS behavior

The CMS remains the existing database-driven editor. It loads stored sections and already allows an administrator to change title, subtitle/description, body, activation and ordering. `applySectionOrder()` preserves the full current row set and updates only its order. Creating the fixed structural rows through a migration avoids expanding the CMS.

The public homepage continues mapping active section records from `getHome()` into `HomeView`; section type, configuration, product selection and order still come from the database. The existing public filter continues suppressing the removed featured section. Product cards are still selected using the current section flags and product sort fields. When no matching products exist, the section now presents a small Persian empty state instead of disappearing or throwing. This allows the migrated titles/descriptions to render on a fresh empty catalog without fabricating products or associations. No carousel, cart-drawer, unrelated homepage, brand, or RTL behavior was changed.

## 4. Production initialization behavior

On a fresh or existing Production database, run the project's standard migration command before serving the updated application. The migrator applies `0010` after `0009`; subsequent calls are harmless because rows of an existing `section_type` are left untouched. The normal Production seed can then run with demo disabled and continues to leave the catalog, banners and other demo fixtures empty. Existing administrator section IDs and edits remain available to the CMS.

The behavior is dependent on migrations being applied as required by this app's existing deployment convention; there is intentionally no risky startup-time schema mutation. No real database was migrated for this correction.

## 5. Focused source-level verification

All database tests below used new in-memory PGlite instances; no application, hosted, customer or Production database was connected.

- **EXECUTED — PASS:** `node --experimental-strip-types --import ./scripts/ts-alias-register.mjs --test src/server/db/seed-safety.test.ts` — 3/3 passed. The new fresh-install case applied the ordered migrations, called `seedFoundation(db, { demo: false })`, confirmed the exact three types/IDs/copy/configuration and order, then reapplied the migration/initializer. Product, customer, order, coupon and banner counts remained zero; no demo seed marker or featured-product section was created.
- **EXECUTED — PASS:** The same focused PGlite file's partial-existing-install case preserved a non-canonically identified customized best-seller section, its inactive state/configuration/order and unrelated CMS rows; created only the two missing types at the end of existing order; and kept the unrelated row that occupied canonical ID `sec-offers`, assigning the new offer section a deterministic unused fallback. It then preserved an administrator edit after applying migration 0010 twice more. Each required type remained single-instance. A pre-existing legacy «برگزیده‌ها» record was retained, not recreated or deleted.
- **EXECUTED — PASS:** `node --test scripts/frontend-source.test.mjs` — 10/10 passed, including checks that the homepage reads CMS sections/products and renders the Persian empty-product message.
- **EXECUTED — PASS:** `node --experimental-strip-types --test src/lib/cms-rules.test.ts` — 9/9 passed, including the rule that suppresses legacy «برگزیده‌ها» without hiding unrelated featured sections.
- **EXECUTED — PASS:** An isolated Node assertion against `pendingMigrations()` confirmed the current migrator discovers only `0010_batch_04_home_sections.sql` after migrations 0002–0009 are marked applied.
- **EXECUTED — PASS (source inspection, not a browser test):** `getHome()` loads active DB rows; `HomeView` maps section order/types and uses the existing flags/limit selection; CMS code loads and saves title, subtitle, body, activation and order. Fresh sections with no matching products now render the empty state.

## 6. Deferred verification

**NOT EXECUTED — DEFERRED TO BATCH 08:** Full TypeScript typecheck, ESLint, complete `npm test`, production build, actual PostgreSQL migration execution, multi-connection/race testing, hosted/Production database migration, browser/E2E, live CMS editing, mobile/desktop layout, keyboard/screen-reader/accessibility review, and end-to-end CMS/storefront behavior. The PGlite cases prove isolated migration behavior only; they are not PostgreSQL concurrency proof or production migration evidence.

## 7. Remaining risks and operational notes

- Production does not auto-apply schema migrations. A deployment that skips the required `npm run db:migrate` step will not receive the records; follow the normal guarded migration procedure before serving the application.
- If a database already contains duplicate rows of one of the required section types, this migration will not add more or consolidate old rows; manual data review may be needed. The CMS itself does not create sections.
- If a canonical ID is occupied by an unrelated section type while its required type is absent, the migration selects the first free deterministic `shahoo-home-<section_type>-<n>` fallback ID. It leaves the unrelated row untouched; a focused PGlite case covers this collision.
- Until real products are added and match the configured product flags, the homepage shows each active section's title/description and the empty state. No fake product data is added.
- Existing legacy migration 0009 remains unchanged. It retains its prior audit guard for exact recognized seed copy; this correction adds no edits to existing section rows.

## 8. Scope and delivery

Only the production homepage-section provisioning path and its direct empty-state behavior were changed. Batch 05, Batch 09, payments, customer accounts, catalog management, shipping, SMS, and unrelated homepage work were not started. The updated project inventory and final ZIP count/checksum are in `FILE_INVENTORY.md` and the delivery summary.
