> **Historical document — not current instructions.** This file preserves earlier planning, review guidance, or test snapshots. Some dates, statuses, commands, and next-step instructions may be superseded. For the authoritative current state and roadmap, start with [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), then [REMAINING_ISSUES.md](REMAINING_ISSUES.md) and [BATCH_09_COMPREHENSIVE_AUDIT.md](BATCH_09_COMPREHENSIVE_AUDIT.md). See [docs/README.md](docs/README.md) for the document map.

---

# Current test evidence notice — Batch 08 Revision 02.1

For exact commands, environments, actual 02.1 rerun outcomes and release-gate effects, use [BATCH_08_FINAL_RELEASE_EVIDENCE.md](BATCH_08_FINAL_RELEASE_EVIDENCE.md). Do not infer a fresh passing result from this notice or any older figure below. Revision 02 **previously reported**, not as this run's result: `npm ci` and audit with zero vulnerabilities; typecheck and build; lint with 0 errors/5 warnings; application 215/215; PGlite/migration 94/94; focused wrapper/invariant 24/24 and gate identity 25/25; bounded desktop/mobile homepage smoke. It reported a partial platform/script group, 212/216, with four private OG-harness failures; do not call the configured full `npm test` green on that evidence. Its real PostgreSQL, backup/restore, complete browser E2E and accessibility checks were not executed. The private OG skill references and the matching platform `AGENTS.md` contract are environment-dependent; their availability or compatibility is not assumed. See the final evidence for the current audit and all other reruns.

**Historical content notice:** All test figures and verification/status statements below belong to the named earlier batches and are historical. Any conflicting current-status claim or instruction is superseded by this notice and the final release evidence. Final release approval has not been granted, and Batch 09 has not started.

---

# TEST REPORT — v1.0.0

## Batch 04 verification policy (2026-11-19)

See `BATCH_04_REPORT.md` for the actual current-batch check labels. The owner explicitly deferred full typecheck, ESLint, test suites, build, database and browser verification to Batch 08. Earlier results in this file are historical and are not evidence of a Batch 04 run.


Executed on the v1.0.0 tree after the return-desk, image-rebuild, ledger, and CSP checks. `DATABASE_URL` was unset. Neon was not used. No gateway, SMS, carrier, or bucket was called.

## Commands

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| `npx eslint . --quiet` | Passed, 0 errors |
| Platform script tests | Passed, 198 of 198 |
| Application tests | Passed, 133 of 133 |
| Migration 05.02 and completion flow | Passed, 16 of 16 |
| Failed tests | 0 |
| `npm run build` | Passed. `[migrate] DATABASE_URL not set — skipping` |
| `npm audit --omit=dev` | `seroval` moderate advisories were cleared by a non-forced lockfile update. `better-auth` remains critical through 1.7.6. The shop does not sign customers in with it (`VITE_AUTH_ENABLED=false`). It was not force-upgraded. |
| TanStack Start | Installed `1.168.60` (not below the security floor) |

## Covered in this release

- Production CSP has `frame-ancestors 'self'`, no `unsafe-eval`, and no Grok host in `script-src`. Development CSP still allows the preview host.
- A failed return action keeps the previous list. A successful one replaces that row with the server status, order status, and history. A failed reload keeps the row already returned by the action.
- A PNG with a trailing script is rebuilt without that trailer. A JPEG that does not decode is rejected. A real JPEG with a trailing script is decoded and encoded again, and the stored bytes end at the JPEG end marker.
- A 1×1 GIF passes LZW decode. A GIF with an illegal code size is rejected.
- `PAYMENT_PROVIDER=mock` resolves to no provider when `NODE_ENV=production`.
- Upload checks the admin session before the body. A fake image and an oversized body are rejected. The stored name is server-generated.
- The paid-cancel, double-refund, and return race tests still pass.

## Not run

