# SHAHOO v1.0.0 — Batch 08 Revision 02.1 final release evidence

**Date:** 2026-11-19  
**Decision:** **NOT READY FOR RELEASE**  
**Scope:** Source-only correction, evidence reconciliation and local verification. No production host, real PostgreSQL service, live SMS/payment provider, or real customer data was used.

## Source and security corrections

The supplied Revision 02 archive contained a hardcoded shared platform-preview OAuth client secret in `src/lib/auth/preview.ts`. Revision 02.1 removes it from the working tree and requires `GROK_AUTH_CLIENT_SECRET` or `GROK_PREVIEW_CLIENT_SECRET` to be injected at runtime before optional broker OAuth can be configured. The input copy may already have exposed the credential; its owner must assess and rotate/revoke it. No live credential operation was performed here. A `detect-secrets` 1.5.0 scan of the working tree reported only test fixtures, documentation examples, and non-secret entropy/keyword candidates after the removal; no production credential candidate remained. The full scan output is outside the deliverable at `/home/ubuntu/shahoo-evidence/secret-scan.json`.

The whitespace-padded platform-auth flag discrepancy is corrected: the server and gate readers now require the raw exact value `"true"`, matching the wrapper and client. The optional platform scaffold remains separate from SHAHOO customer OTP and admin session/RBAC authentication.

Checkout and late-payment recovery now select and pass `productVariants.deletedAt` into the shared sellability rule. Focused baseline reproductions failed 3/3 before the fix; the corrected surrounding commerce suites passed 49/49, the shared sellability suite passed 7/7, typecheck passed, and targeted lint passed. OTP redemption now requires the exact checked challenge ID in the atomic `RETURNING` result. The pre-fix deterministic reproductions failed 2/3; the final targeted customer/auth/throttle suite passed 19/19, completion integration passed 15/15, typecheck passed, and targeted lint passed. Seed initialization now preserves existing baseline keys and allocates unused homepage section IDs when custom rows occupy canonical IDs; focused seed regressions passed 9/9.

## Final local verification

All commands ran from `/home/ubuntu/shahoo-work` with `DATABASE_URL` unset unless a test controlled its own fixture. Raw logs are outside the project in `/home/ubuntu/shahoo-evidence/final-logs/`.

| Command | Result |
|---|---:|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; one existing Vite config-loader warning |
| `npm test` | **FAIL: 4 of 216 script tests**; app group 217/217 and migration/PGlite group 103/103 passed |
| `node --test scripts/with-app-env.test.mjs scripts/check-auth-invariant.test.mjs` | PASS |
| `node --experimental-strip-types --test src/lib/auth/gate-identity.test.ts` | PASS, 27/27 |
| `npm audit --json` | PASS; 0 info, low, moderate, high or critical vulnerabilities; exit 0 |

The four aggregate script failures are platform-harness documentation checks: three `scripts/brand-check.test.mjs` cases cannot read absent private `.grok/skills/og/SKILL.md`, and one `scripts/write-atomic.test.mjs` handover case requires the corresponding private platform instructions. They are not being hidden, deleted or replaced. A matching authorized original-platform harness is required.

## Independent focused evidence

- `/home/ubuntu/shahoo-evidence/auth.md`: authentication and authorization audit.
- `/home/ubuntu/shahoo-evidence/seed-db.md`: seed safety, database-selection and PostgreSQL-boundary audit.
- `/home/ubuntu/shahoo-evidence/logs/commerce-regression.log`: deleted-variant regression, corrected suites and limitations.
- `/home/ubuntu/shahoo-evidence/logs/otp-regression.log`: OTP race red/green reproduction, final 19/19 targeted suite and resend-policy characterization.
- `/home/ubuntu/shahoo-evidence/logs/seed-regression.log`: seed collision red/green reproduction and final 9/9 focused result.
- `/home/ubuntu/shahoo-evidence/final-logs/results.tsv`: final typecheck/lint/build/aggregate-test/auth result table.
- `docs/POSTGRESQL_VERIFICATION.md`: corrected executable PostgreSQL/restore procedure and explicitly blocked application-harness specifications.

## Remaining release blockers

Real PostgreSQL fresh/upgrade migrations, transaction behavior, independent-connection locking and concurrency remain unexecuted. PostgreSQL backup/restore remains prepared but not executed. The final configured test command remains 212/216 because four private platform-harness tests cannot run in this portable archive. Full customer/admin browser E2E, accessibility, deployed auth-off parity, selected-host deployment/health/restart, durable media, cookie/proxy security, OTP delivery and live provider behavior remain unverified or deferred. The OTP policy that permits an older unconsumed challenge to become selectable after a newer challenge is exhausted remains unchanged and needs an explicit product/security decision. External payment reconciliation for a provider charge followed by stock-recovery failure remains undesigned.

No final release approval is granted. Do not start Batch 09 or connect live providers until the owner reviews this evidence and explicitly authorizes the next step.
