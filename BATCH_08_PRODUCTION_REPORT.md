> **HISTORICAL DOCUMENT — not the current production status.** This report was written for an earlier build of the project (it names version `0.8.0`, before the current `1.0.0` source and the Batch 00–03 work recorded in `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`). Its statements about readiness, tests and configuration describe that older state and must not be used as current evidence. The roadmap's own "Batch 08 — Final testing, security and release readiness" is a future batch that has not been started. Original content is preserved unchanged below. Marked historical in the Batch 03 correction (2026-11-18).

---

# BATCH 08 — SEO, tests, and production notes

Version: v0.8.0. This is the last batch in `MASTER_PROMPT.md`.

## Stage 22

- `src/routes/sitemap[.]xml.ts` and `src/routes/robots[.]txt.ts` answer with XML and plain text. The dot is escaped so the router does not turn it into a slash.
- The map lists the shop, published pages, products, and articles. Admin, account, cart, checkout, orders, search, and wishlist are absent and marked `noindex`.
- Canonical links and JSON-LD use `APP_URL` when it is a real origin, otherwise the host of the request. Preview used `http://127.0.0.1:8080`. That is not a production domain.
- Product offers use IRR. There is no `aggregateRating`.
- Card images that come from an https URL use lazy loading. The hero file is still `/assets/brand/shahoo-logo-primary.png`.

## Stage 23

The application suite, the new SEO tests, and the 05.02 migration test passed in this batch. Counts are in `TEST_REPORT.md`. The platform share-card suite was not re-run. No gateway was called.

## Stage 24

`docs/PRODUCTION.md` lists empty environment names, the services that stay off, and backup duty. Migrations `0002` through `0005` were not edited. No SQL file was added.