- A live gateway, live SMS, a carrier API, and a cloud bucket.
- Migration against a hosted Neon database.
- A click-through of every admin form in a browser was not run.
- Homepage browser smoke on the development server (`scripts/browser-smoke.mjs`, desktop 1280×800 and mobile 390×844) returned HTTP 200, the title «شاهو | محصولات طبیعی», visible Persian catalog text, no horizontal overflow, and no console or page errors. Screenshots were inspected.
- The production preview on `127.0.0.1:8081` returned the same homepage text and title. Its only console error is the platform script `https://grok.com/grok-app-builder/extensions.js` being blocked by the production `script-src`. That block is intentional. The shop markup still rendered. This is not a payment certification.

## Batch 03 (2026-11-18)
Executed: new pure tests 18/18 pass (`wishlist-rules`, `cart-ui-rules`, `media-upload-client`); `scripts/frontend-source.test.mjs` 9/9 pass (static inspection); 88/88 runnable app tests pass; syntax parse of edited files passes (not a typecheck). Platform script tests: 213 run, 202 pass, 11 fail — the same 11 fail on the unmodified Batch 02 correction (missing `.grok/` and packages in the sandbox).
Not executed: `tsc`, `eslint`, build, Drizzle/PGlite suites, browser tests at the four viewports, DOM rendering tests (no network / `node_modules`). Details: `BATCH_03_REPORT.md`.

## Batch 03 correction (2026-11-18)
EXECUTED — PASS: `src/lib/wishlist-sync.test.ts` + `wishlist-rules.test.ts` 27/27; all importable app test files 107/107; `scripts/frontend-source.test.mjs` 9/9 (static source inspection, not a behaviour test); syntax parse of edited files (not a typecheck).
EXECUTED — FAIL: `node --test 'scripts/**/*.test.mjs'` 213 run, 202 pass, 11 fail, the same 11 as on the unmodified Batch 03 archive (missing `.grok/` and packages) — pre-existing.
NOT EXECUTED — ENVIRONMENT LIMITATION: `tsc`, ESLint, production build, 15 Drizzle/PGlite test files, real PostgreSQL tests, browser tests, rendering tests. Details: `BATCH_03_REPORT.md`.


## Batch 04 current verification (2026-11-19)

The initial Batch 04 commands and exact statuses are recorded in `BATCH_04_REPORT.md`. Its original run did not execute migrations. The focused Production homepage correction checks and current deferred checks are recorded below and in `BATCH_04_CORRECTION_REPORT.md`. No Production database or provider was used. Earlier test figures belong to earlier batches only.

## Batch 04 Production homepage correction (2026-11-19)

- **EXECUTED — PASS:** `node --experimental-strip-types --import ./scripts/ts-alias-register.mjs --test src/server/db/seed-safety.test.ts` — 3/3, using isolated in-memory PGlite. Includes fresh `demo:false` initialization and migration rerun, plus partial-section and CMS-edit preservation.
- **EXECUTED — PASS:** `node --test scripts/frontend-source.test.mjs` — 10/10, including CMS-driven empty-product homepage output.
- **EXECUTED — PASS:** `node --experimental-strip-types --test src/lib/cms-rules.test.ts` — 9/9, including legacy featured-section suppression.
- **EXECUTED — PASS:** Node assertion confirmed ordered migration discovery returns `0010_batch_04_home_sections.sql` after 0009.
- **NOT EXECUTED — DEFERRED TO BATCH 08:** Full typecheck, ESLint, complete test suite, production build, actual PostgreSQL/Production migration, multi-connection behavior, browser/E2E, live CMS, responsive and accessibility checks. PGlite is not PostgreSQL concurrency or production deployment proof.


## Batch 05 customer account verification (2026-11-19)

All checks ran in the isolated sandbox; `DATABASE_URL` was unset. PGlite tests used fresh in-memory databases with migrations through `0011_batch_05_customer_account.sql`.

