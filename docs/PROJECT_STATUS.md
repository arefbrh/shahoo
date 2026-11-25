# SHAHOO — Project Status & Infrastructure Audit

**Report date:** 25 November 2026  
**Compared sources:** `SHAHOO_PROJECT_V2_FINAL_MASTER.zip` and GitHub `main`  
**Status:** integration candidate; not Production-approved.

## 1. Executive summary

The supplied ZIP is based largely on the current repository, but it contains additional storefront source, brand assets, invoice-export improvements, self-hosting scaffolding, scripts and documentation. The ZIP is not a byte-for-byte replacement for `main`; see [INTEGRATION_DIFF.md](INTEGRATION_DIFF.md) for the targeted file inventory and merge decisions.

Integrated source deltas identified:
- Persian province/city selection with a manual city-entry fallback.
- Carrier-specific tracking links for Post, Tipax and Chapar.
- CMS FAQ and trust-mark defaults (trust marks remain Pending).
- Product-page FAQ presentation.
- Torob product-feed route and generator.
- Minimal SHAHOO JPG logo fallback for invoice rendering.
- XLSX formula-injection sanitization.

The supplied self-hosting files required corrections before integration:
- The Docker build had inherited Nitro's Vercel preset instead of `node-server`.
- The worker imported `src` modules and runtime packages absent from the final image.
- Production environment variable names did not match the runtime contract for PayPing, SMS.ir, and APP_URL.
- The original Torob feed referenced non-existent schema fields and a non-existent `categories` export.
- The route tree did not register the Torob route.
- Windows service installation did not pass the `.env` values to NSSM.
- Windows restore did not reliably check `pg_restore`'s exit code.
- Backup documentation described WAL/PITR and encryption that were not configured.

These issues have been corrected in this integration candidate. They have not yet been certified by a full build or deployment.

## 2. Verification actually performed

| Check | Result | Evidence boundary |
|---|---|---|
| ZIP inventory and extraction | PASS | Archive opened and 480 file entries were extracted |
| Source comparison with GitHub `main` | PASS (targeted) | Package/lockfile, major code paths and infrastructure additions compared; not a full blob-by-blob audit of all files |
| Dockerfile / Compose static review | PASS | Critical preset, worker-image and env-name mismatches corrected in candidate |
| Node `.mjs` syntax | PASS | `node --check` completed for all `.mjs` files under `scripts/` |
| Selected TypeScript syntax | PASS (parse only) | Node type-stripping parser accepted new `.ts` modules and route tree; `.tsx` and semantic TypeScript checks remain unverified |
| Script test subset | PARTIAL | Earlier isolated run: 109/112 passed; 3 were blocked by missing `react`/`pg` packages. A later full `npm test` attempt ran 33 grouped test files: 17 passed, 16 could not start because required packages were absent. |
| Bash script syntax | PASS | `bash -n scripts/linux/*.sh` |
| Compose YAML parse | PASS | Parsed with PyYAML; this is not `docker compose config` |
| Invoice export regression tests | PASS | 2 tests passed under Node 22 type stripping |
| Antigravity remediation suites | PASS | 17 tests passed with Node's TS transform and project alias hook |
| Worker heartbeat checks | PASS | Fresh heartbeat accepted; stale heartbeat rejected |
| `npm ci` | BLOCKED | Repeated attempts timed out; npm debug logs showed DNS resolution failures (`EAI_AGAIN registry.npmjs.org`). npm cache was empty, so dependencies remain unavailable. |
| Expanded syntax checks | PASS / PARTIAL | 43/43 script `.mjs` files passed `node --check`; 6/6 Linux shell scripts passed `bash -n`; 207/208 `.ts` files passed Node `--check`, and the one parser outlier (`src/server/db/sql-error.ts`) executed successfully with `--experimental-strip-types`. This is syntax evidence only, not TypeScript typechecking. |
| TypeScript / lint / full test suite | NOT RUN | Dependencies were not installed |
| Docker Compose validation / image build | BLOCKED | Docker CLI/daemon unavailable in the execution environment |
| PowerShell execution | NOT RUN | Windows PowerShell runtime unavailable |
| PostgreSQL restore drill | NOT RUN | No disposable PostgreSQL service was available |
| Preview / browser / Production | NOT RUN | No deployment or Production changes were made |

