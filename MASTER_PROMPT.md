> **Revision 02.1 continuity notice (2026-11-19):** The content below is a historical snapshot, not current release or next-batch authorization. The latest completed remediation is Batch 08 Revision 02; current work is Batch 08 Revision 02.1. Release is **NOT READY FOR RELEASE**, final approval is pending, and Batch 09 has not started. For current evidence and actions, read `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `REMAINING_ISSUES.md`, `BATCH_08_FINAL_RELEASE_EVIDENCE.md`, and `docs/PRODUCTION.md`. Historical “checkpoint” numbering is not authorization for Batch 09.

---

# SHAHOO — master development prompt

Saved for later checkpoints. This is the owner brief. Batch numbering below is the original plan. The repository already diverged: batches 04–06 shipped catalog, offers, and CMS before this redesign. v0.9.0 then completed addresses, wishlists, reviews, support, fulfillment, local upload, notices, and provider seams. Payment capture stays blocked until real merchant credentials exist. Do not restart completed work.

## Goal

Rebuild the existing SHAHOO beta into a real Persian RTL store for Iran. The owner must change products, content, images, and everyday appearance from the admin desk, not by editing source. Official logos stay. Do not draw a replacement mark.

Palette: forest `#173D28`, deep `#1A3522`, gold `#B69755`, light gold `#E5C985`, cream `#F7EFDF`, ivory `#FFF9EE`, ink `#29291F`. Fonts: Vazirmatn and Cinzel.

Money is integer IRR in the database and toman in the UI. No floating money. No fake orders, reviews, or demo passwords. Secrets stay in environment variables, never in the client or in git.

## Original eight batches

Each batch is exactly three stages, then a checkpoint, then stop until the owner names the next batch.

| Batch | Stages | Subject |
| --- | --- | --- |
| 01 | 1–3 | Audit, architecture, PostgreSQL and Drizzle |
| 02 | 4–6 | Customer OTP, admin roles, server security and audit |
| 03 | 7–9 | Products, variants and stock, cart and orders |
| 04 | 10–12 | Iranian gateways, payment verify, shipping and SMS architecture |
| 05 | 13–15 | Admin dashboard, catalog and orders desk, reports and staff |
| 06 | 16–18 | Homepage builder, banners and header/footer, pages and magazine |
| 07 | 19–21 | Storefront design: home and menus; catalog, product, cart, checkout; account, tracking, mobile, footer |
| 08 | 22–24 | SEO and speed, functional and security tests, production docs |

## Batch 08 — optimization and production

Stage 22. Dynamic titles and descriptions, canonical URLs, `sitemap.xml`, `robots.txt`, and JSON-LD for the organization, product, article, page, and breadcrumb. No star ratings. Prices in structured data stay IRR. Private routes are `noindex`. Product cards lazy-load remote images. Open Graph stays with the platform share card. Official logos are not redrawn.

Stage 23. Run the existing security, commerce, catalog, offer, CMS, and migration tests, plus SEO unit tests. Do not mark a test as passed unless it ran. Do not call a payment gateway to “prove” checkout.

Stage 24. Production notes in `docs/PRODUCTION.md`: environment names, what stays off without credentials, and backup duty (database host plus checkpoint archives). No `.env` file and no sample secrets.

Payments, SMS, object storage, and carrier APIs stay blocked. Do not start a batch after 08 unless the owner names new work.

## Batch 07 scope (closed)

Stage 19. Redesign the homepage and menus on the official identity. Content still comes from the database.

Stage 20. Redesign the catalog, product page, cart, and checkout. Prices and stock stay server-side.

Stage 21. Redesign the customer panel, honest order tracking, the mobile menu, and the footer. Do not show shipped or delivered until those states exist. Do not invent an e-trust badge.

## Still blocked

Modular payment providers, server-side verify, refunds, live SMS, and object storage. Do not pretend a mock gateway is live.

## Checkpoint rule

After each batch: typecheck, build, tests that were actually run, update `DEVELOPMENT_PROGRESS.md`, `PROJECT_HANDOVER.md`, `CHANGELOG.md`, and `TEST_REPORT.md`, commit, tag, and a zip that excludes `node_modules`, `.git`, secrets, and build caches. Do not overwrite older zips. Keep this file in later archives.
