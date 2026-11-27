# SHAHOO v1.0.0 — Batch 09 remediation report

## 1. Executive summary

Batch 09 now contains a durable PayPing payment-attempt boundary instead of an isolated HTTP adapter. PayPing is registered in the existing provider architecture, initiation is authenticated and order-owned, callbacks are handled through a POST route, official verification responses are validated, and provider verification evidence is persisted before local settlement. If inventory capture or the local transaction fails after external verification, the attempt remains marked for reconciliation and can be retried without starting another provider payment.

The project is **NOT READY — CONTROLLED ACTIVATION ONLY** for production or live PayPing activation. The official PayPing WooCommerce integration documents conversion of supported store currencies to Toman, and the implementation now converts integer IRR to integer Toman with strict divisibility checks. No authorized sandbox credentials were supplied, no real PostgreSQL multi-connection verification was available, and the existing OTP older-challenge policy remains unresolved.

## 2. Initial archive verification

The supplied archive was not overwritten. Baseline SHA-256: `8e6380c88438607203509584de6434389232e6e203ff5ca4f1d20881a503ccfa`. The archive contained 433 ZIP entries, 392 extracted files, and 42 extracted directories; compressed size was 4,131,668 bytes. `unzip -t` completed successfully. The project had no `.git` metadata, so no original Git state was available. Baseline per-file hashes are stored outside the project during the task.

No real secrets were added. The delivered archive excludes `node_modules`, `.git`, build output, local databases, and real environment files.

## 3. Source findings and changes

The source reproduced the audit’s central issue: `src/server/payments/payping.ts` contained HTTP primitives, but no initiation caller, durable provider attempt, callback route, or settlement/reconciliation boundary connected it to `captureVerifiedPayment`. `captureVerifiedPayment` verified a provider before its local transaction and could roll back all local evidence after an external charge.

Changed files are:

- `src/server/db/schema.ts`: additive `paymentAttempts` table definition with order, amount, currency, idempotency, provider references, state, verified amount/time, expiry, settlement error, and reconciliation flag.
- `migrations/0013_batch_09_payment_attempts.sql` and `migrations/0014_batch_09_payment_attempt_guards.sql`: forward-only PostgreSQL migrations with provider-unit persistence, safe backfill rejection for non-divisible IRR, and one unresolved active attempt per order.
- `src/server/payments/payping.ts`: strict integer IRR-to-Toman conversion, exact official 409/`metaData.code=110` handling, and strict reference/amount matching.
- `src/server/payments/service.ts`: PayPing registration in the existing provider interface and resolver.
- `src/server/payments/payping-lifecycle.ts`: authenticated initiation, provider callback validation, durable verification, local settlement, and reconciliation retry.
- `src/server/payments/api.ts`: server functions for initiation and retry.
- `src/routes/api.payment.payping.callback.ts`: PayPing POST callback route.
- `src/server/sms/payping-providers.test.ts`: official Already Verified and rejection coverage.
- `package.json`: provider tests are now included in the standard test command.
- `.env.example`: corrected status comment; credentials remain blank and server-side.
- `docs/BATCH_09_PROVIDER_VERIFICATION.md`: official contract evidence and limitations.
- canonical handoff/status documents: Batch 09 status and remaining limitations are synchronized in the final package.

## 4. Finding-by-finding results

### B09-001 — HIGH — Connect PayPing to the existing payment lifecycle

Reproduced. The adapter was isolated. Resolved at source level by provider registration, authenticated initiation, persisted attempt creation before redirect, callback routing, server-side verification, and reuse of the existing local settlement helper. Live provider behavior remains untested.

### B09-002 — HIGH — Durable verification and reconciliation

Reproduced. The previous transaction could lose evidence after a successful external verification and local failure. Resolved at source level with `payment_attempts`, `provider_verified`, `local_settlement_pending`, `settled`, and reconciliation-required persistence. A real PostgreSQL concurrent settlement test remains outstanding.

### B09-003 — HIGH — Independently verify provider amount unit

