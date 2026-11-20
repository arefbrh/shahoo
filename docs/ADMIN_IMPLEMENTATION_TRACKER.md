# SHAHOO — Admin Platform Implementation Tracker

**Last updated:** 2026-11-20  
**Repository:** https://github.com/arefbrh/shahoo  
**Active implementation branch:** `feat/admin-cms-phase2` (stacked on `feat/admin-catalog-ux-phase1`)  
**Current phase:** Phase 2 — CMS, central brand/content controls, and admin usability guidance  
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
- [x] Run CI: typecheck, lint, build, project tests, PostgreSQL integration.
- [x] Verify the generated Vercel Preview with the connected Preview database.
- [x] Owner smoke test: owner confirmed successful admin login and that all tested catalog actions worked correctly.
- [x] Close Phase 1 implementation/testing checklist; PR remains unmerged pending explicit owner authorization.

### Phase 2 — CMS and central brand/content controls
- [x] Review and port the central brand settings implementation from PR #7 into the Phase 2 branch; PR #7 remains unmerged and separate.
- [x] Add the CMS route to admin navigation, gated by `content.write`; `/admin/content` retains its server-side permission check.
- [x] Make existing banners, homepage sections, navigation, pages, magazine/articles, store profile/contact and brand settings discoverable from the CMS desk.

- [ ] Complete carousel/slider, header and footer layout controls (brand name, tagline, copyright and header/footer logo URL settings are now present; layout controls remain).
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

### PR #7 — central brand identity (source implementation; not merged)
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
  - `8d1199ad52673cbdb90b794bc40ccfb5bafea9d0` — add required cues and examples for product/package fields.
  - `e3953720c1c6a18914153ab01ea4d0141db9570c` — add client-side product identity checks.
- No database schema/migration changes in Phase 1 so far.
- No Neon data has been changed.
- No Vercel Production environment variables or Production deployment have been changed.
- Latest Preview deployment: `https://shahoo-j3j1ndmtu-shahoo.vercel.app` (`dpl_Hg83VWXQBrzkjMYiqtKr2ijmvjb6`), READY for docs-updated branch head `66b799933ef22ce1c455ab754ab4b9389a987267`. The immediately preceding code deployment for `e3953720c1c6a18914153ab01ea4d0141db9570c` also reached READY.
- CI run `44761442398` applies to code head `e3953720c1c6a18914153ab01ea4d0141db9570c`: Quality (typecheck/lint/build), Project tests, PostgreSQL integration/migrations including contention and backup/restore, migration inventory, Security, and Payment/SMS mocks all passed. Manus private platform harness was skipped.
- Owner completed the Preview admin smoke test and confirmed that login and all tested catalog workflows worked correctly. This is owner-reported browser verification, not a claim that the private platform harness ran.
- Preview admin bootstrap deployment used for the owner test: `https://shahoo-47810kea7-shahoo.vercel.app` (`dpl_EqqjPtkXRD8yVN4krmf9n8Pa34jo`), READY, commit `0e0e5079672423c2945186ba61daf3fbda3c2316`.
- Vercel environment metadata confirms a Preview `DATABASE_URL` and Preview `SEED_DEMO` variable are configured (values not read); Production `DATABASE_URL` is separately configured. No secrets were retrieved.
- Read-only Neon Production check confirmed database `shahoo`, role `shahoo_app`, 52 public tables, and zero non-deleted categories/products/variants. No Production rows were modified.

## 7. Required handoff checklist

Before handing this work to another agent:
1. Read this file and `PROJECT_HANDOFF.md`.
2. Inspect the active branch and PR, not only `main`.
3. Verify the exact latest commit SHA and workflow run results.
4. Re-read any files the previous agent changed; do not trust a prose-only summary.
5. Keep Production untouched and keep demo seed disabled there.
6. Do not merge PRs or promote Production without the owner's explicit instruction.
7. Update this tracker with completed tasks, exact evidence, remaining blockers, and the next command/action.


## 8. Staging admin access bootstrap (2026-11-20)

- Root cause of the reported Preview login failure: Production and Preview use different Neon databases. The Production `admin_users` table had one active owner account and audit logs showed two successful Production logins. The staging `admin_users` table was empty.
- Added sensitive Vercel **Preview-only** environment variables `SHAHOO_ADMIN_EMAIL`, `SHAHOO_ADMIN_PASSWORD_HASH`, and `SHAHOO_ADMIN_NAME`. No Production environment variable was changed.
- New Preview deployment: `https://shahoo-47810kea7-shahoo.vercel.app`, deployment `dpl_EqqjPtkXRD8yVN4krmf9n8Pa34jo`, READY, branch `feat/admin-catalog-ux-phase1`, commit `0e0e5079672423c2945186ba61daf3fbda3c2316`.
- The admin account is created lazily by `ensureAdminFromEnv` on the first request to `/admin`; therefore open the Preview `/admin` route once before login. Verify the staging `admin_users` row after that request.
- A unique staging-only password was generated and provided to the owner in the conversation. Do not store it in this repository.
- Production account and database were not modified. Production login credentials remain separate.


