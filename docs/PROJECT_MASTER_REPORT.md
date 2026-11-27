# SHAHOO — Project Master Report

**Report date:** 2026-11-27  
**Repository snapshot reviewed:** `main` at `f6d2183e9dd54d33c49463300234a813efe2e599`  
**Repository:** `shahoo-workspace/shahoo` (public)  
**Purpose:** Single current engineering, implementation, verification and release-status reference for maintainers and AI agents.

> **Current decision: NOT APPROVED FOR PRODUCTION RELEASE.** The application has a substantial implementation and CI evidence, but payment-recovery work, security hardening, Production schema upgrade, real target-host operations, authenticated Preview testing and external provider verification remain open. A green historical CI run is not a launch approval.

## 1. Executive summary

SHAHOO is a Persian-first (RTL) e-commerce application for natural and organic products. Its current implementation includes a customer storefront, customer accounts, catalog and inventory management, CMS and magazine content, operational order management, payment/SMS adapters, PostgreSQL migrations, and both Vercel and self-hosted deployment paths.

The codebase is worth continuing. The work to date has been incremental and has retained the existing React/TanStack/Drizzle architecture; **a rewrite is not indicated by the evidence reviewed**.

The repository contains 508 tracked files at the reviewed `main` snapshot. Most application files, migrations, tests, scripts and brand assets are functional project material. The main maintainability problem is the number of parallel historical batch reports, project-state snapshots, and handoff documents at the repository root. Those documents frequently preserve old “current” statuses that were later superseded. This cleanup makes this file the sole current progress/evidence summary and moves old reports into clearly marked archives without discarding their historical record.

### Current snapshot

| Area | Current state |
|---|---|
| Source integration | PR #11 self-hosted integration is merged to `main`; PR #19 documentation refresh is merged |
| Tests and CI | PR #11 candidate CI passed before merge; latest main workflow after PR #19 is a documentation-triggered/dynamic run, not proof of a fresh full project suite |
| Database | Root migration history is `0002`–`0019`; latest recorded Staging/disposable schema is `0019`; last recorded Production schema is `0016` |
| Payments | PayPing adapter and attempt lifecycle exist, but payment retry/terminal state and reconciliation gaps remain; Live must stay disabled |
| SMS | SMS.ir Verify adapter exists; account/template/delivery is not verified; Live must stay disabled |
| Storage | Disk and S3-compatible adapters exist; Staging bucket configuration is recorded, but complete app-level Preview PUT/GET/DELETE and Production media operation are not proven |
| Hosting | Vercel Preview exists; self-hosted Docker and native Windows scripts are integrated; target VPS rehearsal is outstanding |
| Release | Not approved. Follow the open GitHub release issues and milestone; do not infer readiness from code presence |

## 2. Product and architecture

### Product capabilities present in source

- Public catalog, product detail, variants, cart, server-priced checkout, guest order creation, receipts and order tracking.
- Customer OTP sign-in, account profile, address management, order history and wishlist.
- Admin catalog/product/variant editing, inventory desk, order/customer management, staff permissions, reports and support workflows.
- Database-backed homepage sections, banners, menus, pages, magazine articles and SEO metadata.
- Order fulfillment, shipment records, picking/packing workflows, invoices/print views and carrier-specific tracking-link support.
- PayPing payment adapter and durable payment-attempt lifecycle; SMS.ir Verify and Kavenegar adapters; internal notifications.
- Disk and S3-compatible media storage adapters.
- Health/readiness endpoints, migration scripts, Linux/Docker and native Windows deployment/backup/restore tooling.

“Present in source” does not mean “connected to a live provider” or “verified in Production.” Provider and environment boundaries are in [Provider status](PROVIDER_STATUS.md), [Production guide](PRODUCTION.md), and the release issues.

### Stack and data rules

- React 19, TypeScript, TanStack Start, Vite, Nitro, Drizzle ORM, PostgreSQL/Neon, PGlite for local development/tests, Tailwind, Zod and Zustand.
- Root SQL migrations are ordered under `migrations/`; optional platform-auth SQL under `migrations/auth/` is not part of the shop migrator.
- PostgreSQL is the intended deployed database; a configured PostgreSQL failure must not fall back to PGlite.
- Prices, totals and ledger amounts are integer IRR in storage; display conversion to toman is a presentation concern.
- Server-side code owns price, inventory, authorization, payment verification and transaction boundaries.
- SHAHOO brand assets, Persian copy, RTL layout and the current product identity are to be preserved.