- **EXECUTED — PASS:** focused pure suite (`customer-profile`, `customer-demographics`, `order-display`, `completion-rules`, `pricing`) — 20/20.
- **EXECUTED — PASS:** account/order projection and address ownership/default PGlite tests — 4/4.
- **EXECUTED — PASS:** existing checkout-safety and completion-flow regressions — 19/19. Node required `--experimental-transform-types` for the checkout TypeScript parameter-property syntax.
- **EXECUTED — PASS:** account navigation/direct-route static wiring — 2/2.
- **EXECUTED — PASS:** targeted ESLint over changed Batch 05 implementation and test files.
- **EXECUTED — PASS:** `npx tsc --noEmit --checkJs false` for TS/TSX.
- **EXECUTED — FAILED (pre-existing unrelated JS check):** `npx tsc --noEmit` reports `src/components/site/cart-wiring.test.mjs:5` TS7006, implicit `any` for the `name` parameter. This file was not changed. The strict repository command is not claimed as passed.
- **EXECUTED — PASS:** local-only Vite route generation/`GET /account` returned HTTP 200 and generated all four account child routes; no `DATABASE_URL` or Production database was used.
- **NOT EXECUTED — deferred to Batch 08:** full typecheck (including JS), full lint, full suite, production build, real PostgreSQL migration/concurrency, production rollout, backup/restore, full browser E2E, responsive/mobile and accessibility review.
- **NOT APPLICABLE:** SMS, payments, carrier, storage providers; no external calls were made.

The first attempt to run checkout regression tests under Node `--experimental-strip-types` stopped at Node's unsupported parameter-property syntax before test execution. It was rerun under `--experimental-transform-types` and passed; see `BATCH_05_REPORT.md` for exact commands and context.


## Batch 06 product/CMS verification (2026-11-19)

All Batch 06 PGlite suites used fresh in-memory test databases. The temporary Vite route-generation server had `DATABASE_URL` unset. No Production database/provider/storage was used.

| Check | Result |
|---|---|
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/cms/content.test.ts` | **EXECUTED — PASS, 12/12.** CMS, new-page create/fixed-slug protection, article SEO, gallery reorder and shared-media association safety. |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/catalog/admin.test.ts` | **EXECUTED — PASS, 5/5.** Parser validation plus full-migration PGlite product create/edit persistence, spec/SEO updates, existing variant/stock preservation, historic-variant omission refusal and permission denial. |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/commerce/batch02.test.ts src/server/commerce/checkout-safety.test.ts src/server/commerce/correction.test.ts src/server/account/addresses.test.ts src/server/account/account.test.ts src/components/site/account-wiring.test.mjs` | **EXECUTED — PASS, 41/41.** Commerce, shared media, checkout, stock/refund/payment, account/address/order and prior account UI wiring regressions. |
| `node --experimental-strip-types --test src/server/catalog/rules.test.ts src/lib/cms-rules.test.ts src/lib/home-carousel.test.ts src/lib/media-bytes.test.ts` | **EXECUTED — PASS, 16/16.** Catalog rules, CMS URL/section rules, Batch 04 carousel and media byte validation. |
| `npx tsc --noEmit --checkJs false` | **EXECUTED — PASS** for TS/TSX. JavaScript checking is excluded from this scoped pass. |
| Targeted ESLint on changed TS/TSX/tests and new page route | **EXECUTED — PASS** in final run, no warnings/errors. |
| Temporary local Vite route plugin | **EXECUTED — PASS, route registration only:** generated `src/routeTree.gen.ts` includes `/pages/$pageSlug`. A GET to an unpublished/nonexistent test slug returned 404; no browser E2E was claimed. |
| Full JS-aware typecheck, full ESLint, `npm test`, production build, real PostgreSQL, production migration/deploy, browser/mobile/accessibility and backup/restore | **NOT EXECUTED — deferred to Batch 08 / authorized infrastructure.** The prior Batch 05 report records an unchanged `.mjs` TS7006 in `cart-wiring.test.mjs`; this batch did not run the full unfiltered TS command. |
| SMS/payment/carrier/object-storage calls | **NOT APPLICABLE.** Out of scope; none were called. |

See `BATCH_06_REPORT.md` for scope, known limits and the owner-review stop condition. The generated route entry and HTTP 404 do not constitute browser behavior verification.
