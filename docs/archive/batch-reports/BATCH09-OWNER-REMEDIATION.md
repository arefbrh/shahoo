# SHAHOO v1.0.0 — Batch 09 Owner Remediation

Date: 2026-11-20

## Scope

This owner-side patch is limited to the three requested follow-ups identified in the review of `shahoo-v1.0.0-batch09-remediation-final.zip`:

1. Keep PayPing verification HTTP 408 and 429 outcomes recoverable.
2. Prevent unexpected verification/runtime errors from being treated as confirmed provider rejection, and keep settlement errors outside the verification-rejection handler.
3. Add direct retry-path regression coverage and align the SMS.ir production environment-variable documentation with the implementation.

## Source changes

### PayPing transport (`src/server/payments/payping.ts`)

- Verification HTTP 408 and 429 now raise `payping_verify_unknown`, like network errors and HTTP 5xx.
- These statuses are not treated as proof that the payment was rejected.

### PayPing lifecycle (`src/server/payments/payping-lifecycle.ts`)

- Callback verification now marks an attempt failed only for the explicit `payping_verify_rejected` outcome.
- Other verification exceptions are persisted as `provider_outcome_unknown` with `reconciliationRequired=true` and return the existing pending/reconciliation response path.
- Successful provider verification is persisted before local settlement.
- Local settlement is executed outside the provider-verification catch, so a local settlement error cannot be reclassified as a provider rejection.
- The authenticated customer-facing retry function delegates to a separately testable attempt-level function.
- Retry now marks an attempt failed only for explicit `payping_verify_rejected`; all other verification exceptions preserve the unknown/recoverable state.
- Retry settlement is outside the verification catch.

### Regression tests (`src/server/payments/payping-lifecycle.test.ts`)

Added tests for:
- Callback HTTP 408 and 429 remaining recoverable.
- Direct verification retry preserving unknown state on HTTP 429.
- Direct verification retry preserving unknown state on an unexpected transport exception.
- Successful retry reusing the persisted amount, payment code, and payment reference, then settling the order.

### Production documentation (`docs/PRODUCTION.md`)

- Replaced the stale SMS provider row with the actual `SMS_MODE`, `SMS_LIVE`, and `SMS_PROVIDER` activation requirements.
- Documented `SMS_IR_API_KEY`, the `SMS_API_KEY` fallback, and `SMS_IR_OTP_TEMPLATE_ID`.
- Clarified that `SMS_SENDER` is Kavenegar-specific and not used by SMS.ir.

## Verification performed in this environment

- Node.js syntax checks passed for the three changed TypeScript files using Node's type-stripping syntax checker.
- `package-lock.json` was not modified.
- Full dependency installation and project tests were **not** completed here. `npm ci` could not be completed within the available execution window; an offline retry confirmed that the required `zustand@5.0.15` package was not present in the local npm cache.
- Therefore, the newly added tests are included but are **not reported as passing**. Typecheck, lint, build, and the full test suite still need to be run in Manus or another environment with dependencies available.

## Explicitly not verified

No real PayPing or SMS.ir credentials/endpoints were used. No provider sandbox, real SMS, real payment, production PostgreSQL concurrency, public callback reachability, or Windows VPS deployment was tested.

This patch does not establish live provider connectivity or production readiness.
