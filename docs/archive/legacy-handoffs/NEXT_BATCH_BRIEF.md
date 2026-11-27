# SHAHOO work briefs

## After PR #11 — 2026-11-25

Review and run the follow-up schema checks when authorized, gather the remaining Preview evidence and record the approved Production migration and target recovery plan. Each item has acceptance criteria in the [release milestone](https://github.com/shahoo-workspace/shahoo/milestone/1). [Issue register](REMAINING_ISSUES.md)

## Historical batch briefs

This file preserves proposals and instructions from previous batches. They are not current authorization to begin work. For current priorities, blockers, and the no-repeat roadmap, read [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) and [REMAINING_ISSUES.md](REMAINING_ISSUES.md). See [docs/README.md](docs/README.md) for the documentation map.

---


# Next Batch Brief — Batch 06 delivered; wait for owner review

## Current roadmap (2026-11-19)

Batch 06 product management, media associations, dynamic CMS pages and magazine SEO are implemented and delivered in `SHAHOO-v1.0.0-batch06-product-cms.zip` for owner review. No migration was added; `0001`–`0011` are preserved. Read `BATCH_06_REPORT.md` and `docs/CMS_MEDIA.md`. **Do not start Batch 07 until the owner explicitly approves Batch 06 and supplies/approves its scope.** Batch 07 is reserved for admin orders, customers, inventory and related workflows. Batch 08 remains comprehensive verification/release hardening; Batch 09 SMS.ir/PayPing is after Batch 08 and separate owner approval. All proposals below are historical, not current authorization.


> 2026-11-18: Batch 04 starts only after the owner approves the Batch 03 correction. Batch 03 (frontend reliability) and its correction pass are delivered and await owner review. (Earlier note, 2026-11-18: Batch 03 delivered and awaiting review.) Before Batch 04: run tsc, eslint, `npm test`, build and a browser pass (see `LATEST_HANDOFF.md`). Batch 04 per the roadmap: homepage sections (پرفروش‌های شاهو / تازه‌های ماه / پیشنهادهای ویژه), hero carousel, header cart drawer, gold hover language. Reuse `useGuardedAction`, `createLatestGate` and the wishlist scope rules. The text below is the older Batch 03 proposal, kept as history.

# (History) Batch 03 proposal

> 2026-11-17: the Batch 02 correction is delivered and awaits owner review. Before any Batch 03 work, run `npm ci`, `tsc`, `eslint`, `npm test` and `scripts/pg-media-race.sh` (see `LATEST_HANDOFF.md`) and fix anything the never-executed `correction.test.ts` reveals.

Theme: **existing UI, routes, and frontend correctness**. No live gateway, no homepage redesign beyond what this batch already lists, no cart-drawer rebuild, no account demographics.

Batch 02 is implemented and waiting for owner review. This file is a proposal, not permission to start.

## Suggested scope
From the approved roadmap (`SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` section 7):

1. Remaining nested route and page rendering issues not handled in Batch 01.
2. User feedback states: loading, empty, and error.
3. Media upload behavior and storage assumptions on the screens that already exist. Do not add cloud storage. Keep the Batch 02 rule: do not delete a file that is still referenced, and do not delete a file before the database commit.
4. Wishlist cache isolation between accounts.
5. Cart error handling on the existing cart page. Do not redesign the cart or add the header drawer (that is Batch 04).
6. Contrast and accessibility improvements that do not change the brand palette.
7. Logo and image optimization that does not redraw official rasters in `public/assets/brand/`.
8. Responsive checks.

## Still open, but not this batch unless the owner pulls them forward
- Multi-connection PostgreSQL concurrency of the TypeScript code (media locking was proven at SQL level only in the correction; cart/checkout/payment races still not on real PostgreSQL).
- Guest checkout throttle and a hold-expiry scheduler.
- Gateway reconciliation if a real charge succeeds and stock recovery fails.
- Real payment, SMS, and shipping providers.

## Out of scope
Zarinpal, Zibal, IDPay, Kavenegar, SMS.ir, shipping APIs, cloud buckets, header cart drawer, hero carousel redesign, gold hover, gender/age profile, loyalty, wallet, subscription, B2B, extra warehouses, and the homepage section rewrite (Batch 04).

## Acceptance
- Start only after the owner approves `SHAHOO-v1.0.0-batch02.zip`.
- Read `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` and re-check the source.
- Do not weaken Batch 01 production guards or Batch 02 cart, payment, refund, hold, and media rules.
- No new dependency and no version bump without a demonstrated need.
- Update the same master continuity file. Deliver one clean ZIP. Stop.
