# Batch 09 Final Remediation Report

**Date:** 2026-11-20  
**Scope:** Corrective phase after the comprehensive Batch 09 audit  
**Verdict:** **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration; not a claim of live provider connectivity or production release approval.

## 1. Baseline findings

The second-pass audit identified two unresolved correctness defects. First, a PayPing verification timeout/network failure escaped as a generic HTTP 400 while the durable attempt remained `redirect_pending`. This made an externally uncertain payment look like a confirmed callback failure and provided no safe same-attempt verification recovery. Second, OTP verification selected the newest **unconsumed** challenge. If the newest challenge was exhausted, an older challenge could become selectable again, contrary to a latest-issued-only policy.

The baseline also contained documentation drift: the production guide still described PayPing as unconnected, the PostgreSQL procedure expected only 11 root migrations, and the state-machine document did not describe persisted verification uncertainty.

## 2. PayPing root cause and exact recovery changes

The root cause was in `verifyPayPingPayment`/`handlePayPingCallback`: fetch exceptions and provider 5xx responses were not classified separately from confirmed provider rejection, and callback data was not retained before returning uncertainty. The callback handler now:

1. Treats network exceptions and provider 5xx responses as `payping_verify_unknown`; HTTP 202 remains pending/unknown.
2. Persists `provider_outcome_unknown`, `reconciliation_required=true`, `settlement_error=payping_verification_outcome_unknown`, and the original `verification_payment_ref_id`.
3. Returns HTTP 202 with `reconciliationRequired`, never a paid result and never a new payment initiation.
4. Allows a later callback or the new authenticated `retryPayPingVerification` server function to reuse the same attempt, provider payment code, client reference, amount and original verification reference.
5. Marks a confirmed verification rejection as `failed` without storing a verified provider reference or settling the order.
6. Retains ownership checks through the joined order/customer relationship; the retry cannot operate on another customer’s attempt.

Unknown initiation without a provider payment code remains an admin-audited manual-review path. No retry path creates a second payment attempt for the same order.

## 3. OTP policy decision and exact changes

The implemented policy is **latest-issued challenge wins**. Issuing a new login OTP atomically marks all previous unconsumed login challenges for that mobile as consumed before inserting the new challenge. Verification selects the newest challenge regardless of `consumed_at`; a consumed or exhausted newest challenge therefore rejects rather than falling back to an older code. Existing mobile/purpose scoping, five-attempt limit, expiry, salted hash storage, IP/mobile send buckets, and no-blind-resend behavior for uncertain SMS delivery remain intact.

The changed implementation is `src/server/auth/customer.ts`. The regression suite now covers concurrent redemption, exact-challenge consumption, atomic issuance invalidation, last permitted attempt, and the former older-challenge fallback case.

## 4. New tests and evidence

New actual lifecycle coverage is in `src/server/payments/payping-lifecycle.test.ts`. It uses the project migration/PGlite harness and exercises callback parsing, provider 5xx uncertainty persistence, repeated callback recovery state, and confirmed rejection. Focused provider coverage remains in `src/server/sms/payping-providers.test.ts`.

The final available results were:

- `npm run typecheck`: passed.
- `npm run lint`: passed with 5 pre-existing warnings and 0 errors.
- `npm run build`: passed; Nitro/Vercel output generated successfully.
- Focused PayPing/SMS suite: 9 passed, 0 failed.
- Focused OTP suite: 5 passed, 0 failed.
- Focused PayPing lifecycle suite: 2 passed, 0 failed.
- `npm test` migration/integration group: 110 passed, 0 failed, 0 skipped.
- `npm test` script group: 212 passed, 4 failed because the supplied archive intentionally excludes private `.grok/skills/og` inputs. The application group and migration group otherwise completed; the overall shell command therefore exited 1. Those four failures are environment-blocked platform tests, not payment/OTP regressions.

No real PayPing or SMS.ir request, credential, customer number, live charge, sandbox account, or production deployment was used. No real PostgreSQL server or multi-connection concurrency harness was executed; PGlite evidence is explicitly not PostgreSQL-concurrency evidence.

## 5. Documentation changes

Corrected documentation includes `docs/PRODUCTION.md`, `docs/POSTGRESQL_VERIFICATION.md`, and `docs/PAYMENT_STATE_MACHINE.md`. The production guide now describes the connected-but-disabled lifecycle, exact SMS modes, 15 root migrations, and verification recovery. The PostgreSQL procedure now expects migrations `0002` through `0016`, calls out payment-attempt/index checks, and remains clearly prepared/not executed. The state machine now includes `provider_outcome_unknown`, same-attempt verification retry, and terminal `failed` rejection.

The package also includes the earlier audit and provider reports; this file is the final corrective-phase report and supersedes older Batch 09 counts where they differ.

## 6. Remaining limitations

PayPing’s official OpenAPI does not label the currency unit; the implementation uses the project’s integer IRR-to-Toman boundary and requires merchant/account confirmation before activation. Provider sandbox acceptance, live delivery/payment, callback behavior against the real gateway, merchant template approval, PostgreSQL migration execution, PostgreSQL locking/concurrency, backup/restore, hosting, TLS/proxy, monitoring, and browser/E2E checks remain external or unexecuted. The four private `.grok` script tests remain blocked by absent archive inputs. None of these limitations is represented as successful provider connectivity.

## 7. Final readiness verdict

**READY WITH DOCUMENTED LIMITATIONS.** The two unresolved high-risk corrective issues are fixed in source and covered by relevant available tests. The code can proceed to a controlled provider sandbox-configuration review only after merchant confirmation of PayPing units and with the external verification limitations above preserved. It is not a declaration of production release readiness.

**Final ZIP SHA-256:** supplied in the separately delivered final report copy; embedding a post-hash edit in this archive would change the archive digest.
