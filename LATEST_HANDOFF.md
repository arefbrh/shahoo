# Historical handoff archive — superseded

This file contains chronological handoffs from earlier batches. Some instructions and status statements below are obsolete. Do not use them to determine current project state or authorization. Start with [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), then [REMAINING_ISSUES.md](REMAINING_ISSUES.md) and [BATCH_09_COMPREHENSIVE_AUDIT.md](BATCH_09_COMPREHENSIVE_AUDIT.md). The documentation map is [docs/README.md](docs/README.md).

---


# Latest Handoff — Batch 06 product/CMS (2026-11-19)

## Current handoff — Batch 06 product management and dynamic CMS (2026-11-19)

Input: owner-supplied complete archive `SHAHOO-v1.0.0-batch05-customer-account.zip`; output: `SHAHOO-v1.0.0-batch06-product-cms.zip` for owner review. Read `BATCH_06_REPORT.md`, `docs/CMS_MEDIA.md`, `PROJECT_STATE.md`, `REMAINING_ISSUES.md`, `DECISIONS.md` and the master context. No migration was added; migrations `0001`–`0011` remain unchanged. Product editor, gallery/media associations, bounded CMS lists, page creation at `/pages/{slug}`, article SEO and existing homepage/banner/menu workflows are recorded in the report. Focused CMS/media, catalog parser, commerce/account regression, scoped lint and TS/TSX checks passed. No Production database, deployment, object-storage provider or external API was used. Full verification remains for Batch 08. **Stop and wait for owner review; do not start Batch 07 without a separate explicit approval.**


Read in this order: `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` → `PROJECT_STATE.md` → `REMAINING_ISSUES.md` → `BATCH_02_REPORT.md` → `NEXT_BATCH_BRIEF.md`. `BATCH_01_REPORT.md` and `BATCH_00_REPORT.md` are history. Where documents disagree, the source wins.

## Batch 03 correction (2026-11-18) — read this first
Archive `SHAHOO-v1.0.0-batch03-correction.zip`, built from the Claude Batch 03 archive. Fixes guest-wishlist data loss on login (confirmed migration, retry notice), the stale wishlist read race, and stale documentation. Details: `BATCH_03_REPORT.md` (section "Batch 03 correction"). Not owner-approved. Batch 04 not started.
**First task with network:** `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `env -u DATABASE_URL npm test`, build with `DATABASE_URL` unset, then a browser pass for login → wishlist migration → retry → logout → account switch and the four viewports. None of this ran in the sandbox. Still unexecuted from earlier: `correction.test.ts`, edited `flow.test.ts`.
`AGENTS.md` is now portable; the old platform file is `docs/archive/AGENTS.grok-platform-original.md`.

## Batch 03 (2026-11-18) — read this first
Archive `SHAHOO-v1.0.0-batch03.zip`, built from `SHAHOO-v1.0.0-batch02-correction.zip`. Frontend reliability only; details in `BATCH_03_REPORT.md`. Not owner-approved. Batch 04 not started.
**First task with network:** `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `env -u DATABASE_URL npm test`, build with `DATABASE_URL` unset, then a real browser pass at 360×800, 390×844, 768×1024, 1440×900. None of these ran in the Batch 03 sandbox. Also still unexecuted: `correction.test.ts` and the edited `flow.test.ts` fixture from the Batch 02 correction.
Do not run the race script, migrations or the build against a real database.

