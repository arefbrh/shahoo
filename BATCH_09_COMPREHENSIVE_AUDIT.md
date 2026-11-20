# SHAHOO v1.0.0 — Comprehensive PayPing and SMS.ir Audit

Audit date: 2026-11-20. This audit covers the supplied SHAHOO source archive after the Batch 09 remediation. No live PayPing credential, SMS.ir credential, provider sandbox, real payment, or real SMS was used.

## Final verdict

**READY WITH DOCUMENTED LIMITATIONS** for the next phase of controlled provider-account and sandbox configuration. No critical or high-severity payment/OTP correctness issue remains in the audited source paths. PayPing and SMS.ir remain disabled by default. This verdict means code and mocked application behavior are ready for controlled configuration work; it does not mean either provider is connected or production-verified.

The remaining limitations are external or environment-bound: no authorized provider sandbox credentials were available, the official PayPing OpenAPI does not itself label the currency unit, real PostgreSQL multi-connection concurrency was not run, and four private platform tests require absent `.grok` files.

## Initial project baseline

The project is a TypeScript React/Node.js application using TanStack Start, Vite, Drizzle ORM, PostgreSQL in production, and PGlite for local tests/development. `package.json` defines the runtime and test scripts. `src/server/db/schema.ts` contains order, inventory, OTP, notification, payment, and payment-attempt models. Production database startup fails closed without `DATABASE_URL` in `src/server/env/runtime.ts`; migration execution requires an explicit production flag in the same module.

| Area | Existing implementation | Verified status | Identified risks at baseline |
|---|---|---|---|
| PayPing initiation | `src/server/payments/payping-lifecycle.ts:initiatePayPingPayment`; checkout calls `initiatePayPingPaymentFn` after server order creation when `paypingEnabled` is true | FIXED and reachable | Earlier adapter was isolated; now server-owned order and attempt are required |
| PayPing callback | `src/routes/api.payment.payping.callback.ts` accepts POST and delegates to `handlePayPingCallback` | FIXED | Callback is untrusted and now has streamed size/content-type parsing |
| PayPing verification | `src/server/payments/payping.ts:verifyPayPingPayment`; server-side `/v3/pay/verify` call | FIXED with mocked contract tests | No live account verification |
| Payment persistence | `payment_attempts` in `src/server/db/schema.ts`; migrations `0013`–`0015` | FIXED | Real PostgreSQL migration/concurrency evidence remains unavailable |
| Payment recovery | `settleAttempt`, stale settling lease recovery, customer retry, admin manual review | FIXED with documented provider limitation | PayPing does not provide a documented lookup path for an unknown creation outcome in the reviewed contract |
| Checkout integration | `src/components/site/checkout-view.tsx` selects unpaid/manual or PayPing; server function owns initiation | FIXED | Live option appears only with explicit production PayPing configuration |
| SMS.ir adapter | `src/server/sms/providers.ts:smsIrProvider` uses Verify endpoint, API key, template ID, normalized mobile, timeout | FIXED with mocked contract tests | No real account or sandbox evidence |
| OTP generation | `src/server/auth/crypto.ts:newOtpCode` uses cryptographic randomness; challenge stores a hash | VERIFIED | Plaintext is not persisted or logged |
| OTP delivery | `src/server/auth/sms.ts:deliverLoginCode` records masked notification status and distinguishes unknown network outcomes | FIXED | An uncertain delivery is not automatically resent |
| OTP verification | `src/server/auth/customer.ts:verifyCustomerOtp` and `otpChallenges` enforce hash, expiry, attempt limit, one-time consumption | VERIFIED by auth tests | Real multi-process behavior requires PostgreSQL evidence |
| Rate limiting | `src/server/auth/otp-limit.ts` locks mobile/IP buckets transactionally; `src/lib/otp-bucket.ts` applies cooldown/window limits | VERIFIED | Exact production thresholds remain product policy, not provider behavior |
| Environment configuration | `.env.example`, `runtime.ts`, `providers.ts` | FIXED | Explicit SMS modes are new; PayPing live activation still requires controlled configuration |
| Tests | `package.json` runs script, application, and migration groups; focused provider tests cover 9 cases | VERIFIED with blocked private group | Four private platform tests require unavailable `.grok` files |
| Documentation | This report, provider evidence, state machine, checklists, Windows notes, handoff and issue registers | FIXED | Provider account actions remain pending |

