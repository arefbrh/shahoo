# Batch 09 Final Test Report

## Commands and results

| Command | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | 431 packages installed; npm audit reported 0 vulnerabilities. |
| `npm run typecheck` | PASS | TypeScript completed with exit code 0. |
| `node --experimental-strip-types --test src/server/sms/payping-providers.test.ts` | PASS | 9 tests passed, 0 failed, 0 skipped. |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/auth/customer-otp.test.ts` | PASS | 5 tests passed, 0 failed, 0 skipped. |
| `node --experimental-transform-types --import ./scripts/ts-alias-register.mjs --test src/server/payments/payping-lifecycle.test.ts` | PASS | 2 tests passed, 0 failed, 0 skipped. |
| `npm run lint` | PASS WITH WARNINGS | 0 errors; 5 existing warnings in unrelated cart/support/test files. |
| `npm run build` | PASS | Production Nitro/Vercel build completed. |
| `npm test` script group | BLOCKED | 216 tests: 212 passed, 4 failed because private `.grok/skills/og/SKILL.md` and references are absent from the supplied archive. |
| `npm test` application group | PASS | Completed as part of the full command; no failure was reported in the captured output. |
| `npm test` migration/integration group | PASS | 110 tests: 110 passed, 0 failed, 0 skipped. Includes OTP and PayPing lifecycle tests. |

The overall `npm test` shell command exited 1 because its script group includes four archive-external `.grok` tests. It is not accurate to report the overall command as fully green.

## Provider mock evidence

The provider suite covers SMS.ir normalized mobile/template payload and documented success/rejection handling; explicit disabled, sandbox-only, live validation, sandbox-to-live fallback prevention, and network-unknown delivery behavior; PayPing integer IRR-to-Toman conversion, v3 request/verify identity matching, trusted redirect validation, official 409/metaData.code=110 already-verified handling, and ownership predicate behavior.

The lifecycle suite uses the repository’s PGlite/migration test harness and mocks `fetch`. It proves that a PayPing 502 during verification persists `provider_outcome_unknown`, the original verification reference, and reconciliation-required state; a repeated callback remains recoverable; and a confirmed verification rejection becomes `failed` without a provider settlement reference.

## PostgreSQL and external environment evidence

No real PostgreSQL server was available or executed. The migration/integration tests use PGlite and are application-level evidence only; they do not prove PostgreSQL multi-connection locking, partial-index contention, backup/restore, or production migration behavior. No real PayPing or SMS.ir sandbox/live request was made, and no production VPS/hosting deployment was tested.

## Final interpretation

Relevant payment and OTP tests pass. External/provider and PostgreSQL checks remain explicitly unexecuted or blocked. The result supports **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration, not live connectivity or production release.

**Final ZIP SHA-256:** supplied in the separately delivered final report copy; embedding a post-hash edit in this archive would change the archive digest.