## 3. Implementation history — consolidated by batch

The table below is a concise history of the work recorded across the former Batch 00–10 reports. It is **not** a claim that every historical test was rerun on the current `main` snapshot.

| Phase | Delivered / corrected | Evidence boundary |
|---|---|---|
| Batch 00 — baseline | Read-only inventory of auth, commerce, payments, SMS, admin, media, CMS, support, SEO, migrations and deploy config; recorded baseline issues and test limitations | Static review; no production DB, provider or browser operation |
| Batch 01 — platform safety | Production requires `DATABASE_URL`; no silent PGlite fallback; explicit development/mock gates; seed safety; checkout/address/idempotency protections; build separated from migrations; admin bootstrap safeguards | Source fixes and focused tests; no live provider or Production DB |
| Batch 02 — commerce integrity | Cart merge/adopt rules, server-authoritative checkout, transactional stock/coupon/order updates, payment replay rules, hold expiry/refund/order-transition protections, audit and media cleanup behavior | Focused script/application tests and typecheck recorded in that batch; no real gateway |
| Batch 03 — storefront reliability | Safe not-found/error pages, guarded async actions, cart response ordering and retry behavior, guest/account wishlist isolation, media upload feedback, accessibility primitives | Pure/static tests passed; full browser and responsive verification deferred |
| Batch 04 — homepage/CMS | Database-driven homepage sections, banner carousel interaction/reduced-motion behavior, section ordering and empty states; migration `0010` provisions missing structural homepage sections without inserting demo products | Focused PGlite and source-level tests passed; no Production migration |
| Batch 05 — customer account | Profile fields, immutable verified mobile, address CRUD/default handling, private customer order history and aggregate demographic reporting; migration `0011` | Focused account/address/checkout tests recorded; full browser and Production checks deferred |
| Batch 06 — catalog/content | Product editor, variant and gallery management, CMS page creation, menu/banner/homepage management, article SEO, bounded media/content pickers | Focused CMS/catalog/commerce suites and scoped lint/typecheck recorded; full suite/browser checks deferred |
| Batch 07 — admin operations | Order/customer/inventory desks, authorization/privacy, status reasons, inventory movement history and audit trail; migration `0012` | Focused admin desk and lifecycle suite recorded as 18/18 in Revision 01; PGlite evidence is not PostgreSQL race proof |
| Batch 08 — audit and hardening | Auth scaffold changed to explicit opt-in; Better Auth advisory/API remediation; quote/cart sellability consistency; OTP challenge correctness; seed-collision protections; hardcoded Preview OAuth secret removed from current source and replaced with runtime configuration | Several revision-specific test snapshots passed; four private platform tests remained blocked by missing private `.grok` inputs; the prior credential's rotation was not verified |
| Batch 09 — payment/SMS preparation | PayPing durable attempt model, callback parsing, server-side verification, unknown-outcome persistence, settlement lease recovery and admin review path; SMS.ir Verify adapter and explicit unknown-delivery handling; migrations `0013`–`0016` | Mock/local tests only; no real PayPing payment, SMS delivery, merchant sandbox or Production provider connection |
| Batch 10 / PR #11 — self-hosting integration | Integrated Docker/Node server build, worker, PostgreSQL role bootstrap, Caddy, Linux/Windows scripts, backups/restores, health checks and CI recovery coverage; corrected integration defects before merge | PR #11 candidate CI passed on its recorded pre-merge SHA; no actual owner VPS rehearsal or Production cutover |

### Additional merged work

- PR #1 addressed Vercel runtime loading of PGlite.
- PR #6 added disposable PostgreSQL contention and backup/restore CI coverage.
- PR #8 improved catalog save reliability and admin guidance.
- PR #9 added CMS navigation/central brand settings and S3-compatible media adapter work.
- PR #10 PWA branding changes were closed without merge; they were outside the approved product scope.
- PR #19 refreshed README, contributor guidance and repository documentation. This PR supersedes its previous point-in-time documentation, not the need for this consolidated report.

## 4. Test and verification evidence

### Important historical evidence

