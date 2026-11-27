# SHAHOO — 21-item independent audit remediation checklist

**Base archive:** `shahoo-v1.0.0-batch09-owner-remediated.zip`
**This package:** source changes plus explicit unresolved gates.
**Important:** no claim of zero bugs, production readiness, real provider connectivity, or real PostgreSQL verification is made.

| # | Finding from independent audit | Current disposition in this package | Evidence / remaining work |
|---:|---|---|---|
| 1 | PayPing HTTP errors/malformed responses could be misclassified as definitive rejection | **Source corrected** | All non-200/non-valid-409 verification outcomes and mismatched success payloads are now unknown/pending. Needs provider-contract confirmation and tests. |
| 2 | Retry/manual recovery not surfaced for operations | **Source/UI implemented; test pending** | Admin-only server functions and order-detail recovery controls added. Full browser/E2E test still required. |
| 3 | `manual_review` could become a dead end | **Source/UI implemented; test pending** | Verification retry accepts `manual_review`; an automated lifecycle test was added but not executed in this environment. |
| 4 | Successful provider payment with failed local settlement needs recovery | **Partially corrected** | Existing settlement retry is available to authorized admins and surfaced in the order detail. Actual refund/compensation remains external. |
| 5 | No real PostgreSQL multi-connection concurrency test | **External test gate** | Requires reachable PostgreSQL; PGlite is not equivalent. |
| 6 | Expired holds rely on user traffic | **Source implemented; operational test pending** | A scheduled Node maintenance script examines up to 200 expired holds per run in batches of 40; still requires Windows Task Scheduler configuration and real-DB test. |
| 7 | Guest checkout lacks dedicated rate limiting | **Source implemented; test pending** | Durable per-IP/per-cart rate buckets and PGlite test added; test not executed here. |
| 8 | Two PostgreSQL pools are created | **Source corrected; test pending** | Raw SQL and Drizzle now share one process-wide pool; needs TypeScript/runtime validation. |
| 9 | OTP failed attempts can reset across newly issued challenges | **Source implemented; test pending** | Durable cross-challenge mobile/IP verification buckets and a PGlite test added; test not executed here. |
| 10 | Admin MFA absent | **Not yet corrected** | Requires product decision, TOTP enrollment/recovery UX, migration, tests, and rollout plan. |
| 11 | WebP validation is chunk-level, not full decode/re-encode | **Mitigated fail-closed** | WebP upload is disabled on both client and server until a maintained decoder/encoder dependency can be installed and locked; JPEG/PNG/GIF remain supported. |
| 12 | Internal refund record is not actual money returned | **Documented limitation** | No PayPing refund API is implemented or called; manual banking/provider reconciliation is required. |
| 13 | Paid payment with failed fulfillment needs operational reconciliation | **Partially corrected** | Retry settlement is exposed to admin server functions; the admin order-detail controls exist; a complete operational reconciliation runbook remains. |
| 14 | Vite/Nitro preset is Vercel-oriented | **Partially corrected** | Explicit `NITRO_PRESET` override and Windows Node-server build script added; Windows build not executed here. |
| 15 | No Windows production start script | **Source implemented; test pending** | `build:windows` and `start:windows` added; execution on Windows VPS remains untested. |
| 16 | Test and development scripts use POSIX shell syntax | **Source corrected; test pending** | `npm test` uses a Node orchestrator and `npm run dev` now sets its flags through a Node launcher; no POSIX env-assignment syntax remains in these commands. |
| 17 | Windows `.cmd` process spawning risk | **Source corrected; test pending** | Wrapper now invokes Vite's JavaScript CLI through `process.execPath` and never uses a shell for the normal Vite path; Windows execution test remains. |
| 18 | Historical documentation inconsistencies | **Partially corrected** | PostgreSQL migration statement, PayPing environment, state machine, and Windows scheduler/build docs updated; full documentation audit remains. |
| 19 | Four `.grok`-dependent tests fail when private files absent | **External/private-input gate** | Keep tests visible; provide private skill inputs in CI or explicitly separate the private suite. Do not silently skip. |
| 20 | No full browser E2E checkout-to-payment flow | **External test gate** | Requires browser runner, seeded test data, test provider/mock, and a deterministic CI environment. |
| 21 | No backup/restore test | **External operational gate** | Requires real PostgreSQL, backup storage, restore target, and measured recovery exercise. |

## Verification status

- Archive extraction and original ZIP integrity check: passed.
- TypeScript syntax transpilation: passed for 21 modified TypeScript/TSX files. This is a syntax check, **not** a full typecheck.
- `node --check`: passed for all project `.mjs` scripts.
- `package.json` parse: passed.
- `package-lock.json` is unchanged; SHA-256 remains `0282be144313759a80fb9c551b6c72873baabc629e4f65f6db2e5ac9a00071d5`.
- `npm ci` could not complete in the current environment; npm registry access timed out and offline cache lacks `zustand@5.0.15`.
- `tsc --noEmit` is blocked because dependencies/types are absent (`@types/node` and `vite/client`).
- Lint, full build, and automated tests were **not run on this modified package**.
- Do not treat the source changes as independently test-passed until CI or a local environment completes the commands.
- PayPing and SMS.ir remain unconfigured and unconnected.
- Real PostgreSQL, Windows VPS, browser E2E, provider sandbox, refund, backup/restore, and MFA remain explicit follow-up gates.