## 9. Phase 1 completion confirmation (2026-11-20)

- Owner confirmed: "همه رو انجام دادم همه چیز درست بود" after testing the Preview admin login and catalog workflows.
- CI run `44761442398` was re-polled after the owner confirmation; every required job completed successfully, including Project tests. The Manus private platform harness was skipped by workflow configuration.
- Phase 1 implementation and owner smoke-test checklist are complete on `feat/admin-catalog-ux-phase1`.
- PR #8 remains open/draft and is **not merged**. No Production deployment, Production data mutation, or Production configuration change was made as part of this completion.
- Next workstream: Phase 2, CMS and central brand/content controls. PR #7 remains a separate, unmerged change and must be reviewed/integrated deliberately; the admin navigation still needs a discoverable CMS entry.


## 10. Phase 2 initial implementation (2026-11-20)

- Branch: `feat/admin-cms-phase2`, based on the completed Phase 1 branch `feat/admin-catalog-ux-phase1` at `e6190c66aacb5f1b2172ec6f7804725ea9d5379f`.
- PR #9: https://github.com/arefbrh/shahoo/pull/9 (draft, stacked on PR #8; base is `feat/admin-catalog-ux-phase1`). Merge order must be PR #8 first, then PR #9. Neither has been merged.
- Added `/admin/content` to `src/components/site/admin-shell.tsx`, visible only when the session includes `content.write`. The route itself independently checks `content.write` before rendering the CMS desk.
- Ported central brand settings from PR #7 into `src/components/site/content-desk.tsx`, `src/server/cms/content.ts`, `src/server/cms/api.ts`, and `src/lib/cms-types.ts`: brand name, tagline, copyright, header logo and footer logo. Saves are validated and transactional, preserving unrelated store-profile/logo settings and recording an audit event.
- Updated public header/footer logo alt text to use the canonical brand name in `src/components/site/shell.tsx`.
- No database migration, Production environment change, Production deploy, or Production data mutation. No direct binary media upload; logo values remain approved asset paths or HTTPS image URLs.
- Existing CMS functions remain: homepage copy/sections, banners, nav menus, pages, magazine/articles, media URL registration and store contact details. Carousel/header/footer layout controls and media upload/publish/revision workflow remain outstanding.
- CI status for PR #9 head `c489893bee1b26ccf38ce6299358c9ce40bffadd`: workflow run not yet returned at the time of this update. Do not mark tests passed until a run is available and all required jobs complete.
- Required next step: poll PR #9 CI, fix any failures, then inspect its Preview and ask the owner to smoke-test CMS navigation, brand save/reload, and storefront reflection. Keep Production untouched.
\n\n## 11. Admin usability guidance pass (2026-11-20)\n\n- Owner confirmed the CMS/brand settings Preview worked: a brand setting was changed, saved, and reflected on the public site. This is owner-reported browser verification.\n- Owner feedback: admin navigation felt crowded; many areas had no explanation and some appeared empty without context.\n- Added reusable Persian help panel at `src/components/site/admin-help.tsx`.\n- Grouped admin navigation into: «مدیریت روزانه»، «کالا و فروش»، «سایت و محتوا»، and «کنترل و دسترسی». Permission filtering remains unchanged.\n- Added contextual descriptions and practical examples to dashboard, orders, customers, inventory, reports, staff, catalog, CMS tabs/forms, coupons/shipping, support/returns, and reviews. Clarified empty banner/media states and distinguished catalog prices from inventory adjustments and store copy.\n- No schema changes, production data changes, environment changes, or Production deployment.\n- CI for pre-guidance PR #9 code commit `c489893bee1b26ccf38ce6299358c9ce40bffadd` completed successfully: Quality, Project tests, PostgreSQL integration/migrations, migration inventory, Security, Payment/SMS mocks passed; private platform harness skipped. Guidance commits require a new CI run before merge.\n- Owner smoke-tested CMS brand save/render successfully on Preview. Full admin guidance changes need a fresh Preview review, especially navigation grouping and the new explanatory copy.\n

## 12. Admin guidance validation follow-up (2026-11-20)

- Latest guidance branch head: `32875c63c5601ad5bc52b751c399a2ffced48151`.
- The first guidance CI attempt reported a TypeScript error because the shared offer-field component did not yet accept the new `hint` prop. Added the optional prop and rendered its help text; this was a code-level issue, not a data or migration failure.
- Fresh CI run: `44768520455` for commit `a6ed3bc42e5ca474dbbb2962b62ea9b7a219be2c` was started; a subsequent small formatting commit `32875c63c5601ad5bc52b751c399a2ffced48151` is the current branch head and must also be covered by CI/Preview.
- Latest Preview deployment for current head: `https://shahoo-mg8u5earf-shahoo.vercel.app`, deployment `dpl_8QtFdwxmRtyYCcrRWA4ZW6F83kb3`; last observed state BUILDING. Do not ask owner to test until READY.
- Production remains untouched. PR #9 remains draft and stacked on PR #8; no merge or Production promotion.
