# SHAHOO — Admin Platform Implementation Tracker

**Last updated:** 2026-11-20  
**Repository:** https://github.com/arefbrh/shahoo  
**Active implementation branch:** `feat/admin-catalog-ux-phase1`  
**Current phase:** Phase 1 — catalog reliability and operator clarity  
**Release posture:** NOT APPROVED. No Production promotion or merge authorization is implied by this tracker.

This is the canonical continuation note for the admin-platform work. Update it in the same pull request as meaningful implementation milestones. Keep facts, test evidence, and remaining work separate.

## 1. Owner's product requirement

The owner wants ordinary store operations to be performed entirely through the admin panel. A value should be edited once and then appear everywhere that consumes it: storefront, product pages, navigation, homepage, checkout, reports, and future channels. Repeated manual edits in source files are not acceptable for routine content and configuration.

The admin platform must remain portable across:
- Vercel deployments;
- Linux servers;
- Windows servers;
- Neon PostgreSQL;
- another supported PostgreSQL host;
- local/test execution using the repository's supported embedded test database.

**Portability does not mean every deployment can run without durable storage.** The application must expose a storage contract and provider adapters. A production deployment must use a durable, backed-up database. Neon is one provider, not a hard dependency in domain logic. PGlite is currently a development/test adapter and must not silently become a Production fallback. A future non-Neon PostgreSQL setup should work through standard PostgreSQL connection configuration and the same migrations. A file-based or embedded production adapter is a separate design decision requiring concurrency, backup, locking, and multi-process safety evidence before it can be supported.

## 2. Architecture rules

1. **Single source of truth:** admin writes canonical records/settings; storefront components read through shared server-side services. No duplicated constants for values already editable in admin.
2. **Provider independence:** business rules must depend on repository interfaces/services, not Vercel or Neon SDKs. Hosting-specific adapters belong at infrastructure boundaries.
3. **Durable production state:** production requires a durable database and persistent media storage. Never use ephemeral server filesystem storage for customer uploads.
4. **One write path:** validate at the API boundary, enforce authorization on the server, write related records in one transaction, and emit an audit event.
5. **No silent failure:** every mutation returns a safe, understandable result. Unexpected exceptions receive a correlation ID and server-side log entry; never expose SQL, credentials, stack traces, or provider internals to the browser.
6. **Data safety:** preserve order-time price snapshots and historical variant references; prefer archive/disable over destructive deletion; never seed demo records into Production.
7. **Environment separation:** Preview and Production use distinct databases and secrets. Database changes are not run against Production without explicit owner approval and a backup/recovery plan.
8. **Portable configuration:** environment variables configure infrastructure (database, storage, mail/SMS/payment providers, public origin). Store-specific content and merchandising settings belong in the database and admin panel.
9. **Test the real contract:** cover unit tests, PGlite behavior, disposable PostgreSQL integration/concurrency, and browser-level admin workflows. A green build alone is not sufficient.
10. **Document every handoff:** record branch/PR/commit, tests, deployment URL/state, DB target, changed files, known limitations, and exact next step.

## 3. Phase plan

### Phase 1 — Catalog save reliability and operator guidance
- [x] Create isolated branch from current `main`.
- [x] Add safe server-side handling for unexpected category/product mutation failures with correlation IDs.
- [x] Translate API schema failures into Persian field-level guidance.
- [x] Fix category form's missing exception handling and silent submission failure.
- [x] Add category required-field, slug, and sort-order validation before submission.
- [x] Add product/package field explanations and required-field cues.
- [x] Clarify that the product image must be a direct product image, not the site header logo.
- [ ] Run CI: typecheck, lint, build, project tests, PostgreSQL integration.
- [ ] Verify the generated Vercel Preview with the connected Preview database.
- [ ] Owner smoke test: create category, create draft product, add package/price, edit and reload.
- [ ] Close Phase 1 only after all evidence is recorded.

### Phase 2 — CMS and central brand/content controls
- [ ] Review and complete PR #7 (`feat/admin-brand-settings`); it is not merged.
- [ ] Add the CMS route to the admin navigation and ensure permissions are enforced server-side.
- [ ] Make banners, homepage sections, navigation, pages, magazine/articles, store profile/contact and brand settings discoverable from one admin information architecture.
- [ ] Complete carousel/slider, header and footer controls.
- [ ] Ensure public components read the same canonical settings and invalidate/cache-refresh consistently.
- [ ] Add preview/publish workflows and revision/audit history.

### Phase 3 — Media library
- [ ] Implement provider-neutral media storage interface.
- [ ] Support a persistent object-storage adapter for Vercel and a documented S3-compatible adapter for Linux/Windows hosting.
- [ ] Add upload, validation, MIME sniffing, size limits, safe filenames, image processing, alt text, preview, replacement, usage references and safe retirement.
- [ ] Never rely on local ephemeral disk for production uploads.
- [ ] Ensure product/category/banner/article/logo images share the same media library.

