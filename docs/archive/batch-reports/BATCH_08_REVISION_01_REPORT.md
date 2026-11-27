> **Historical report, superseded:** This report and all of its old “current” banners describe their respective past checkpoints, not the present. For Batch 08 Revision 02.1, current release status and independently reproduced results, use `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` and `BATCH_08_FINAL_RELEASE_EVIDENCE.md`. Historical test counts are unchanged.

---

<!-- BATCH 08 REVISION 02 CURRENT STATUS -->
> **Batch 08 Revision 02 current status (2026-11-19):** Revision 02 started from the exact Revision 01 archive and remains **NOT READY FOR RELEASE**. Auth is now explicit opt-in/fail-closed; reviewed `typescript-eslint@8.73.0` leaves `npm audit` at 0 vulnerabilities; demo homepage seeding now preserves migration-provisioned section types; typecheck, build, application tests (215/215), migration/PGlite tests (94/94), focused auth tests, and bounded desktop/mobile runtime smoke pass. The configured script group is partial (212/216; four failures require absent private `.grok/skills/og` harness files). Real PostgreSQL fresh/upgrade/concurrency, backup/restore, authorized target-host verification, and complete accessibility review remain unavailable. **Batch 09 has not started; no real providers or production hosting were connected.**

# SHAHOO v1.0.0 — Batch 08 Revision 01 Remediation Report

**Date:** 2026-11-19  
**Authoritative input:** `/home/ubuntu/SHAHOO-v1.0.0-batch08-review.zip`  
**Input SHA-256:** `edecb44a54bf4ca97c42f274be98667fdc10e0e8e682b9aaabec7ef2a6394cfe`  
**Scope:** safe remediation, security review, quote/cart consistency, regression coverage, documentation reconciliation, and clean source archive. No Batch 09 work, provider connection, live payment, real SMS/OTP delivery, shipping API, cloud storage, or production hosting was performed.

## Executive summary

Batch 08 implementation and review are complete, and this Revision 01 remediation addresses the confirmed defects and contradictions that could be safely fixed in the owner-provided source. The storefront quote path and cart mutation path now share the same sellability rule. Better Auth was retained because the platform scaffold actively imports it, upgraded safely to `1.7.26`, and its incompatible client/server calls were updated. The approved HTTPS-only CMS media-registration design is documented consistently; no binary upload or object-storage workflow was added.

The release recommendation remains **NOT READY FOR RELEASE**. Local typecheck, lint, build, application tests, migration/PGlite tests, focused auth tests, and quote/cart database-path tests pass. Release-critical evidence is still missing for real PostgreSQL fresh/upgrade/concurrency behavior, backup/restore, target-host configuration, browser/mobile/accessibility runtime checks, and explicit deployment verification of `VITE_AUTH_ENABLED=false`. The configured platform/script group is also not green because eight tests require private `.grok` files absent from the owner archive and this environment.

## Issue register and root causes

| Issue | Root cause/status | Revision 01 disposition |
|---|---|---|
| Quote/cart sellability drift | Quote logic did not enforce all product, variant, and category state checks used by cart mutations. | **Resolved.** Shared `isLineSellable` is used by quote/cart paths; deleted and inactive variants/categories and deleted/unpublished products are rejected. |
| Better Auth critical advisory and API drift | Active scaffold imports Better Auth; the prior version carried `GHSA-965c-763c-88jm`, and the client/server OAuth calls used APIs no longer available after a safe upgrade. | **Remediated in source.** Pinned `better-auth@1.7.26`; removed unavailable `genericOAuthClient`; changed OAuth calls to supported social APIs; typecheck passes. Current audit: 0 critical/high/low, 7 moderate transitive findings remain. |
| Obsolete media test expectation | A platform assertion expected `uploadBusy` binary-upload UI, while the approved CMS design registers HTTPS image URLs and does not enable binary/object-storage uploads. | **Resolved in test/documentation.** The assertion now checks URL registration state and Persian HTTPS messaging. Existing media-upload route security tests remain. |
| Stale handoff/release documentation | Current sections still said Batch 08 had not started and repeated old dependency/test totals. | **Resolved.** Canonical openings and production/release documents now identify Revision 01 as current and mark older stop instructions historical. |
| Private platform harness failures | `.grok/skills/og/SKILL.md`, its references, and `.grok/app-env.json` are not in the owner archive/environment. | **Not reproducible here.** Tests were preserved; failures are reported separately and are not weakened or deleted. |

## Files changed

- `src/server/storefront/api.ts`: extracted and exposed the database-backed `quoteCartWithDb` path used by the public quote function; complete sellability checks.
- `src/server/commerce/cart.ts`: retrieval, add, set, merge, and local-adopt paths account for deleted products/variants and category state through the shared rule.
- `src/lib/commerce-integrity.ts`: shared `isLineSellable` rule includes variant deletion/state requirements.
- `src/server/storefront/quote-cart-rules.test.ts`: PGlite database-path regression coverage for valid and unsellable lines, state changes, and safe public errors.
- `src/lib/auth/client.ts`: supported Better Auth client API and removal of unavailable plugin import.
- `src/lib/auth/popup.server.ts`: supported Better Auth server social sign-in API.
- `package.json`, `package-lock.json`: exact Better Auth upgrade to `1.7.26`.
- `scripts/frontend-source.test.mjs`: approved HTTPS-only media registration assertion.
- Canonical handoff/release documents and this report.

No migration file was added or edited. No production schema was changed.

