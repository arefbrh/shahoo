# SHAHOO v1.0.0 — Batch 08 Revision 02 Report

**Date:** 2026-11-19  
**Release decision:** **NOT READY FOR RELEASE**  
**Scope:** Revision 02 only; no Batch 09 work and no live provider integration.

## 1. Baseline identity

Revision 02 started from the exact authoritative archive `/home/ubuntu/SHAHOO-v1.0.0-batch08-revision01.zip`, not from an older ZIP, branch, or reconstructed workspace.

- Input SHA-256: `6a0c75a8147a3b2751ac7e65b45bdf5a274b7770a153a3e961e5bb842828be05`
- Extracted baseline: 434 files, 43 directories
- `unzip -t`: PASS
- Working directory: `/home/ubuntu/work/shahoo-batch08r2`

The final archive will be generated separately as `SHAHOO-v1.0.0-batch08-revision02.zip`.

## 2. Audit recovery

The complete original Claude audit containing all 23 finding descriptions was not present in the Revision 01 archive. The archive contains historical reports, `CLAUDE_REVIEW_README.md`, historical references, and SH-001–SH-006 summaries, but not the missing 11 medium- and 6 low-severity finding descriptions. Those descriptions were not fabricated. The missing source remains explicitly unverified and is a release evidence gap.

## 3. Finding register and fixes

### R2-001 — Auth flag enabled by absence or malformed value — FIXED

**Root cause:** several platform-scaffold auth paths treated any value other than the literal `false` as enabled. The private `.grok/app-env.json` is intentionally absent from the source archive, so this could silently enable Better Auth/gate identity even though SHAHOO's intended customer/admin authentication is its custom OTP/session/RBAC system.

**Files:** `scripts/with-app-env.mjs`, `scripts/check-auth-invariant.mjs`, `src/lib/auth/client.ts`, `src/lib/auth/gate-identity.server.ts`, `src/lib/auth/server.ts`.

**Fix:** `VITE_AUTH_ENABLED` now defaults and normalizes to `false`; all runtime predicates enable the scaffold only for exact `"true"`. The server uses `authDisabled = env("VITE_AUTH_ENABLED") !== "true"`.

**Regression evidence:** wrapper/auth-invariant tests pass 24/24; gate identity tests pass 25/25; `npm run check:auth -- --dev-url http://127.0.0.1:8080` reports `dev and build agree: sign-in off`.

### R2-002 — Demo seed duplicated migration-provisioned homepage sections — FIXED

**Root cause:** migration `0010_batch_04_home_sections.sql` provisions the three product section types before application startup. Demo seeding then inserted the canonical nine sections as one batch, including those already-provisioned types, causing a homepage HTTP 500 in the wrapped dev runtime.

**Files:** `src/server/db/seed.ts`, `src/server/db/seed-safety.test.ts`.

**Fix:** demo seeding reads existing homepage section types and inserts only missing types, preserving migrated/custom CMS rows.

**Regression evidence:** seed-safety tests pass 4/4, including `demo seeding preserves migration-provisioned homepage section types`. After a clean server restart, desktop and mobile homepage smoke both returned HTTP 200 with no console/page errors and no horizontal overflow.

### Dependency advisory — RESOLVED

Baseline `npm audit` reported 7 moderate development-tooling findings through `typescript-eslint`/transitive minimatch. The reviewed compatible update to `typescript-eslint@8.73.0` was applied without `--force`. Final `npm audit --json` reports 0 info, 0 low, 0 moderate, 0 high, and 0 critical vulnerabilities.

Better Auth remains pinned at `1.7.26` as established by Revision 01.

### Historical audit findings

Historical SH-001–SH-006 were reviewed through the available reports and retained. The missing medium/low descriptions from the unavailable Claude audit remain UNVERIFIED, not silently closed.

## 4. Verification commands and results