| Evidence snapshot | Recorded result | What it proves — and what it does not |
|---|---|---|
| Batch 02 | 205 script tests and 145 pure/app tests passed; alias-enabled commerce suite recorded 37 passes; typecheck passed | That historical baseline only; not a current full-main rerun |
| Batch 03 | 18 pure frontend logic tests and 9 static frontend-source tests passed | Not browser E2E, DOM interaction, mobile or accessibility verification |
| Batch 04 correction | PGlite seed/migration 3/3, static frontend 10/10, CMS/homepage rules 9/9 | Not real PostgreSQL or Production migration |
| Batch 05 | 20 pure tests, 4 account/address PGlite tests, 19 checkout/completion tests, 2 account wiring tests recorded as passing | Not full project suite or live customer data |
| Batch 06 | CMS 12/12, catalog 5/5, commerce/account regression group 41/41, pure rules 16/16 | Not full JS-aware typecheck, full browser or Production |
| Batch 07 Revision 01 | Admin desk + completion flow 18/18 | PGlite behavior, not independent PostgreSQL client contention |
| Batch 08 Revision 02 | Typecheck/lint/build passed; app 215/215; migration/PGlite 94/94; private script group 212/216 | Four private `.grok` tests blocked; no full PostgreSQL/host/provider verification |
| Batch 08 Revision 02.1 | Typecheck/lint/build passed; app 217/217; migration/PGlite 103/103; private script group 212/216; npm audit reported zero vulnerabilities for that snapshot | Historical environment evidence; not a fresh audit of today’s full Git history |
| Batch 09 | Provider/payment/OTP mocked and local suites recorded as passing; full script group 212/216 (four private-harness tests blocked) | Mocked behavior only; no live provider |
| PR #11 candidate CI | GitHub Actions run [45683089313](https://github.com/shahoo-workspace/shahoo/actions/runs/45683089313) passed the candidate's enabled CI jobs, including Quality, Project tests, PostgreSQL, Windows recovery, Docker/self-hosting, provider mocks and security. PR text records 516/516 project checks across groups | Exact pre-merge candidate SHA only; this is not a current run of every subsequent main commit and not a real owner-host rehearsal |
| Vercel Sandbox, 2026-11-25 | 479/479 project tests, typecheck, lint, Vercel build, auth invariant and selected security/worker/S3 checks were recorded as passing on a GitHub main checkout plus a selected overlay | Not a complete test/build of every file in the integrated candidate/archive |
| Latest main workflow after PR #19 | [45687170773](https://github.com/shahoo-workspace/shahoo/actions/runs/45687170773) completed successfully on `f6d2183`; event was dynamic and PR #19 was documentation-only | Not evidence of a fresh full application CI run after PR #11 |

**Do not add historical counts together.** The test groups overlap, use different source snapshots and sometimes run with different dependency sets.

### Current verification status

- Source and Git metadata were reviewed on the exact `main` snapshot above.
- The root migration inventory contains 18 migrations (`0002`–`0019`). The PR #11 CI evidence reports all 18 applied to disposable PostgreSQL 16. The production database was last recorded at `0016`; Staging and a disposable branch were recorded at `0019`.
- PR #12 is still a Draft pull request. Its post-merge schema-upgrade checks from `0016` to `0019` were recorded as deferred by the owner; see [PR #12](https://github.com/shahoo-workspace/shahoo/pull/12) and [Issue #17](https://github.com/shahoo-workspace/shahoo/issues/17).
- The current `main` latest workflow after PR #19 is not a substitute for running the full CI against this cleanup branch. CI should be observed on this PR before merge.
- Real Production migration, actual owner VPS, authenticated Preview order/admin/media workflows, live provider calls, full-history secret scan and complete accessibility review remain unverified.

## 5. Current release blockers and tracking

GitHub Issues are the source of truth for status, assignment, conversation and acceptance evidence. The links below point to the current open work. Avoid creating a second copy of an Issue in this report; update the GitHub Issue instead.