## Batch 02 correction (2026-11-17) — read this first
Archive: `SHAHOO-v1.0.0-batch02-correction.zip`, built from the uploaded `SHAHOO-v1.0.0-batch02.zip`. Three fixes (recovery category validation, refund-to-payment link, media locking) are in source; details, files and results are in `BATCH_02_REPORT.md`. The earlier "Verified status" figures below belong to the original Batch 02 and were **not re-run** for the correction.
**First task for the next agent with network:** `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `env -u DATABASE_URL npm test`, then `PG_RACE_CONFIRM=disposable PGHOST=<local throwaway server> scripts/pg-media-race.sh`. The new `src/server/commerce/correction.test.ts` and the edited `flow.test.ts` fixture have never been executed. Fix anything they reveal before approving. Never run the race script or migrations against Neon or production.
Behaviour change to know: a paid cancel now needs exactly one verified payment row for the order.
Batch 03 was not started.

## Verified status (original Batch 02)
The owner approved the Batch 01 correction. Batch 02 (commerce integrity only) is packaged for owner review as `SHAHOO-v1.0.0-batch02.zip`. It is not approved. Batch 03 was not started.

Batch 02 added `migrations/0008_batch_02.sql` (`payments.currency` IRR check, `payments.refund_of_payment_id`). It did not connect a payment gateway, SMS provider, or carrier. It did not use a production database. It did not delete customer or order data.

`npm run build` does not migrate. Production without `DATABASE_URL` fails closed. Demo products still require `SEED_DEMO=1` outside production. Mock payment remains impossible in production.

Full `env -u DATABASE_URL npm test` exit 0: 205 script, 145 app, 37 database tests, 0 failures. `npx tsc --noEmit` exit 0. `npx eslint . --quiet` exit 0. Build exit 0. Multi-connection PostgreSQL was **NOT EXECUTED**.

## Important decisions preserved
- No rewrite; brand, logos, palette, RTL, and unrelated pages stay.
- Money is integer IRR. Display toman is ÷10. New payment and refund rows store currency IRR.
- The 24-hour stock hold is unchanged. Paid or captured stock is not released by expiry.
- Guest merge sums once. Repeated local adopt uses max. Both clamp to sellable stock and 20.
- Refunds are ledger entries. Restock only when a full refund asks for it.
- Stock and coupon updates stay conditional UPDATEs.
- Customer online support UI stays removed. Admin support and ticket tables stay.
- Account wishlist link is still there. Removing the duplicate wishlist entry is Batch 05, not done here.
- Homepage «برگزیده‌ها», cart drawer, carousel, and profile demographics are not started.

## Cautions for the next agent
- Do not run migrations against Neon or any customer database. `npm run db:migrate` needs an explicit disposable `DATABASE_URL`. Production also needs `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`. Apply `0008` only on a database you are allowed to change.
- `npm run dev` sets `SEED_DEMO=1`, `ECHO_OTP=1`, and `ALLOW_DEV_CSP=1` so the local preview has a catalog. Those variables do not override production.
- `.grok/` is a platform folder. It is not part of the SHAHOO deliverable. Do not invent it to turn platform tests green. Batch 00 saw 8 script failures without it.
- `migrations/auth/0001_auth.sql` exists and must not be edited. Shop migrate does not apply it.
- Do not describe a PGlite `Promise.all` test as multi-connection PostgreSQL proof.
- Do not connect a gateway until stock-recovery failure has a reconciliation design. Today a failed recovery stores no verified payment and does not consume the key. That is acceptable only because no live money moves.
- If media file cleanup fails after commit, the row stays soft-deleted, a `media.file_cleanup` diagnostic is written, and the file can remain.
- Do not delete tests to go green. Do not add dependencies or bump versions.
- An existing database that already has `foundation.seed` or the old baseline rows is not wiped.
- With `SEED_DEMO=1`, the sample about page and some homepage section copy are still inserted. That path is not production.

## Next recommended batch
Batch 03 as defined in `NEXT_BATCH_BRIEF.md`. Do not start it until the owner reviews `SHAHOO-v1.0.0-batch02.zip`.


## Batch 04 correction handoff details (2026-11-19; current)

- Correction source is delivered for review; no publish, payment/SMS enablement, external provider call or next batch.
- Run the remaining deferred checks listed in `TEST_REPORT.md` in Batch 08, not now. The focused PGlite tests were isolated; real PostgreSQL and Production migration behavior are not verified.
- `0010_batch_04_home_sections.sql` provisions only missing section types; existing CMS rows and edits are preserved. Production still requires the standard guarded `npm run db:migrate` before serving; startup does not auto-migrate. The CMS can edit title, description, activation and order but does not create these structural rows.
- Session-scoped cart intents fail closed when browser storage is unavailable. Set retries compare cart identity and quantity but cannot detect ABA; interrupted non-idempotent adds can commit after a fresh review. Resolve these limitations before production.
- `BATCH_09_INTEGRATION_PREPARATION.md` is preparation only. The pre-existing conditional SMS.ir adapter was not enabled or expanded.

The homepage continues to use database-backed CMS sections and product selection. When a section has no matching real products, the page displays a Persian empty-state message rather than fabricating associations or suppressing the section heading. Wait for owner review before any next batch.

## Batch 09 remediation status — 2026-11-19

Batch 09 is the current remediation stage. PayPing is source-integrated through durable payment attempts, authenticated initiation, a POST callback, official server-side verification, and reconciliation-required persistence for local settlement failures. SMS.ir Verify remains the existing OTP adapter with no live call. PayPing remains disabled until the official amount unit is confirmed, an authorized sandbox is tested, and PostgreSQL concurrency evidence is collected. See `BATCH_09_REMEDIATION_REPORT.md` and `docs/BATCH_09_PROVIDER_VERIFICATION.md`.


## Batch 09 correction addendum — 2026-11-19

The final correction now connects the existing checkout to an opt-in PayPing initiation server function when controlled live configuration enables it; the default unpaid-order path remains unchanged. PayPing receives integer Toman after strict IRR divisibility validation, and `provider_amount_toman` is persisted for callback and verification matching. Migration `0014_batch_09_payment_attempt_guards.sql` safely backfills existing divisible attempts and refuses non-divisible data before enforcing one active unresolved attempt per order. Callback bodies are bounded and content-type checked; provider client reference, code, reference, and Toman amount are matched before evidence is persisted. Settlement uses an atomic claim state, and customer retry authorization requires the joined order/customer relationship.

Final evidence: `npm ci` passed with 431 packages and 0 vulnerabilities; typecheck passed; build passed with existing bundler directive warnings; lint passed with 5 pre-existing warnings and 0 errors; focused PayPing/SMS tests passed 7/7. The full `npm test` application and integration groups passed 223/223 and 103/103. The configured private platform group remains 212/216 because four tests require absent private `.grok` files. Live provider calls and real PostgreSQL multi-connection evidence remain outstanding.

## Comprehensive payment/SMS audit addendum — 2026-11-20

The independent second pass is complete. PayPing now has streamed callback size enforcement, stale-settling lease recovery, a durable manual-review/cancel path for unknown initiation outcomes, and an active index that includes manual review. SMS.ir now has explicit disabled/sandbox/live modes, sandbox-to-live fallback prevention, and unknown network delivery handling that avoids blind OTP resend. `.env.example` is explicitly unignored. Final verdict: **READY WITH DOCUMENTED LIMITATIONS** for controlled provider configuration; no live provider connectivity is claimed. Read `BATCH_09_COMPREHENSIVE_AUDIT.md` first for current findings and exact test counts.

## Batch 09 final corrective phase — 2026-11-20

The final corrective pass fixed PayPing verification uncertainty recovery and the OTP latest-issued policy. PayPing verification network/5xx/202 responses now persist `provider_outcome_unknown`, `reconciliation_required`, and `verification_payment_ref_id`; the same attempt can be retried through an ownership-checked server function without creating a new payment. Confirmed rejection becomes `failed`. OTP issuance atomically consumes prior unconsumed login challenges, and verification cannot fall back to an older challenge after the newest is exhausted. The final focused lifecycle, provider, and OTP tests pass. Full `npm test` has 4 blocked private `.grok` script failures (212/216 pass); the migration/integration group passes 110/110. Real provider connectivity and PostgreSQL concurrency remain unexecuted. Final verdict: **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration; stop for independent review.
