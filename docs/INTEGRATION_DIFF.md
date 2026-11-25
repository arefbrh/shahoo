# SHAHOO V2 — Integration Diff & Merge Decisions

**Comparison baseline:** GitHub `shahoo-workspace/shahoo` `main` at `9cee5faf98e010f7a366af0e28d95ed36bfaf2d5`  
**Input:** `SHAHOO_PROJECT_V2_FINAL_MASTER.zip`  
**Date:** 24 November 2026

This is a targeted file-level comparison, not a claim that every byte in all 480 extracted files was independently diffed.

## 1. Storefront source additions from the ZIP

- `src/lib/iran-cities.ts` — province/city data used by checkout; manual city entry remains available.
- `src/lib/carrier-tracking.ts` — carrier-specific tracking URL resolver; unverified query-string prefill was removed so codes are entered on official portals.
- `src/lib/cms-defaults.ts` — CMS default FAQ/trust-mark definitions; trust marks remain Pending.
- `src/components/site/product-faq.tsx` — product FAQ presentation.
- `src/routes/api.torob.products.ts` and `src/server/seo/torob-feed.ts` — public Torob feed.

## 2. Existing source files changed by the ZIP

- Storefront and CMS: `src/components/site/checkout-view.tsx`, `order-view.tsx`, `content-desk.tsx`, `catalog-view.tsx`, `shell.tsx`; `src/routes/product.$productId.tsx`; `src/server/cms/content.ts`, `src/server/cms/api.ts`, `src/server/storefront/api.ts`.
- Media and invoices: `src/server/media/disk.ts`, `src/components/site/order-invoice.tsx`, `src/lib/invoice-export.ts`.
- Shared types and routing: `src/lib/store-types.ts`, `src/lib/format.ts`, `src/lib/cms-types.ts`, `src/lib/login-throttle.ts`, `src/routeTree.gen.ts`.
- Operations and metadata: `package.json`, `scripts/run-tests.mjs`, `.env.example`, `PROJECT_HANDOFF.md`, `REMAINING_ISSUES.md`, `docs/ADMIN_IMPLEMENTATION_TRACKER.md`, `docs/README.md`, `src/styles.css`.
- `package-lock.json` remains unchanged; the package manifest change adds scripts only and does not add/remove dependencies.

## 3. Infrastructure and operations files added by the ZIP

- Root: `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `Caddyfile.windows`, `.dockerignore`, `.env.production.example`, `scripts/init-db.sql`.
- Linux scripts: database/media backup and restore, health monitoring, and app startup under `scripts/linux/`.
- Windows scripts: database/media backup and restore, DB bootstrap, app/Caddy service installation, health monitoring, server setup and startup under `scripts/windows/`.
- Docs: `PROJECT_STATUS.md`, `CAPABILITY_MATRIX.md`, `PROVIDER_STATUS.md`, `SELF_HOSTING_ARCHITECTURE.md`, `RELEASE_CHECKLIST.md`, `BACKUP_RESTORE_RUNBOOK.md`, `VPS_DEPLOYMENT.md`, `WINDOWS_SERVER_DEPLOYMENT.md`, `SECURITY_HARDENING.md`.
- Brand: `public/assets/brand/README_BRAND_ASSETS.md` and the supplied logo variants.

## 4. Corrections/additions made during integration review

- Added `.dockerignore`; explicitly builds with Nitro `node-server`; copies the production dependencies and `src` needed by the worker.
- Split PostgreSQL bootstrap administrator from the non-superuser application role (`POSTGRES_*` vs `APP_DB_*`); app and worker use only the runtime role.
- Aligned environment names with code: `APP_URL`, `PAYPING_LIVE`, `SMS_IR_OTP_TEMPLATE_ID`, `SMS_LIVE`, `SHAHOO_TRUST_PROXY`.
- Added worker timeout/heartbeat and healthcheck; invalid intervals/timeouts now fail fast, and the healthcheck rejects malformed intervals rather than silently disabling stale-heartbeat detection. Added 8 focused worker configuration/heartbeat tests.
- Added Linux database/media restore and media backup scripts; restore requires explicit confirmation, validates media archive paths, applies retention bounds, attempts to restart services if stop fails before destructive work, and deliberately leaves services stopped if a restore fails after replacement begins.
- Added Windows role bootstrap and media backup/restore; added a guarded NSSM Caddy service installer; corrected app service `.env` propagation, NSSM prerequisites, and restore exit-code handling.
- Added Windows-specific Caddy upstream configuration; both Caddyfiles now use `APP_DOMAIN` instead of hard-coding the hostname. Docker Compose requires matching `APP_DOMAIN` and `APP_URL`; removed unverified ACME contact and HSTS preload/subdomain assumptions.
- Replaced hard-coded database name in init SQL with the active database name.
- Verified Tipax and Chapar official tracking portals and removed unsupported query-prefill assumptions; the Post portal domain is corroborated but its page fetch timed out.
- Corrected Torob feed schema references (`productCategories`, `productImages`, `inventory`, active variants), removed unsupported product claims, and made public error responses generic.
- Registered the Torob API route in `src/routeTree.gen.ts`.
- Added invoice-export regression tests and registered the supplied remediation suites in `scripts/run-tests.mjs`.
- Updated current handoff, issue register, provider matrix, deployment and recovery documentation to distinguish code present from verified operation.

## 5. Files deliberately not replaced

Targeted hash checks showed these important files were identical to `main` and did not need to be overwritten:

- `package-lock.json`
- `src/server/db/schema.ts`
- `src/server/db/seed.ts`
- `src/server/commerce/fulfillment-api.ts`
- `src/components/site/order-packing-slip.tsx`
- `src/components/site/shipping-label.tsx`
- `src/components/site/shipping-sender-settings.tsx`

Existing migrations were not rewritten or removed. No Production database migration was executed.

## 6. Integration limits

The ZIP contains self-hosting scaffolding, not a running VPS. The 479-test, Node 26 typecheck/lint and build evidence was collected on a GitHub `main` checkout plus a selected overlay in Vercel Sandbox; targeted candidate-local suites also passed. Full dependency installation, typecheck, lint, build and complete project suite against the entire refreshed ZIP remain unverified. Docker Compose validation, image build, PowerShell execution, real PostgreSQL backup/restore, HTTPS issuance, and browser/Preview checks also remain unverified. WAL/PITR, backup encryption, off-site replication, email alerts, SSL expiry monitoring and a full disaster-recovery drill remain open.


## 7. GitHub handoff boundary — checked 2026-11-25

The integration candidate remains local. The existing `feat/self-hosted-infra-remediation` branch points to the same SHA as `main` (`9cee5faf98e010f7a366af0e28d95ed36bfaf2d5`); no open PR was found. No source files from this candidate have been committed to GitHub. `main` is still the Vercel Production branch and has not been changed by this work.


## 8. Follow-up provider compatibility review — 2026-11-25

- Neon Object Storage uses AWS-standard environment names. The S3 adapter now accepts `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` as aliases, while keeping the bucket name explicit (`STORAGE_S3_BUCKET`).
- Docker Compose forwards these AWS-standard names to the app container.
- Added a regression test for the Neon/AWS environment contract.
- Provisioned and verified a private `shahoo-media` bucket on the Staging branch only. Production remains unchanged.
- Removed the candidate `vercel.json` install override after review found it used `npm install --omit=dev`, which could remove build-time dependencies. No replacement install override is needed.

- Neon-specific setup guide: `docs/NEON_OBJECT_STORAGE_SETUP.md` documents the private Staging bucket and exact environment contract; no credentials are stored in the archive.