## 3. Infrastructure status

- Dockerfile and Compose are now aligned to the standalone Nitro Node server preset.
- PostgreSQL is private to the internal Docker network; the database port is not published. A fresh self-hosted volume bootstraps a separate non-superuser application role; existing volumes require a separately reviewed role migration.
- App health checks the readiness endpoint, including database connectivity.
- Worker has a heartbeat health check and restarts on an unhandled maintenance failure.
- Local media storage uses a persistent Docker volume.
- Caddy is configured as the reverse proxy; the Windows native deployment uses a separate upstream file.
- Linux logical DB and media backup/restore scripts exist, but are not runtime-verified.
- WAL/PITR, backup encryption, off-site replication and full restore drills remain open.

## 4. Provider status

PayPing and SMS.ir remain disabled by default. The environment template now uses the exact runtime variable names:
`PAYMENT_PROVIDER`, `PAYPING_LIVE`, `PAYPING_API_KEY`, `PAYPING_RETURN_URL`,
`SMS_MODE`, `SMS_LIVE`, `SMS_PROVIDER`, `SMS_IR_API_KEY`, and
`SMS_IR_OTP_TEMPLATE_ID`.

No live provider credentials or transactions were used.

## 5. GitHub handoff state (checked 2026-11-25)

- Repository: `shahoo-workspace/shahoo`; default branch: `main`; authenticated connection has push/admin permissions.
- `main` remains at `9cee5faf98e010f7a366af0e28d95ed36bfaf2d5` at the time of this check.
- The existing `feat/self-hosted-infra-remediation` branch resolves to the same commit as `main`; it does not contain the local integration candidate.
- GitHub search returned no open pull requests for this repository.
- The prepared ZIP and its integration report are local handoff artifacts only. No GitHub commit, PR, merge, Vercel deployment, or Production database change has been made.

## 6. Latest dependency-install blocker (2026-11-25)

A third `npm ci --ignore-scripts --no-audit --no-fund` attempt timed out. The npm debug log shows repeated `EAI_AGAIN` failures while resolving package tarballs from `registry.npmjs.org`; `npm cache verify` reports zero cached packages. This is an execution-environment DNS/network blocker, not evidence that the project dependencies or lockfile are valid or invalid. Do not claim typecheck, lint, full tests, or build have passed.

## 7. Release posture

Do not merge to the production deployment branch or deploy this candidate until CI, TypeScript, lint, tests, Docker build, and the disposable PostgreSQL verification matrix pass. The release checklist remains unchecked where real infrastructure or owner-provided credentials are required.


## 8. Latest verification attempt — 2026-11-25

The full `npm test` command was retried after the dependency installation failure. It discovered 33 grouped test files: 17 passed and 16 failed to start because modules such as `react`, `pg`, `@electric-sql/pglite`, `drizzle-orm`, `jose`, `jpeg-js`, and `@tanstack/react-start` were not installed. These are dependency-resolution blockers; this result is not a green full test suite. Additional static checks passed for all 43 script `.mjs` files and all 6 Linux shell scripts. The Node parser reported one `.ts` file as a `--check` outlier; executing that file with Node type stripping completed without a syntax error. No semantic TypeScript check was possible.


## Neon Object Storage follow-up — 2026-11-25

The application includes an S3-compatible adapter. It accepts the SHAHOO `STORAGE_S3_*` names and the Neon/AWS-standard `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` aliases; the bucket name remains explicit. The Staging Neon branch has a private `shahoo-media` bucket. Vercel Preview does not yet contain the required S3 variables, and no application-level PUT/GET/DELETE test has been completed. Production Storage is enabled but has no bucket and was not changed. See `NEON_OBJECT_STORAGE_SETUP.md`.