| Command/check | Result | Evidence/qualification |
|---|---:|---|
| `npm ci` | PASS | Fresh dependency install completed before final verification |
| `npm audit --json` | PASS | 0 vulnerabilities after reviewed update |
| `node --test scripts/with-app-env.test.mjs scripts/check-auth-invariant.test.mjs` | PASS | 24 passed, 0 failed |
| Gate identity test | PASS | 25 passed, 0 failed |
| `npm run typecheck` | PASS | TypeScript completed with exit 0 |
| `npm run lint` | PASS | 0 errors, 5 existing warnings |
| `npm run build` | PASS | Vite/Nitro bundle completed; build does not migrate |
| `npm test` script group | PARTIAL / BLOCKED | 212 passed, 4 failed of 216; all 4 fail because private `.grok/skills/og` files are absent |
| `npm test` application group | PASS | 215 passed, 0 failed |
| `npm test` migration/PGlite group | PASS | 94 passed, 0 failed |
| `npm run check:auth -- --dev-url http://127.0.0.1:8080` | PASS | Dev/build agreement: sign-in off |
| Homepage direct browser smoke, 1280×800 | PASS | HTTP 200, title present, no overflow, no console/page errors |
| Homepage direct browser smoke, 390×844 | PASS | HTTP 200, title present, no overflow, no console/page errors |
| `env -u DATABASE_URL npm run db:migrate` | BLOCKED BY ENVIRONMENT / EXPECTED GUARD | Refused with `DATABASE_URL is required`; no fallback to PGlite |
| Real PostgreSQL fresh/upgrade/concurrency | NOT EXECUTED | `psql`, `pg_isready`, and Docker unavailable |
| Backup/restore | NOT EXECUTED | No disposable PostgreSQL or backup target available |
| Real target-host/platform harness | NOT EXECUTED | Private `.grok` environment and deployment host unavailable |
| Accessibility workflow/E2E | NOT EXECUTED | Runtime smoke is not a complete accessibility audit |

The repository's `scripts/browser-smoke.mjs` could not launch its expected Playwright-managed headless-shell binary in this sandbox. The same existing Playwright dependency was used directly with the installed system Chromium executable for the bounded desktop/mobile smoke described above; this is not claimed as complete E2E or accessibility coverage.

## 5. Auth, authorization, ownership, and session review

The Revision 01 custom SHAHOO OTP/session/RBAC paths and their existing tests were retained. Revision 02 specifically strengthened the platform scaffold boundary: absent, empty, malformed, `false`, and exact `true` values are covered. Direct platform gate identity verification remains fail-closed unless explicitly enabled. The application test group passed 215/215, including auth, admin access-control, customer ownership, throttling, checkout, payment, and commerce tests available in the archive.

Real SMS/OTP and production session behavior were not executed. No SMS.ir, PayPing, live payment, shipping, cloud storage, or production hosting connection was made.

## 6. Payment, reservation, inventory, and concurrency

Existing application and PGlite regression coverage passed, including checkout idempotency, payment verification/replay, hold expiry/release, late payment, stock release, refund bounds, cart concurrency, and ownership checks. PGlite is not PostgreSQL: no claim is made that these results prove PostgreSQL locking, isolation, query plans, or production concurrency.

Required real PostgreSQL verification remains blocked. The exact reproducible procedure is:

1. Start a disposable PostgreSQL instance, for example `docker run --rm --name shahoo-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=shahoo -p 55432:5432 postgres:16`.
2. Wait for readiness with `pg_isready -h 127.0.0.1 -p 55432 -U postgres`.
3. Set a temporary `DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/shahoo` and run `npm run db:migrate`.
4. Run the application integration and concurrency suites against that disposable database, then independently run fresh and upgrade migration paths.
5. Remove the container and volume/data after evidence capture. Never use customer or production data.

## 7. Backup and restore procedure prepared, not executed

For an authorized disposable or staging PostgreSQL database:

```sh
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB'
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > shahoo-$(date -u +%Y%m%dT%H%M%SZ).dump
createdb shahoo_restore_test
pg_restore --clean --if-exists --no-owner --no-acl --dbname='postgresql://USER:PASSWORD@HOST:5432/shahoo_restore_test' shahoo-*.dump
psql 'postgresql://USER:PASSWORD@HOST:5432/shahoo_restore_test' -v ON_ERROR_STOP=1 -c 'select count(*) from _migrations;'
```

Verify migration history, representative catalog/order/customer rows, constraints, indexes, and application read paths after restore. This procedure was not executed because no PostgreSQL server or backup target was available.

## 8. Documentation and release status

All required current handoff/release documents have been amended with this Revision 02 status while preserving historical sections as historical. The release decision is **NOT READY FOR RELEASE** because real PostgreSQL fresh/upgrade/concurrency, backup/restore, authorized target-host configuration, and complete platform-harness verification remain unavailable. The four private-harness test failures prevent claiming a completely green configured `npm test` command.

This is not a Batch 09 implementation. Batch 09 has not started.

## 9. Handoff

Before release approval, an authorized environment owner must execute the blocked checks, verify explicit `VITE_AUTH_ENABLED=false` at build and runtime for the SHAHOO shop, complete browser/accessibility review, recover the missing Claude audit source if available, and rerun the final archive verification. Do not connect real providers or production hosting as part of this revision.
