# SHAHOO v1.0.0 — Batch 09 integration report

**Date:** 2026-11-19  
**Input:** `SHAHOO-v1.0.0-batch08-revision02.1.zip` (owner-supplied authoritative archive).  
**Disposition:** Provider-specific SMS.ir OTP adapter implemented; PayPing v3 HTTP primitives implemented. **End-to-end payment initiation, callback route, settlement and reconciliation are not completed. Do not configure live PayPing. This ZIP is not production-ready and Batch 09 is not complete.** No provider calls, real SMS, payment, PostgreSQL, deployment or production database were used.

## Source preflight

The archive was extracted and the mandatory source areas were inspected. `src/lib/auth/preview.ts` no longer contains the previously reported hardcoded shared OAuth credential. `.env.example` exists and contains placeholders only. The platform auth readers use exact raw `"true"` checks. Checkout and late-payment stock recovery both pass soft-deleted variant state into the sellability rule. OTP verification conditionally redeems the checked challenge ID and confirms that exact ID was returned. Seed initialization looks up existing homepage section types before inserting missing types.

OTP flow remains the existing SHAHOO customer OTP flow: normalized Iranian mobile, DB-backed mobile/IP throttles, a salted scrypt code hash, two-minute expiry, five attempts, challenge consumption and customer session creation. The separate admin login remains password-based. The older-challenge-after-newer-challenge-exhaustion behavior remains unchanged; this still requires an explicit owner security/product decision.

## Provider contract verification

Verified on 2026-11-19 from SMS.ir's official REST API reference at [https://sms.ir/rest-api/](https://sms.ir/rest-api/). Its Verify operation is `POST https://api.sms.ir/v1/send/verify`, authenticated with `x-api-key`, with JSON fields `mobile`, integer `templateId`, and `parameters` entries containing `name` and `value`. The documented response uses `status`, `message`, and `data`; documented success is `status: 1`, with `data.messageId` and `data.cost`. The published reference describes a sandbox API key and default template `123456`; no sandbox credentials were used. The production OTP adapter currently expects parameter name `Code` and phone digits without the leading zero. Confirm the merchant's approved template parameter and sandbox account before any provider test. The documentation lists provider error codes, including request limits, invalid keys, invalid mobile, missing template and disallowed template plan. It did not establish a universal numeric request rate limit for this account.

Verified on 2026-11-19 against PayPing's official [API specification](https://docs.payping.ir/) and [published OpenAPI JSON](https://statics.payping.ir/openapi.json). The OpenAPI server is `https://api.payping.ir/`. Payment initiation is `POST /v3/pay` with a Bearer token and body fields including `amount`, `returnUrl`, and `clientRefId`; a successful response contains `paymentCode`, `url`, and `amount`. The official callback is form-encoded POST to the configured `returnUrl`, and contains `status`, `errorCode`, and payment data including `clientRefId`, `paymentCode`, `paymentRefId`, and `amount`. Server verification is `POST /v3/pay/verify` with `amount`, `paymentCode`, and integer `paymentRefId`; verified response includes `amount`, `paymentRefId`, `clientRefId`, and code. The reference documents HTTP 202/502 as verification still processing and 409 metadata code 110 as already verified. The API report schema explicitly labels transaction amount in Rial. SHAHOO's stored order totals are integer IRR (Rial), while storefront display is Toman; therefore the adapter's unit boundary is identity: send persisted `totalIrr` as integer Rial, never a browser total. PayPing's base API specification did not establish an officially supported sandbox/test environment. No sandbox or live transaction was attempted.

## Files changed and implementation

Changed: `src/server/sms/providers.ts`, `src/server/auth/sms.ts`, `src/server/auth/crypto.ts`, `src/server/auth/auth.test.ts`, `src/server/env/runtime.ts`, `src/server/env/runtime.test.ts`, `.env.example`. Added: `src/server/payments/payping.ts`, `src/server/sms/payping-providers.test.ts`, this report.

SMS.ir OTP sending now uses the official Verify endpoint and sends the existing challenge code only server-to-server. It validates the phone and five-digit code, has an 8-second timeout, validates HTTP and provider-level success, and does not include provider response contents or secrets in thrown errors. SMS.ir configuration requires `SMS_PROVIDER=smsir`, `SMS_LIVE=1`, production mode, an API key (`SMS_IR_API_KEY`, with legacy `SMS_API_KEY` accepted), and `SMS_IR_OTP_TEMPLATE_ID`. No bulk-message endpoint is used for OTP. Existing throttles, expiry, attempt limits, hashed OTP storage and exact-challenge redemption remain in place. The template ID and API key are server-only environment values.

