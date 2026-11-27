# Batch 06 Report — Product Management, Product Media, Dynamic CMS & Magazine

**Date:** 2026-11-19. **Source:** owner-supplied, complete `SHAHOO-v1.0.0-batch05-customer-account.zip`, extracted to a separate workspace. **Status:** Batch 06 implementation is complete in source and packaged for owner review. Stop and wait for approval; Batch 07 was not started. No production database, provider, bucket, or real customer data was used.

## What changed

### Products, variants and storefront detail

The existing product editor now loads and saves the supported product fields already present in the schema: Persian and optional English names, category, slug/SKU, subtitle, short/full description, publication state, primary image URL, feature flags, homepage title/subtitle, origin, ingredients, usage/storage instructions, SEO title/description, oil-guide values and sorted specification rows. Optional facts remain blank unless staff enter them; no ingredients, origin, certification, benefit, expiry date, health claim or demo product content is generated. Empty homepage title falls back only to the product name. English product name remains optional.

The existing variant model and stock/cart paths are preserved: volume, weight and custom units; amount; SKU; Toman price; compare-at price; active/inactive state; default selection; existing inventory references. Saved variants are deactivated rather than deleted, with the existing Persian historical-reference explanation. Product save validates and writes its specification rows in the existing transaction. The storefront detail now displays the available image gallery, stored product facts and specs, clearly marks the selected active variant, displays the selected SKU and measured amount where stored, updates variant price/availability, and sends the selected variant ID through the existing server-authoritative cart action. Empty optional detail blocks are omitted. Image URLs and alt text are validated/rendered through existing safety rules.

### Product gallery and media

The existing normalized `product_images` / `media_assets` model is used; no JSON URL array or storage architecture was added. Staff can choose existing registered media as the primary image or an extra image, promote an attached gallery item to primary, reorder the complete gallery using up/down buttons, and detach a non-primary association. Reorder requires the exact current ID permutation while locking the product and image rows, updates order in a transaction and writes an audit entry. Detach removes only the product-image relationship, not the shared media record. Existing media locking and retirement rules remain in force.

The CMS Media tab exposes the project’s HTTPS image URL registration flow and server-side URL validation. The inactive binary upload controls were removed from this screen. This batch did not configure or enable binary upload, local production storage, S3, R2 or another object store. Existing local-upload modules in the accepted source were not expanded or configured; their deployment behavior still requires separate review. `byte_size` and registered external media behavior remain as already defined by the source.

### CMS pages, menus, banners and homepage

Authorized staff can create CMS pages in the existing `site_pages` table. New pages are draft by default and use `/pages/{slug}`; existing fixed-route page slugs remain immutable. The new SSR route returns only published pages, uses the existing plain-text renderer, and sets SEO and canonical metadata. Existing pages remain editable with title, body, SEO and publication state. Page creation writes its audit in the same transaction.

Existing section, banner and menu editors remain database-backed. Section/menu/banner ordering continues to use buttons and server-validated permutations, not drag-and-drop. Public header/footer menu data, banner image associations, schedule/activation, destinations and homepage section rendering use the existing models. Approved Batch 04 section IDs/copy, migration 0010 behavior, carousel indicators/reduced-motion/interaction pauses, logo assets and empty-product states were not replaced. Banner deletion remains unavailable; staff can deactivate a banner, avoiding unsafe deletion of referenced content. No new demo banners, menu items, articles, products or business content were seeded.

Page and article bodies remain plain Persian text. Blank lines separate paragraphs; HTML is not executed. This preserves the current stored format and avoids stored-XSS behavior; no rich-text dependency or second CMS model was introduced.

### Magazine and article SEO

Article admin drafts now include explicit SEO title and description backed by the existing article columns. Blank SEO inputs fall back to the owner-supplied title/excerpt; unsafe markup is rejected by existing text validation. The public article detail uses these values for browser metadata, displays reading time and registered cover alt text, and retains category, related products and author information. The existing published-only filters remain. A Persian empty state is shown when no published articles exist. No sample article or medical/therapeutic content was added.

### Bounded media/content lists

CMS article and media queries and the product media chooser are capped to the 100 newest records. The CMS article/media lists and product picker have local text filters. There is no server-side pagination/load-more control in this batch; records older than the latest 100 are not selectable through these lists and must be surfaced in a separately approved pagination follow-up if needed.

## Authorization, integrity and migrations

Mutations continue to use the existing `content.write` or `catalog.write` permission checks through `requireAdmin`; no permission was added or broadened. Catalog content/variant/image changes and CMS create/edit/reorder actions retain server validation and the existing audit architecture. New page creation and gallery reordering write their audit in the same database transaction as the data change. Variant IDs, inventory/order references, media sharing rules and admin RBAC were not removed or bypassed.