## PayPing findings and fixes

### Amount and currency boundary

SHAHOO stores integer Rial in fields such as `orders.totalIrr`. The centralized conversion is `paymentAmountToPayPingToman` in `src/server/payments/payping.ts`. It rejects non-positive, unsafe, fractional, and non-divisible-by-10 Rial values, then sends exactly `amountIrr / 10` as integer Toman. `payping-lifecycle.ts` persists that expected value in `payment_attempts.provider_amount_toman`; initiation, callback matching, and verification all use the same boundary.

The official PayPing WooCommerce integration documents conversion of supported store currencies to Toman before sending the amount. The PayPing OpenAPI confirms the integer request field and endpoint contract but does not independently label the unit. Merchant account/sandbox confirmation remains required.

### Initiation and checkout

`CheckoutView` calls `placeOrderFn` first. The successful result contains the server-created `orderId`; when the PayPing option is selected, the browser calls `initiatePayPingPaymentFn` with that order ID and the existing checkout UUID. The server re-reads the order under the authenticated customer, verifies it is awaiting payment with held stock, inserts a durable `payment_attempts` row, calls PayPing with a trusted `PAYPING_RETURN_URL`, validates the returned HTTPS PayPing URL, and only then redirects the browser.

The database-level active-attempt index in migrations `0014_batch_09_payment_attempt_guards.sql` and `0015_batch_09_manual_review_guard.sql` prevents multiple unresolved attempts for one order. The client cannot choose the amount or callback URL.

### Unknown provider outcomes

Any exception while creating the PayPing payment is recorded as `provider_outcome_unknown`, not as a confirmed rejection. The same order remains blocked from replacement initiation. The reviewed official contract did not provide a documented payment-creation lookup operation that can safely resolve an unknown creation outcome. The safe operator path is:

1. Inspect the PayPing merchant account/dashboard using the persisted order and client reference.
2. If the provider shows no payment, an authorized admin with `orders.write` may use `reviewPayPingUnknownAttemptFn` to mark it `cancelled`, with a note of at least 10 characters.
3. If the provider-side status cannot be established, mark it `manual_review`; it remains active and blocks replacement payment attempts.
4. Never mark an attempt paid from the admin action. A successful provider payment must still return through the supported callback and server verification path.

### Callback and verification

The callback route accepts POST only. `parseCallback` in `payping-lifecycle.ts` accepts only JSON or form-encoded content, reads the request stream with a 32 KiB hard cap, and rejects malformed or unsupported input before database work. It correlates `clientRefId` and `paymentCode` to the persisted attempt, compares the provider Toman amount, then calls `/v3/pay/verify`.

HTTP 202/502 verification uncertainty is not converted to success. HTTP 409 is accepted only for `metaData.code === 110`, and the PascalCase documented duplicate payload fields are matched. Settlement requires the persisted provider reference, original IRR amount, provider amount, payment code, and client reference.

### Settlement recovery

Settlement claims are atomic through a conditional transition to `settling`. A process crash cannot strand a payment permanently: a `settling` row older than the five-minute lease is moved to `local_settlement_pending` and can be claimed again. If the local payment/inventory transaction succeeds but the final attempt update is interrupted, the payment idempotency key prevents duplicate local side effects on retry. If the local operation fails, verified evidence remains in `payment_attempts` with `reconciliation_required=true`.

## SMS.ir findings and fixes

`src/server/sms/providers.ts` uses the official Verify endpoint `POST https://api.sms.ir/v1/send/verify`, the `x-api-key` header, JSON body, normalized mobile without the leading zero, configured template ID, and the documented `Code` parameter. A response is accepted only when `status === 1` and a positive integer `data.messageId` exists.