## Verification results

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS with 5 existing warnings, 0 errors |
| `npm run build` | PASS; Vite/Nitro generated `.vercel/output` |
| Focused auth/authorization/runtime tests | PASS, 23 passed, 0 failed |
| Quote/cart focused suite | PASS, 10 passed, 0 failed |
| Full configured platform/script group | **207 passed, 8 failed, 215 total** |
| Full application group | PASS, 214 passed, 0 failed |
| Full migration/PGlite group | PASS, 93 passed, 0 failed |
| `npm run db:migrate` with `DATABASE_URL` absent | Safe refusal; exit 1 with `DATABASE_URL is required to migrate. Refusing to skip or fall back to PGlite.` |
| `npm run check:auth` | Not passable in this environment; it cannot read the resolved `VITE_AUTH_ENABLED` from an actual dev server/private platform environment |

The eight platform failures are the three absent `.grok/skills/og` marker/prohibition/self-check cases, four absent/private `.grok/app-env.json` build/auth-off/wrapper/symlink cases, and one absent private OG handover-reference case. The previously obsolete media assertion is no longer a failure.

The extracted test log is not included in the release archive; the commands and totals above are the authoritative handoff record.

## Security audit

Before remediation, the captured audit reported 10 findings, including one critical Better Auth advisory identified as `GHSA-965c-763c-88jm`. `better-auth` was not removed because the platform scaffold actively imports it. It was upgraded with an exact, non-force install to `1.7.26`, and compatibility changes were made in the browser and popup server callers. The post-upgrade audit reports **7 moderate, 0 low, 0 high, 0 critical** findings, principally through TypeScript ESLint/minimatch dependency paths. No `npm audit fix --force` was used.

Positive evidence includes production refusal without `DATABASE_URL`, migration refusal without `DATABASE_URL`, guarded demo/mock/development flags, custom SHAHOO cookie/RBAC separation, server-side quote/cart pricing and sellability, authenticated media boundaries, and absence of credentials/private keys/real `.env` files in the deliverable.

The deployment must explicitly set and verify `VITE_AUTH_ENABLED=false`. The source scaffold can default an absent flag to enabled, and this environment cannot verify the private platform runtime value.

## SH-001 through SH-006 review

The owner archive did not contain a separate original Claude review artifact with a complete independent issue register. The following descriptions are recovered only from the existing project reports and source references; no missing descriptions are invented.

| Finding | Revision 01 status and evidence |
|---|---|
| SH-001 — demo/seed safety | Production initialization does not create demo products/coupons; `SEED_DEMO` is guarded outside production. Existing contaminated databases are not automatically wiped. Covered by production initialization tests. |
| SH-002 — PGlite fallback / production DB guard | Production requires `DATABASE_URL` and fails closed instead of falling back to PGlite. Migration without `DATABASE_URL` also refuses safely. Covered by source/PGlite tests and the direct migration-guard run. |
| SH-003 — production/security defaults | OTP echo, mock payment/SMS, relaxed CSP, and demo behavior are guarded away from production. `VITE_AUTH_ENABLED=false` remains an explicit deployment prerequisite. |
| SH-004 — payment lifecycle | Internal ledger/capture safeguards exist, but there is no live gateway initiation/callback and no payment provider was contacted. Do not treat ledger state as settlement. |
| SH-005 — late payment / reservation expiry recovery | Expiry and payment state safeguards are tested on PGlite, including no release of paid stock and safe late-payment behavior. Independent PostgreSQL concurrency and operational reconciliation remain unverified. |
| SH-006 — OTP controls | OTP entropy/expiry/replay/throttling/hashing and limits are covered by the existing custom-auth tests and guarded echo behavior. Real SMS delivery was not enabled or tested; provider and deployment verification remain future work. |

Historical reports also list other open items (guest checkout throttling, lazy hold expiry, refund/reconciliation design, CSP `unsafe-inline`, admin MFA, and broader operational checks); they remain open unless explicitly marked otherwise in the source documents.

## Database and deployment status

No real PostgreSQL server, production database, migration, backup, restore, or independent-connection test was run. PGlite is suitable for the portable regression evidence above but is not a substitute for PostgreSQL locking and upgrade proof. Before release, use an authorized disposable/target-equivalent PostgreSQL instance, take a backup, run fresh and upgrade migrations, execute concurrent checkout/inventory tests over independent connections, and verify restore.

Production prerequisites remain: `DATABASE_URL`, HTTPS `APP_URL`, explicit `VITE_AUTH_ENABLED=false` at build/runtime, guarded migrations with `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`, secure secret injection outside the repository, reverse-proxy/cookie configuration, process supervision, persistent media decision, logs without secrets, health/restart checks, and browser/accessibility validation.

The approved CMS path is HTTPS URL registration. SMS.ir, PayPing, live payment, real OTP/SMS, carrier APIs, cloud storage, and production hosting remain out of scope and were not connected.

## Archive policy and release recommendation

The final archive must exclude `node_modules`, `.git`, `.vercel`, build output, caches, temporary/debug logs, real `.env` files, credentials, keys, private secrets, and duplicate ZIP archives. It must include source, tests, migrations, configuration examples, and reconciled documentation.

**Release recommendation: NOT READY FOR RELEASE.** Approval remains blocked by missing real-PostgreSQL/backup/restore/concurrency evidence, missing target-host and explicit auth-off verification, missing browser/mobile/accessibility runtime evidence, unresolved moderate dependency findings requiring owner risk treatment, and the non-green private platform harness group. These limitations do not justify weakening tests or claiming production readiness.

## Handoff

Batch 08 Revision 01 is the current completed remediation checkpoint. Do not start Batch 09 or connect any real provider. The next authorized activity is release evidence collection on an approved PostgreSQL/target-host/browser environment, followed by owner review of this report and the clean archive.