**Schema policy:** no migration was added and no existing migration was edited. Migrations `0001`–`0011` remain unchanged. Existing tables and columns support the delivered fields, including `product_specs`, `product_images`, article SEO columns and page slugs. No production migration, database seed, deployment or storage configuration was run.

## Verification

All PGlite tests ran in fresh in-memory databases with no production database. Statuses follow the project’s reporting policy.

| Check | Result |
|---|---|
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/cms/content.test.ts` | **EXECUTED — PASS, 12/12.** Includes page creation/fixed-slug protection, article SEO persistence/rejection, exact gallery reorder/audit, shared-media detach safety and existing CMS regressions. |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/catalog/admin.test.ts` | **EXECUTED — PASS, 5/5.** Parser validation plus full-migration PGlite product create/edit persistence, specification/SEO updates, existing variant and stock preservation, historical-variant omission refusal, audit count and `catalog.write` permission denial. |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/commerce/batch02.test.ts src/server/commerce/checkout-safety.test.ts src/server/commerce/correction.test.ts src/server/account/addresses.test.ts src/server/account/account.test.ts src/components/site/account-wiring.test.mjs` | **EXECUTED — PASS, 41/41.** Existing cart/checkout/stock/payment/refund/media, account/address/order and account-navigation regressions. |
| `node --experimental-strip-types --test src/server/catalog/rules.test.ts src/lib/cms-rules.test.ts src/lib/home-carousel.test.ts src/lib/media-bytes.test.ts` | **EXECUTED — PASS, 16/16.** Product validation, CMS link/media rules, Batch 04 carousel behavior and media byte checks. |
| `npx tsc --noEmit --checkJs false` | **EXECUTED — PASS** for TS/TSX after TanStack route generation. JavaScript checking was deliberately disabled for this scoped pass. |
| Targeted `npx eslint` over changed catalog, media, CMS, storefront, route and test files | **EXECUTED — PASS** after removing the one unused import; no errors or warnings in the final run. |
| Temporary local-only Vite route plugin | **EXECUTED — PASS, route registration only.** Generated route tree contains `/pages/$pageSlug`. A GET for an unpublished/nonexistent test slug returned 404 as expected; this is not a browser/UI E2E test. `DATABASE_URL` was unset for the temporary server. |
| Full `npx tsc --noEmit` including JavaScript, full `npx eslint .`, `npm test`, production build, full browser E2E, mobile/desktop/accessibility | **NOT EXECUTED — ENVIRONMENT LIMITATION / deferred to Batch 08.** The prior Batch 05 report documents an unchanged `.mjs` TS7006 in `cart-wiring.test.mjs`; the unfiltered command was not rerun in this batch. |
| Real PostgreSQL migration, separate-connection concurrency, Production migration/deployment, backup/restore | **NOT EXECUTED — ENVIRONMENT LIMITATION / deferred to Batch 08 and authorized infrastructure.** PGlite is not PostgreSQL concurrency proof. |
| SMS, payment gateway, carrier, object-storage provider | **NOT APPLICABLE.** Explicitly out of scope; no external calls were made. |

## Known limitations and Batch 08 risks

- CMS and catalog media/article selections expose only the 100 newest records, with client-side filtering but no pagination. Add pagination if actual library size requires access to older records.
- New CMS-created pages have `/pages/{slug}` paths. Existing root/fixed pages cannot change slugs; no broad root catch-all route was added.
- Page/section/article/product descriptions remain plain text. HTML and rich-text headings/lists are not supported by the current model.
- Banner deletion is not offered; deactivation is the safe supported action. Verify the desired admin workflow with the owner before adding deletion.
- No visual browser smoke, keyboard/screen-reader audit or mobile viewport interaction was executed for the new product/CMS UI. Run those in Batch 08.
- The existing source contains local-upload code from earlier work; Batch 06 did not expose a binary-upload form in the CMS, enable persistent production storage or configure a provider. Review that existing endpoint against the owner’s upload/storage policy before any deployment.
- Full JavaScript-aware project typecheck, full lint/test suite and production build remain Batch 08 work. No PostgreSQL or Production behavior is certified by this report.

## Handoff

The complete source package is for owner review. Do not begin Batch 07 until the owner explicitly approves Batch 06 and provides the authorized Batch 07 scope. Preserve all Batch 00–06 records and migrations. Batch 07 is reserved for admin orders, customers, inventory and related workflows; do not start it as part of this task. Batch 08 remains responsible for comprehensive verification and release readiness. Batch 09 SMS.ir/PayPing remains after Batch 08 and separate owner approval.