SMS operation modes are explicit:

- `SMS_MODE=disabled` is the default and sends nothing.
- `SMS_MODE=sandbox` supports only the explicit local mock provider with `ALLOW_MOCK_SMS=1`; it never falls through to SMS.ir live calls.
- `SMS_MODE=live` additionally requires production, `SMS_LIVE=1`, provider credentials, and template ID validation.

Legacy development mock behavior remains compatible when `SMS_MODE` is omitted, but production never uses that fallback. `smsIsConfigured` and `resolveSmsProvider` now share the same safe provider policy.

Network exceptions, timeouts, HTTP 408, and HTTP 5xx responses are classified as `sms_delivery_unknown`; confirmed non-success responses remain rejection/failure. `deliverLoginCode` records `unknown` notification status and `customer.ts` does not automatically consume-and-resend an uncertain OTP. OTP generation remains cryptographically random, hashed at rest, bounded by expiry and maximum attempts, one-time, and protected by transactionally locked mobile/IP buckets.

The reviewed SMS.ir documentation does not establish final handset delivery from an accepted API response. The application therefore records provider acceptance as SMS sent, not handset delivery.

## Newly discovered issues and tracking

| ID | Severity | Status | Evidence and resolution |
|---|---|---|---|
| NEW-PAY-001 | HIGH | FIXED | Callback previously relied on `Content-Length`; `parseCallback` now enforces a streamed 32 KiB cap. |
| NEW-PAY-002 | HIGH | FIXED | `settling` could strand after a crash; five-minute lease recovery now returns it to `local_settlement_pending`. |
| NEW-PAY-003 | HIGH | FIXED | Unknown initiation now blocks replacement attempts and has admin `manual_review`/`cancelled` action with audit. |
| NEW-SMS-001 | HIGH | FIXED | SMS mode ambiguity could permit configuration drift; explicit disabled/sandbox/live modes now fail closed. |
| NEW-SMS-002 | MEDIUM | FIXED | Network SMS failures were indistinguishable from rejection; unknown delivery is persisted and no blind resend occurs. |
| NEW-CONFIG-001 | MEDIUM | FIXED | `.gitignore` ignored `.env.example`; `!.env.example` now preserves the safe template. |
| PAY-001 | HIGH | FIXED | PayPing is reachable from checkout through authenticated order-owned initiation. |
| PAY-002 | HIGH | FIXED | Verified evidence survives local settlement failure in `payment_attempts`. |
| PAY-003 | HIGH | FIXED | IRR/Toman boundary is centralized and persisted. Merchant confirmation remains an external limitation, not an implementation assumption. |
| PAY-004 | MEDIUM | FIXED | Exact HTTP 409/code 110 Already Verified handling and identifier matching. |
| SMS-001 | MEDIUM | FIXED | SMS.ir Verify request/response contract is mocked and validated. |
| EXT-001 | MEDIUM | REQUIRES PROVIDER CONFIGURATION | No real PayPing/SMS.ir credentials or sandbox account was supplied. |
| EXT-002 | MEDIUM | BLOCKED | Real PostgreSQL multi-connection concurrency was not available; PGlite tests are not claimed as PostgreSQL proof. |
| TEST-001 | LOW | BLOCKED | Four private platform tests require absent `.grok` files; application and migration groups pass. |

## Security and reliability review

The final second-pass review found no path for a customer to select another customer’s order during initiation or retry. Callback settlement is based on persisted attempt correlation plus provider verification, not callback status alone. Payment URLs are restricted to HTTPS `api.payping.ir`. Provider secrets remain server-side. OTP values are hashed and not written to notification bodies or audit metadata. Provider exceptions return generic safe outcomes and do not expose API keys or stack traces.

The remaining operational limitation is external provider resolution of an unknown creation outcome: the reviewed PayPing contract did not document a lookup endpoint. The application therefore requires dashboard/manual review instead of inventing a lookup call or blindly creating a replacement payment.