### Phase 4 — Admin dashboard and reports
- [ ] Add date-range controls and server-side aggregation.
- [ ] Add order counts, verified payment/refund ledger, revenue semantics, trend charts and top products.
- [ ] Clearly distinguish paid/verified internal ledger amounts from bank settlement.
- [ ] Add export and report filters; avoid presenting unverified payments as revenue.

### Phase 5 — Admin accounts and access lifecycle
- [ ] Create/invite admin, edit name/email, reset credentials, revoke sessions, disable accounts.
- [ ] Review roles/permissions and enforce them server-side on every mutation.
- [ ] Add last-login/activity/audit views and prevent accidental lockout of the final owner.
- [ ] Require secure one-time invitation/reset flows; never expose password hashes.

### Phase 6 — Store operations and polish
- [ ] Dedicated price/bulk-price management while retaining variant as canonical price owner.
- [ ] Customer/order/support/review/coupon/shipping/SEO/notification/provider configuration.
- [ ] Search, pagination, bulk actions, safe exports, loading/empty/error states.
- [ ] Responsive Persian RTL UI and accessibility review.
- [ ] Verify operational portability and deployment instructions for Vercel, Linux and Windows.

## 4. Current infrastructure facts

- GitHub repository: `arefbrh/shahoo`, default branch `main`.
- Vercel project: `shahoo`, project ID `prj_xG91Dq0QOMB5m4lUir3v9aiJpMC9`.
- Team ID: `team_qzgaQxkmfv6MsnBo4sDJ0LFU`.
- Public domain: `https://shahoo.vercel.app`.
- Last known Production deployment: `dpl_4StaaRhcXQoxCU78LfuoXgRbJMQK`, READY, source `main` at `cdaf98f8a162aa267a7ebf1f591ffe55c90e3f3a`. This deployment does not include the active branch changes.
- Neon Production project: `shahoo-production`, project ID `billowing-queen-40432154`, branch `production`, branch ID `br-curly-dust-ba1kq0xb`, database `shahoo`, role `shahoo_app`.
- Never copy connection strings, passwords, tokens, or hashes into this file.
- Never run migrations, seed, truncate, delete, or mutate Production data as part of routine feature work.
- Production catalog was previously verified empty (zero products/categories/variants). Re-check read-only before making claims; never seed demo data into Production.

## 5. Related open work

### PR #7 — central brand identity
- URL: https://github.com/arefbrh/shahoo/pull/7
- Branch: `feat/admin-brand-settings`
- Latest known head: `0518a803a600c8d316d4eb42eed141884f92d693`
- CI run: `44749203317`; all required jobs passed (Quality, Project tests, PostgreSQL integration/migrations, Security, migration inventory, Payment/SMS mocks). Private platform harness was skipped.
- Latest known Preview deployment: `https://shahoo-bmkzqtvtn-shahoo.vercel.app`, READY.
- Not merged. Review and integrate separately; do not silently merge it as part of Phase 1.
- Direct upload is not implemented by PR #7; it adds editable HTTPS/local asset paths.

## 6. Phase 1 implementation record

- Branch created: `feat/admin-catalog-ux-phase1`, based on `main`.
- API file changed: `src/server/catalog/api.ts`.
  - Added a safe Zod validation adapter that reports the first invalid field in Persian.
  - Added server-side catch/log wrapper for unexpected catalog mutation failures; browser receives a short correlation ID instead of internal error details.
- UI file changed: `src/components/site/catalog-desk.tsx`.
  - Category submission now has pending state, required-field/slug/order validation, try/catch, actionable errors and cancel-edit behavior.
  - Category field purposes and slug/order examples are explained.
  - Product and package fields show required indicators and practical examples.
  - Product image guidance explicitly says to use a direct image for that product, not the header logo.
  - Product save exceptions no longer collapse silently to a generic untraceable failure.
- Commits on the branch:
  - `df368c7be68bded15c4e7ebbbaa01d8c16f7f712` — API validation/error handling.
  - `2976facfef1717e88fe07512af58e014cce97772` — category/product form reliability.
  - Latest UI follow-up commit is recorded in GitHub branch history; update this section with its exact SHA before handoff.
- No database schema/migration changes in Phase 1 so far.
- No Neon data has been changed.
- No Vercel Production environment variables or Production deployment have been changed.
- Preview deployment and CI for this branch are pending at the time of this record.

## 7. Required handoff checklist

Before handing this work to another agent:
1. Read this file and `PROJECT_HANDOFF.md`.
2. Inspect the active branch and PR, not only `main`.
3. Verify the exact latest commit SHA and workflow run results.
4. Re-read any files the previous agent changed; do not trust a prose-only summary.
5. Keep Production untouched and keep demo seed disabled there.
6. Do not merge PRs or promote Production without the owner's explicit instruction.
7. Update this tracker with completed tasks, exact evidence, remaining blockers, and the next command/action.