Resolved at source level using the official PayPing WooCommerce integration convention: store amounts are converted to Toman before the API request. SHAHOO persists the expected provider Toman amount, rejects IRR values not divisible by 10, and verifies callback/provider responses in Toman. Merchant account-level confirmation and live sandbox testing remain required.

### B09-004 — MEDIUM — Official Already Verified response

Resolved at adapter level. Only HTTP 409 with exact `metaData.code=110` is accepted, and amount, payment code, payment reference, and client reference are matched. Other 409 responses are rejected.

### B09-005 — MEDIUM — Provider tests included in npm test

Resolved. `src/server/sms/payping-providers.test.ts` is included in the standard application test command.

### B09-006 — MEDIUM — Provider and failure-path coverage

Partially resolved. Deterministic adapter tests cover valid requests, invalid inputs, redirects, malformed/mismatched responses, and Already Verified behavior. Durable database failure, independent PostgreSQL concurrency, and live sandbox behavior remain unverified.

### B09-007 — MEDIUM — Canonical documentation

Resolved in this package’s Batch 09 report, provider evidence, handoff, project state, decisions, remaining issues, production, and release documents. Historical information was not deleted.

### B09-008 — MEDIUM — OTP challenge policy

Not resolved by design. The existing behavior and owner-approval dependency remain documented. No silent security-policy change was made.

### B09-009 — LOW — `.env.example` Git ignore behavior

Resolved at source level: the template remains present and contains no secrets. `.gitignore` still uses `.env.*`, so whether the template is tracked must be enforced by the repository’s Git state when a real repository is supplied; this archive has no `.git` metadata.

## 5. Test evidence

Executed successfully: `npm ci` (exit 0, 431 packages, 0 reported vulnerabilities), `npm run typecheck` (exit 0), `npm run build` (exit 0, with existing bundler directive warnings), and the focused provider test (7 passing, including conversion and ownership coverage). The full `npm test` and `npm run lint` results are recorded below. No live SMS, payment, production endpoint, or production database was contacted.

## 6. Final readiness verdict

**NOT READY — CONTROLLED ACTIVATION ONLY.** The source remediation is coherent and ready for controlled code review. Live PayPing must remain disabled until an authorized sandbox is tested, real PostgreSQL transaction/concurrency evidence is collected, and the remaining release blockers are dispositioned.

## Verification addendum — 2026-11-19

- `npm ci`: exit 0; 431 packages installed; npm reported 0 vulnerabilities.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 with 5 existing warnings and 0 errors.
- `npm run build`: exit 0; the bundler emitted existing module-level `use client` directive warnings.
- Focused provider tests: 7/7 passed, including IRR-to-Toman conversion and database-relationship ownership predicate coverage.
- `npm test`: exit 1 because the configured script group is 212/216, with 4 failures requiring absent private `.grok` platform skill/reference files. The application group is 223/223 and the database/integration group is 103/103. No assertions were weakened and no tests were removed.

## Comprehensive audit addendum — 2026-11-20

The independent second-pass audit found and corrected four additional issues: streamed callback body limits replaced Content-Length-only protection; stale `settling` lease recovery prevents crash-stranded verified payments; an admin-authorized manual-review/cancel path now blocks unsafe replacement payments after unknown initiation outcomes; and SMS mode separation now distinguishes disabled, sandbox mock, and live operation. SMS network failures are recorded as unknown delivery outcomes and are never blindly resent. `.gitignore` now explicitly preserves `.env.example`.

The final verdict is **READY WITH DOCUMENTED LIMITATIONS** for controlled provider-account and sandbox configuration, not live connectivity. See `BATCH_09_COMPREHENSIVE_AUDIT.md`, `docs/PAYMENT_STATE_MACHINE.md`, `docs/PAYPING_CONFIGURATION_CHECKLIST.md`, `docs/SMSIR_CONFIGURATION_CHECKLIST.md`, `docs/TEST_REPORT_BATCH_09.md`, and `docs/WINDOWS_VPS_COMPATIBILITY.md`.