## Database and migration changes

- `0013_batch_09_payment_attempts.sql` creates durable attempt records.
- `0014_batch_09_payment_attempt_guards.sql` adds `provider_amount_toman`, safely backfills divisible historical IRR amounts, rejects non-divisible data, and creates the active-attempt index.
- `0015_batch_09_manual_review_guard.sql` replaces that index predicate to include `manual_review`, without changing payment/order records.
- `payment_attempts` stores order ID, internal IRR amount, provider Toman amount, idempotency key, provider code/reference, verified amount/time, state, expiry, settlement error, and reconciliation flag.

A migration operator must review any non-divisible existing attempt before applying `0014`; the migration intentionally aborts rather than guessing a conversion.

## Test report

| Test group | Command | Result | Passed | Failed | Skipped | Notes |
|---|---|---:|---:|---:|---:|---|
| Dependencies | `npm ci` | PASS | 431 packages installed | 0 | 0 | npm reported 0 vulnerabilities |
| TypeScript | `npm run typecheck` | PASS | — | 0 | 0 | Repository toolchain used |
| Lint | `npm run lint` | PASS with warnings | — | 0 | 0 | 5 pre-existing warnings |
| Build | `npm run build` | PASS with warnings | — | 0 | 0 | Existing module-level `use client` bundler warnings |
| Focused PayPing/SMS | `node --experimental-strip-types --test src/server/sms/payping-providers.test.ts` | PASS | 9 | 0 | 0 | Conversion, callback contract, ownership, modes, unknown SMS outcome |
| Auth/runtime focus | `node --experimental-strip-types --test src/server/auth/auth.test.ts src/server/env/runtime.test.ts` | PASS | 13 | 0 | 0 | OTP echo/configuration and runtime policy |
| Application group | `npm test` application command | PASS | 226 | 0 | 0 | Includes focused provider tests |
| Migration/integration group | `npm test` migration command | PASS | 103 | 0 | 0 | PGlite/application integration; not PostgreSQL concurrency proof |
| Private platform scripts | `npm test` script command | BLOCKED | 212 | 4 | 0 | Four tests require absent private `.grok` files |

No real provider endpoint was contacted. No real SMS or payment was performed. No GitHub integration or GitHub Actions work was started.

## Remaining limitations

1. PayPing and SMS.ir accounts, credentials, template approval, and provider sandbox behavior remain unverified.
2. The PayPing OpenAPI does not itself label the amount unit; the official WooCommerce integration supports the selected Toman conversion convention, but the merchant account must confirm it before activation.
3. Real PostgreSQL multi-connection callback/retry concurrency remains unexecuted. PGlite results are reported only as application-level evidence.
4. Four private platform tests remain blocked by unavailable `.grok` files.
5. Windows VPS deployment was reviewed at the compatibility level only; no VPS deployment was performed.

## References

[1]: https://docs.payping.ir/ "PayPing API documentation"
[2]: https://statics.payping.ir/openapi.json "PayPing OpenAPI specification"
[3]: https://github.com/payping/plugins-woocommerce "Official PayPing WooCommerce integration"
[4]: https://sms.ir/rest-api/ "SMS.ir REST API documentation"

## Final ZIP checksum

The final comprehensive archive is `shahoo-v1.0.0-batch09-comprehensive-final.zip`. Its SHA-256 is recorded in the companion checksum file and is regenerated after this report is packaged.

## Final corrective-phase supersession — 2026-11-20

The earlier audit counts are historical. The final correction adds persisted PayPing verification recovery, same-attempt ownership-checked retry, latest-issued-only OTP invalidation, and actual callback lifecycle tests. Current available results are: typecheck PASS; lint PASS with 5 warnings; build PASS; focused provider 9/9 PASS; OTP 5/5 PASS; lifecycle 2/2 PASS; migration/integration 110/110 PASS; script group 212/216 PASS with 4 private `.grok` inputs blocked. No real provider or PostgreSQL concurrency run was performed. Final verdict: **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration.