The PayPing module implements request/response validation for the documented create-payment and verify operations, an 8-second timeout, Bearer authentication, integer IRR validation, exact expected amount/reference checks, and HTTPS/host validation of the provider redirect. It is an isolated adapter only: it is not called by an order-start operation, there is no callback route, no durable PayPing attempt lifecycle and no payment settlement integration. `PAYPING_LIVE` is therefore not a valid enablement instruction; do not set it. No payment status is changed by a redirect or provider callback because no callback handler exists.

No migration was added. Existing `payments`, `payment_logs`, `ops_diagnostics`, orders and inventory remain unchanged. No actual credentials were added. No user-facing UI or brand/checkout behavior was changed.

## Critical blockers and remaining risks

The existing `captureVerifiedPayment` creates and verifies its own provider intent in one call. It cannot consume a PayPing intent created before redirect or atomically update a pre-existing pending attempt. More critically, if PayPing verifies a charge but SHAHOO cannot capture/recover stock or commit its database transaction, the current schema/service does not durably persist verified-but-unsettled PayPing evidence before local settlement. A manual recovery path and idempotent retry/reconciliation have not been implemented. Wiring the callback to the existing helper would be incorrect and could lose evidence of a real charge. **PayPing initiation and callback remain blocked; live PayPing must stay disabled until a minimal durable attempt/reconciliation design, operator procedure, and failure-mode tests are implemented.**

The OTP selection policy can permit an older unconsumed challenge to be selected after a newer challenge is exhausted; no policy change was made without an owner decision. SMS.ir template parameter agreement and account-specific throttling require merchant-panel confirmation. Provider acceptance is not proof of handset delivery.

## Verification

- `npm ci`: executed and passed; lockfile installation completed, audit reported 0 vulnerabilities.
- Focused auth, mocked adapter and runtime tests: 18/18 passed (`node --experimental-strip-types --test src/server/auth/auth.test.ts src/server/env/runtime.test.ts src/server/sms/payping-providers.test.ts`). Tests use no real provider network and no customer numbers. The regressions verify SMS.ir-specific credentials cannot accidentally enable OTP echo, while mock SMS requires explicit non-production opt-in.
- `npm run typecheck`: executed and passed after correcting two optional test-call typings.
- `npm run lint`: executed and passed with 5 warnings, 0 errors; warnings are existing project lint warnings.
- `npm test`: executed and failed at aggregate level, 212/216 script tests. The 4 failures require absent private `.grok/skills/og/SKILL.md` / references. Application group passed 217/217; migration/PGlite group passed 103/103. Tests were not removed, skipped, or weakened.
- `npm run build`: executed separately and passed; existing bundler warnings about `use client` directives were printed.
- Focused changed-file ESLint and final TypeScript typecheck: passed. Focused auth/adapter/runtime tests: 18/18 passed.
- `npm audit` from `npm ci`: 0 vulnerabilities reported.
- Real PostgreSQL migration/concurrency tests, browser E2E/accessibility, provider sandbox/live calls, SMS delivery, PayPing transaction, production deployment and provider verification were not executed.
- Static review is not evidence of live integration, PostgreSQL concurrency, or production readiness.

## Owner setup guidance

After a separately reviewed and completed payment lifecycle, an owner may place provider credentials in the deployment secret manager, not source or `.env.example`. SMS.ir requires a server-only key and an approved Verify template ID. PayPing must remain unconfigured until attempt persistence, callback verification, settlement/reconciliation, operator procedures and tested enablement gates exist. No provider credentials should be sent to the client, URL, logs or repository.

## Batch 09 remediation completion addendum — 2026-11-19

The original implementation report is historical evidence of the isolated adapter stage. The current remediation is documented in `BATCH_09_REMEDIATION_REPORT.md`: durable payment attempts, PayPing lifecycle registration, callback verification, official 409/code-110 handling, reconciliation persistence, updated provider tests, and synchronized handoff documents. PayPing remains disabled pending amount-unit confirmation and controlled provider/PostgreSQL verification.
