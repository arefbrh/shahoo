# SHAHOO — Verification Update (2026-11-25)

This record distinguishes the source-package checks, the Vercel Sandbox checks, and live-provider configuration. Passing sandbox tests do not imply a Production deployment or a successful self-hosted restore drill.

## Verified in the Vercel Sandbox

| Check | Result | Exact scope |
|---|---:|---|
| TypeScript | PASS | `npm run typecheck` on Node 26.13.1 against the main checkout plus the targeted overlay present in that sandbox |
| ESLint | PASS | `npm run lint` on Node 26.13.1, zero warnings after two fixes |
| Build | PASS | `npm run build` on the Sandbox checkout with the selected overlay; this was not a full self-hosted Docker build |
| Project tests, retry run | 479/479 PASS | 113 script tests, 236 application tests, 130 migration/integration tests; `npm run test:project`, exit code 0 |
| Focused flow suite | 16/16 PASS | `src/server/completion/flow.test.ts` rerun independently after a transient first-run failure |
| Auth invariant | PASS | Development server was running; `VITE_AUTH_ENABLED` resolved to `false`, matching the build setting |
| npm audit | 0 vulnerabilities | Audit JSON from the Sandbox checkout at the time of the run |
| Worker heartbeat | PASS | Missing and stale heartbeat fail; fresh heartbeat succeeds |
| Shell/JS script syntax | PASS | `bash -n` and `node --check` across the relevant scripts |

**Scope limitation:** The 479-test run was performed against a GitHub `main` checkout with the targeted overlay used in that Sandbox session. It is not evidence that every file in the complete handoff ZIP has been built and tested together. The separate full candidate archive still requires its own complete CI run after transfer to a Git branch.

## Refreshed candidate — local targeted checks

| Check | Result | Scope |
|---|---:|---|
| S3 adapter tests | 6/6 PASS | Includes the Neon/AWS-standard environment alias regression |
| Remediation suites | 17/17 PASS | `scripts/test-remediation-comprehensive.mjs` and `scripts/test-remediation-master.mjs` |
| Worker health/config tests | 8/8 PASS | Missing/fresh/stale heartbeat, invalid interval, invalid task timeout and minimum bounds |
| Linux backup/restore safety tests | 6/6 PASS | Retention validation, media path traversal rejection, and restart/leave-stopped behavior around destructive restores |
| Invoice export tests | 2/2 PASS | XLSX XML escaping and formula-injection regression |
| Script syntax | PASS | All `.mjs` files with `node --check`; all `.sh` files with `bash -n`; Linux shell entrypoints are executable in the ZIP |
| Compose YAML parse | PASS | PyYAML parse only; not `docker compose config` |
| ZIP integrity | PASS | 498 entries; `ZipFile.testzip()` returned `None` |

A fresh local `npm ci` timed out due the local environment's registry/network limitation. These targeted checks do not replace a full build and complete project suite against the refreshed ZIP.

## Neon Object Storage

- Neon Object Storage reports `enabled=true` for both the Staging and Production branches.
- Created and verified a private bucket named `shahoo-media` on the Neon Staging branch `br-young-heart-b96c797x`.
- The Production branch currently has no bucket; it was not modified.
- A Staging credential with `storage:read` and `storage:write` scopes already exists, but its secret was not retrieved or rotated.
- The Vercel project environment listing does not contain the S3/AWS storage variables yet.
- The application adapter now accepts Neon's AWS-standard variables (`AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) as well as the existing `STORAGE_S3_*` and `S3_*` names. A regression test covers this mapping.
- No live object PUT/GET/DELETE was performed in this continuation; bucket existence is not a successful object-storage integration test.

## Vercel / GitHub boundary

- GitHub `main` remains at `9cee5faf98e010f7a366af0e28d95ed36bfaf2d5` during this check.
- No commit, pull request, Vercel deployment, Production environment change, or Production database migration was created in this continuation.
- The most recent failed GitHub CI run belongs to the already-closed PWA-only PR #10; its typecheck failure was in `scripts/shahoo-pwa-branding.mjs` and `server/middleware/grok-pwa.ts`. It did not affect `main`; no Actions rerun was triggered and no PWA work was added.
- The existing Production deployment still points to the baseline `main` commit.
- A prior local candidate `vercel.json` contained `installCommand: npm install --omit=dev ...`, which could omit build-time dependencies. That override has been removed from the refreshed candidate; Vercel's detected framework defaults should manage installation.

## Not yet verified

- Full build and tests of the refreshed complete candidate ZIP after the latest AWS environment mapping change.
- `docker compose config`, Docker image build, app/worker container startup, and Caddy/HTTPS issuance.
- PostgreSQL bootstrap and migrations on a disposable PostgreSQL instance, concurrent workers, real `pg_dump`/`pg_restore`, and a full restore drill.
- Windows PowerShell execution, including the new Caddy NSSM service installer, and service installation.
- Live Neon object PUT/GET/DELETE from the application runtime.
- Browser/mobile end-to-end checks and a Vercel Preview deployment of the candidate.
- Real PayPing and SMS.ir sandbox/merchant calls.
- Production cutover, DNS, Production storage bucket, Production credentials, and Production migrations remain untouched.

## Additional verification — Vercel Sandbox (2026-11-25, Node 22.16.0)

A fresh isolated Vercel Sandbox cloned GitHub `main`. The run applied two small audit fixes to the sandbox checkout before validation: the order-packing work loader now includes `order.lines` in its effect dependencies, and an unused `dumpPath` declaration was removed from the PostgreSQL concurrency/backup test. Those same two changes were copied into the refreshed candidate source tree and ZIP.

| Check | Result | Exact scope |
|---|---:|---|
| Node runtime | PASS | Node 22.16.0 selected in the isolated Sandbox |
| TypeScript | PASS | `npm run typecheck` on the Sandbox Git checkout plus the two fixes above |
| ESLint | PASS | `npm run lint`, zero reported warnings |
| Vercel build | PASS | `npm run build`; Vercel output config version 3 and server function emitted |
| Project tests | 479/479 PASS | `npm run test:project`: 113 script, 236 application, 130 migration/integration; exit code 0 |
| Auth invariant | PASS | `npm run check:auth`; development/build auth settings agree (`false`) |
| npm audit | PASS | `npm audit --audit-level=high`; zero vulnerabilities reported |

**Important scope boundary:** This Sandbox run validates the main checkout plus those two selected edits. It is not a full build/test of every file in the refreshed candidate archive. The candidate archive's local focused suites were rerun separately: 39/39 pass (22 storage/invoice/worker/Linux-safety tests and 17 remediation tests). Candidate full typecheck/lint/build/project-suite remain outstanding because the extracted local `node_modules` is incomplete and a fresh local dependency install previously timed out.

## Neon Staging object-storage smoke test and Preview configuration

- Performed a real signed object PUT followed by GET against the private Staging bucket `shahoo-media`; the downloaded bytes matched the uploaded payload.
- Deleted the temporary smoke-test object and verified that no test object remained under the validation prefix.
- An anonymous request for a non-existent private object returned HTTP 403, consistent with the bucket remaining private.
- Created a dedicated Staging credential scoped to `storage:read` and `storage:write` (one-year expiry) and configured the six `STORAGE_*` variables in Vercel **Preview only**, branch-scoped to `feat/self-hosted-infra-remediation`. Secret values are not included in this report.
- No Preview deployment exists yet, and the app's own S3 adapter has not yet been exercised against this live bucket. The direct signed PUT/GET/DELETE smoke test proves provider access, not full app integration.
- Production bucket, credentials, environment variables and data were not changed.