| Issue | Current work |
|---|---|
| [#13](https://github.com/shahoo-workspace/shahoo/issues/13) | Take and verify a recoverable backup, then review Production schema upgrade from `0016` to `0019`; no unapproved Production migration |
| [#14](https://github.com/shahoo-workspace/shahoo/issues/14) | Staging shipping-method setup and Preview guest checkout |
| [#15](https://github.com/shahoo-workspace/shahoo/issues/15) | Authenticated Preview admin access and private media upload/read/delete flow |
| [#16](https://github.com/shahoo-workspace/shahoo/issues/16) | Full target-VPS restore, health, reboot and operations rehearsal |
| [#17](https://github.com/shahoo-workspace/shahoo/issues/17) | Review/run PR #12's schema upgrade and PostgreSQL tests under the approved disposable-only procedure |
| [#18](https://github.com/shahoo-workspace/shahoo/issues/18) | Provider account, approved templates, sandbox and explicit owner decision for payment/SMS/shipping |
| [#20](https://github.com/shahoo-workspace/shahoo/issues/20) | Payment attempt terminal states and safe customer payment-again action |
| [#21](https://github.com/shahoo-workspace/shahoo/issues/21) | PayPing callback return contract and browser redirect; verify actual method in Sandbox |
| [#22](https://github.com/shahoo-workspace/shahoo/issues/22) | Admin reconciliation queue, alerting, retry and actual refund/compensation procedure |
| [#23](https://github.com/shahoo-workspace/shahoo/issues/23) | Run Windows services/tasks with least privilege and restrictive ACLs |
| [#24](https://github.com/shahoo-workspace/shahoo/issues/24) | Separate Windows runtime environment from database-admin credentials and use Windows media paths |
| [#25](https://github.com/shahoo-workspace/shahoo/issues/25) | Separate migration/schema-owner role from runtime DML role |
| [#26](https://github.com/shahoo-workspace/shahoo/issues/26) | Make Windows worker task duration/heartbeat behavior explicit and test it |
| [#27](https://github.com/shahoo-workspace/shahoo/issues/27) | Versioned Windows release directories, upgrade and rollback runbook |
| [#28](https://github.com/shahoo-workspace/shahoo/issues/28) | Safe restore via snapshot, scratch restore and validated swap |
| [#29](https://github.com/shahoo-workspace/shahoo/issues/29) | Handle asynchronous idle-client `pg.Pool` errors safely |
| [#30](https://github.com/shahoo-workspace/shahoo/issues/30) | OTP brute-force and SMS-pumping policy hardening |
| [#31](https://github.com/shahoo-workspace/shahoo/issues/31) | Review 24-hour guest stock holds and resistance to reservation abuse |
| [#32](https://github.com/shahoo-workspace/shahoo/issues/32) | Re-check lower-priority password hash, S3, storage migration, DB constraints, IIS headers and alerting items |
| [#33](https://github.com/shahoo-workspace/shahoo/issues/33) | Revoke/rotate historical Preview OAuth credential, inspect usage and run a full-history secret scan |

### Do not enable before the relevant gates pass

- Keep PayPing Live and SMS.ir Live disabled until their independent sandbox, contract, authorization and recovery checks pass.
- Do not run Production migrations from this documentation cleanup.
- Do not copy administrator database credentials into the web-runtime environment.
- Do not treat internal refund-ledger entries as money returned by a bank/provider.
- Do not claim an owner Windows VPS is proven by CI on a disposable Windows runner.

## 6. Security review of the current repository snapshot

**Review type:** targeted static review of the Git tree, environment templates, CI workflow, selected authentication/provider files and repository-wide code-search results. This is not a Gitleaks/detect-secrets full-history scan, a dynamic penetration test, or a review of GitHub-hosted Actions secrets.

### Findings

1. **No actual `.env` file was present in the reviewed tracked tree.** The two tracked environment files are examples. Their connection strings/passwords are clearly placeholders. `.env.example` has blank runtime values. `.env.production.example` contains placeholder admin/runtime connection strings and Docker-shaped paths; this is a configuration-template hardening issue tracked by #24, not an observed live password.
2. **No common hard-coded credential signatures appeared in targeted current-source searches** for common GitHub PAT, AWS access key, Stripe live key or Slack bot token prefixes. This does not exclude custom tokens, encrypted/encoded material, secrets in binary assets, environment settings, workflow secrets, or historical commits.
3. **PEM-key pattern follow-up:** code search returned several documentation paths for the phrase “BEGIN PRIVATE KEY”; the fetched current contents of those paths did not contain literal PEM private-key boundary lines. No actual private-key block was observed in those inspected files.
4. **Historical Preview OAuth credential:** Batch 08 Revision 02.1 records that an earlier source archive contained a shared Preview OAuth client secret, removed from the current source and replaced with runtime environment configuration. It explicitly did not rotate/revoke the credential. Because this is a public repository, removal from the current tree does not make a credential safe. Track rotation, usage review and full-history scan in #33.
5. **CI secret check is limited.** The current workflow checks for committed secret-like filenames (`.env`, `*.pem`, `*.key`) and runs `npm audit --omit=dev --audit-level=high`; it does not perform a full content-based scan of all refs/history. Do not report this as a clean secret scan.
6. **GitHub Security alert APIs were not available to this review connection.** No statement is made about the absence of GitHub Secret Scanning or Code Scanning alerts.
7. **Public metadata such as Git author names/usernames and sample hostnames is not itself a credential.** Do not remove attribution/history solely because author metadata is visible.

### Security hygiene changes in this PR

- Expand `.gitignore` to preserve both `.env.example` and `.env.*.example`, while ignoring local environment files, private-key/certificate files, database dumps and common test/build artifacts.
- Add contributor rules prohibiting secrets, connection strings, OTP codes and customer data in public Issues/PRs.
- Preserve the fact of the historical credential exposure and assign the required action; do not rewrite history or claim rotation without an owner-approved operation.
- Keep actual provider tokens, admin database credentials and OAuth secrets in protected environment/secret storage only.

## 7. Repository organization after cleanup

### Current entry points

- `README.md` — concise Persian project overview, quick start, architecture and current document links.
- `AGENTS.md` — portable agent rules; directs every agent to this report and GitHub Issues.
- `PROJECT_HANDOFF.md` — short operational entry point and first steps for the next agent.
- `REMAINING_ISSUES.md` — compact pointer list to GitHub Issues; no second, diverging issue database.
- `CHANGELOG.md` — chronological shipped-change history.
- `DECISIONS.md` — durable product/engineering decisions.
- `docs/PROJECT_MASTER_REPORT.md` — this consolidated implementation, verification, security and release report.

### Archive policy

Old batch reports, handoff snapshots and point-in-time status documents are moved under `docs/archive/` in categorized folders. They are retained as historical evidence and are **not** current instructions. Technical runbooks, provider configuration references, migration history, tests, code, and official brand assets remain in their current locations.

### Files intentionally not deleted as “unused”

The Grok/PWA scaffold files under `scripts/grok-pwa-*`, `server/middleware/grok-pwa.ts`, `public/__grok/` and `scripts/install-page.html` are referenced by Vite, server middleware and tests. They were not deleted. PR #10's unmerged PWA branding change is a separate scope decision; the existence of scaffold code does not mean PWA product work is approved.

Likewise, logo files that share content hashes may be compatibility aliases/fallback assets or are used in invoice/preview code. They were not removed without a complete runtime/brand-reference review.

## 8. Operating rules for future agents

1. Start with `AGENTS.md`, this report, then open GitHub Issues and the release milestone.
2. Re-fetch the latest `main`, the relevant Issue and open PR state before making changes. This report has a date and base SHA; it can become stale.
3. Work on a feature branch and submit one focused PR. Do not push directly to `main`.
4. Add evidence and update the corresponding GitHub Issue; do not create another batch-status document for every pass.
5. Label each verification accurately: executed pass, executed fail, environment-blocked, not executed, or static review only.
6. Do not use Production credentials/data in tests, builds, migrations or restore procedures. Use disposable PostgreSQL and synthetic data.
7. Preserve the SHAHOO RTL/brand and existing server-side transaction/auth boundaries.
8. Keep provider gates fail-closed. No real PayPing/SMS/shipping connection without explicit owner authorization.
9. Close an Issue only when its acceptance criteria are proven and the test/operational evidence is recorded.

## 9. Source documents and retained technical references

The documentation index is [docs/README.md](README.md). Keep the technical guides there as focused references: production, release checklist, self-hosting, Windows/VPS, backup/restore, PostgreSQL verification, payment state machine, provider status, media storage and security hardening.

**Supersession rule:** for current implementation and release status, this report and the current GitHub Issues supersede old “current status” wording inside archived batch reports. Archived reports remain useful for historical context and the exact scope of the corresponding phase, not for current readiness claims.


## 10. Security, licensing and documentation roadmap — 2026-11-27

### Evidence-based findings

The following are engineering review findings and open verification items, not a penetration-test certificate or legal opinion.

| Area | Finding | Tracking / release consequence |
|---|---|---|
| Historical credential | A shared Preview OAuth credential was present in an earlier source snapshot. Current-source removal is recorded, but revocation/rotation and full-history scan are not verified. | [#33](https://github.com/shahoo-workspace/shahoo/issues/33); do not rewrite public history or rotate without owner/provider authorization. |
| DDoS / bots / WAF | Selected application rate limits exist, but end-to-end edge protection, WAF/bot policy, upstream DDoS coverage, distributed abuse resistance and bounded load results have not been established. | [#35](https://github.com/shahoo-workspace/shahoo/issues/35); no claim of DDoS immunity. No volumetric testing against Production. |
| Repository licensing | No root `LICENSE` or `NOTICE` file was found in the reviewed snapshot. `package.json` has `private: true`, which is not a license or proof of rights. This is not by itself proof of infringement. | [#36](https://github.com/shahoo-workspace/shahoo/issues/36); owner/legal decision required before publishing distribution terms. |
| Third-party dependencies and fonts | Exact license/notice obligations for locked direct/transitive dependencies, Vazirmatn, Cinzel and other bundled assets have not been fully inventoried. | [#36](https://github.com/shahoo-workspace/shahoo/issues/36); SBOM and license review required. |
| Grok/platform-preview/PWA assets | The repository contains related scaffold and asset paths, including `public/__grok/`, `server/middleware/grok-pwa.ts` and `scripts/install-page.html`. Their provenance, permitted use, branding/trademark implications and commercial redistribution rights need owner/legal review. Their presence alone does not establish infringement. | [#36](https://github.com/shahoo-workspace/shahoo/issues/36); do not remove files before checking references and provenance. |
| Legal/customer-facing content | Rights to logos, photography, product copy, scientific excerpts and published terms/privacy/returns content require documented provenance and qualified review. | [#36](https://github.com/shahoo-workspace/shahoo/issues/36); engineering review is not legal advice. |

### Security verification boundaries

- Existing application controls such as OTP/admin throttles and guest checkout limits are targeted controls, not a substitute for network/edge DDoS mitigation.
- The current repository review did not establish a configured WAF, CDN bot-management policy, provider-side DDoS profile, or measured load capacity.
- No authorized dynamic penetration test, volumetric DDoS simulation, full-history secret scan, or real-host security validation was performed in this review.
- The current CI secret check and `npm audit` evidence are scoped checks; neither proves the entire Git history or every deployed environment is free of secrets/vulnerabilities.
- The security hardening guide is a checklist/reference, not a certification against OWASP ASVS or proof that every described host control is active. Verify the actual host, proxy, firewall, headers and service permissions.

### Ordered remediation roadmap

| Priority / phase | Work | Exit condition |
|---|---|---|
| P0 — credential containment | Resolve #33: identify the credential owner privately, revoke/rotate at provider, inspect provider logs, scan all refs/history, decide whether an approved history rewrite is necessary. | Provider confirms revocation; scan evidence and recovery decision recorded. |
| P0 — distribution/rights decision | Resolve #36: owner/legal reviewer defines proprietary/public-viewable/open-source posture and copyright owner; inventory dependency/font/asset licenses and Grok/PWA provenance. | Approved distribution posture, SBOM/license evidence and notices/asset decisions recorded. |
| P1 — edge and abuse protection | Resolve #35: map actual traffic path; define WAF/DDoS/bot policy, proxy trust, endpoint-specific rate limits, telemetry and bounded Staging load tests. | Controls configured or explicitly deferred with risk acceptance; tests and residual limits documented. |
| P1 — application security backlog | Reconcile #29–#32 and relevant #23–#28 items against current `main`; split independently verified defects, preserve existing fail-closed and least-privilege behavior. | Each Issue has current source evidence, focused fix and executed tests. |
| P1 — operational release gates | Resolve #13–#18 and payment recovery #20–#22; Production migration and live providers remain separately authorized operations. | Backup/restore, provider sandbox, Preview and target-host evidence meet their Issues. |
| P2 — controlled oil recommendation integration | Resolve #37 only: connect the v3.2 knowledge source to the existing recommendation engine through isolated, read-only access and explicit product mapping. | Approved/signoff data only influences recommendations; tests pass in disposable Neon/Staging. |

### Documentation policy for all agents

The repository's existing files remain the documentation system of record. Do not create a new report, audit report, batch summary, status file, handoff file, or duplicate issue register for each agent session. Extend this report and the existing focused runbooks; update the compact `REMAINING_ISSUES.md` index and the corresponding GitHub Issue. Keep `PROJECT_HANDOFF.md` concise. New documentation files require explicit owner approval when no existing document can reasonably be extended.

### Current decisions and boundaries

- Production release remains **NOT APPROVED**.
- No Production database import/migration, live provider activation, DNS/firewall/WAF change, destructive test, credential rotation, or public Git-history rewrite is authorized by this roadmap alone.
- The oil encyclopedia is a reusable future knowledge source for agents and content workflows. Its only current runtime integration scope is the existing oil recommendation system; public encyclopedia pages, broad CMS/product integration, automatic content generation and manufacturing/formulation are out of scope. See [#37](https://github.com/shahoo-workspace/shahoo/issues/37).

 
## 11. Oil Encyclopedia v3.2 recommendation integration preparation — 2026-11-27

### Owner-approved scope

The encyclopedia remains a reusable knowledge source for future agent-assisted product creation, product descriptions, customer Q&A and educational content. The only current runtime integration is the existing oil recommendation guide. Public encyclopedia pages, broad CMS/product/API integration, automatic content generation and manufacturing/formulation are out of scope. Tracking: [Issue #37](https://github.com/shahoo-workspace/shahoo/issues/37), implementation proposal: [PR #40](https://github.com/shahoo-workspace/shahoo/pull/40).

### Current application behavior and integration design

- The existing `/oil-guide` uses product-level `oilFinder` metadata (intended use, texture and scent) and a simple score. It does not currently use the encyclopedia.
- PR #40 adds a separate `oil_product_links` mapping table with `pending/approved/disabled` states. No product-to-oil mappings are inferred or prefilled; approval requires an admin identity and timestamp.
- The encyclopedia reader is opt-in through `OIL_ENCYCLOPEDIA_ENABLED=true` and a separate `OIL_ENCYCLOPEDIA_DATABASE_URL`. It never falls back to the storefront `DATABASE_URL`.
- The runtime reads only `oil_encyclopedia.public_oil_profiles` and `oil_encyclopedia.public_safety_warnings` in a `READ ONLY` transaction. It does not query base research/audit tables.
- Existing recommendation scoring remains unchanged. Approved bank facts and safety warnings enrich mapped results; no unapproved narrative is converted into recommendation tags.

### v3.2 data and SQL import checks

- Re-ran `validation/validate_v32.py` from the supplied archive: **0 errors, 0 warnings, 44 active JSON tables, 16/16 fail-closed tests passed**.
- The validator explicitly reports SQL execution as `NOT_RUN`; it validates the data package, not a live PostgreSQL import.
- All 41 oil profiles have `customer_display_allowed=false`; 22 are eligible-but-pending and none is approved. All 14 safety dossiers also have zero final approvals. The customer-facing views therefore correctly return no approved records today.
- The v3.2 bundle still has version drift: `schema_v32.sql` header and `DATABASE_SCHEMA.md` / `DATA_DICTIONARY.md` identify v3.1. `Table_Decisions.json` also contains legacy `row_count/location` keys alongside the v3.2 `rows_v3/location_v31` shape. The dedicated importer corrects the generated header and normalizes those legacy keys without modifying the original archive or dropping the data.
- The importer namespaces the 47 SQL tables and 7 views into `oil_encyclopedia`, scopes the read role's grants/revokes/default privileges to that schema, imports only the 44 active JSON tables, and skips the consolidated export and validation report. It is separate from the normal storefront migration runner.

### Staging / branch state

- Created isolated Neon branch `oil-encyclopedia-v32-integration` from Staging after aggregate checks found no customer or order rows in the source Staging branch.
- Applied and verified migration #0020 (`oil_product_links`) on that isolated branch only. The table and indexes exist; mapping row count is **0**.
- The full v3.2 encyclopedia schema and data have **not** yet been imported into this branch. The dedicated importer has not yet been run against Neon.
- Integration remains disabled by default. No Vercel environment variable, shared Staging configuration, Production database, Production migration, or deployment was changed.

### Next gates

1. Complete CI and review [PR #40](https://github.com/shahoo-workspace/shahoo/pull/40).
2. Run the guarded importer against the isolated Neon integration branch only; verify table counts, foreign keys, view definitions, role privileges and zero approved-view rows.
3. Create a separate login role as a member of `shahoo_oil_encyclopedia_reader`; set `OIL_ENCYCLOPEDIA_DATABASE_URL` only in an approved Staging environment.
4. Confirm actual sellable product identities and create explicit, reviewed product mappings; no name-only inference.
5. Obtain qualified content/safety signoff before any record can pass the public views. Only then consider enabling the feature in Staging.
6. Production import, migration and feature activation require a separate explicit owner approval and the normal Production migration/backup gates.
