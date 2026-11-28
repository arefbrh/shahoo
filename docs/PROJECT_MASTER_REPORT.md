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

The encyclopedia remains a reusable knowledge source for future agent-assisted product creation, product descriptions, customer Q&A and educational content. The current owner-approved runtime scope is the Oil Guide/recommendation experience. PR #42 integrated approved encyclopedia enrichment into the existing recommender; PR #45 adds a separate database-driven taxonomy/discovery baseline. The owner has since clarified that the desired primary experience is a guided customer questionnaire returning three ranked oils from all 41 canonical encyclopedia oils, independent of storefront product availability. The current PR #45 visual design is not accepted as final and is to be redesigned by the next agent. Broad CMS/product/API integration beyond the Oil Guide, automatic content generation and manufacturing/formulation remain out of scope. Tracking: [Issue #37](https://github.com/shahoo-workspace/shahoo/issues/37), [PR #42](https://github.com/shahoo-workspace/shahoo/pull/42), [PR #45](https://github.com/shahoo-workspace/shahoo/pull/45). See [Oil Guide Product & Design Handoff](OIL_GUIDE_PRODUCT_AND_DESIGN_HANDOFF.md).

### Current application behavior and integration design

- The existing `/oil-guide` uses product-level `oilFinder` metadata (intended use, texture and scent) and a simple score. It does not currently use the encyclopedia.
- Merged PR #42 adds a separate `oil_product_links` mapping table with `pending/approved/disabled` states. No product-to-oil mappings are inferred or prefilled; approval requires an admin identity and timestamp.
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

- Created isolated Neon branch `oil-encyclopedia-v32-integration` (`br-raspy-river-b9kyn1t1`) from Staging after aggregate checks found no customer or order rows in the source Staging branch.
- Applied and verified migration #0020 (`oil_product_links`) on that isolated branch only. The table and indexes exist; mapping row count is **0**. The `pg_trgm` extension and NOLOGIN group role `shahoo_oil_encyclopedia_reader` were also created/verified there; no encyclopedia tables or views have been imported yet.
- The full v3.2 encyclopedia schema and data have **not** yet been imported into this branch. The dedicated importer has not yet been run against Neon. The reader group is NOLOGIN, non-superuser and non-BYPASSRLS; no dedicated LOGIN reader credential exists.
- The final PR CI run for head `57f371bdf041c6ed4f8e72f59a16eb786531919b` passed all eight executable jobs (project tests, PostgreSQL integration/migrations, quality, Docker/Compose, migration inventory, security, Windows build/recovery, payment/SMS mocks); the private Manus harness was skipped by design. The package validator still reports SQL execution as `NOT_RUN`.
- Issue #37 remains open for the outstanding import and staging verification. No Vercel encyclopedia environment variables were added. Recent Vercel deployment history contained no deployment for merge commit `b51be73505b4e43c1e61b0a877d153d3de483b61`; no manual deployment was triggered. Production and shared Staging configuration remain unchanged.

### Next gates

1. PR #42 is merged and its CI passed; no further PR review is pending for that implementation.
2. Run the guarded importer against the isolated Neon integration branch only; verify 47 tables, 7 views, row counts, foreign keys, view definitions, role privileges and zero approved-view rows.
3. Create a separate login role as a member of `shahoo_oil_encyclopedia_reader`; verify it cannot write or access unrelated schemas. Add `OIL_ENCYCLOPEDIA_DATABASE_URL` only to a specifically approved Staging Preview environment; keep the feature flag off until tests pass.
4. Test the existing recommendation path for missing source, no mapping, ambiguous mapping, unapproved records, safety warnings and synthetic approved fixtures. Existing scoring must remain unchanged.
5. Confirm actual sellable product identities and create explicit, reviewed product mappings; no name-only inference. Obtain qualified content/safety signoff before any record can pass the public views. Only then consider enabling the feature in Staging.
6. Production import, migration, environment changes and feature activation require separate explicit owner approval and the normal Production migration/backup gates.

## 12. Oil Guide database-driven taxonomy and discovery — 2026-11-27

### Implementation in PR #45

- PR #45 (`feat/oil-guide-taxonomy-discovery`) introduces a data-driven discovery experience under the existing `/oil-guide` route while retaining the existing quick recommendation wizard.
- The new route architecture includes area, category, concern, search and canonical oil-profile pages. All encyclopedia reads are server-side through validated TanStack Start server functions and the separate optional reader connection.
- The new reader accesses only explicit `public_guide_*` views and the existing `public_oil_profiles`, `public_claims`, `public_protocols`, `public_faq`, `public_oil_qa`, `public_safety_warnings` and `public_problem_oils` views. It does not read internal research/audit tables.

### Taxonomy derived from the actual v3.2 package

- The importer creates `guide_areas`, `guide_categories`, `guide_concerns` and `oil_guide_mappings` in the isolated `oil_encyclopedia` schema; it does not add conflicting tables to the storefront `public` schema.
- Three navigation areas are defined: Hair, Skin and Topical use.
- Five source-backed categories are derived from actual `Applications.category` values: `ساقه مو`, `ریشه مو و پوست سر`, `پوست`, `سنتی و موضعی` and `ماساژ`.
- The 38 concern/topic records preserve their canonical `Applications.app_id`. The source's combined `ریشه مو و پوست سر` category is retained as one category; the source does not justify splitting roots and scalp. No independent hair-ends, hair-length or feet categories are fabricated.
- Oil-to-topic relationships are generated from actual `Problem_Oil_Map` records, retaining canonical `oil_id` and supporting `map_id`. These are inserted only as `needs_human_review` / `hidden`; this is a traceable review queue, not customer-facing eligibility.

### Publication and least-privilege gates

- The public guide mapping view requires an explicit manual mapping approval (`review_status=approved`, `display_status=published`, reviewer and timestamp) and a matching row in the existing signed-off `public_problem_oils` view plus the signed-off `public_oil_profiles` view.
- The read-only role receives SELECT only on the four new `public_guide_*` views. It receives no direct SELECT on the taxonomy mapping tables or internal v3.2 research tables.
- Public area/category metadata may be listed with an approved oil count of zero. Concern pages and oil cards appear only when at least one valid public mapping exists. Profile sections are omitted unless their respective approved public view returns data.
- If the reader is disabled or unavailable, the UI shows an explicit status message and never falls back to unverified storefront metadata or hardcoded oil profiles.

### Verification and remaining gates

- PR #45 CI is running; its first failed typecheck exposed that TanStack route types must be generated before TypeScript checks. The branch now uses the Vite build as the `pretypecheck` step to regenerate the typed route tree before `tsc`.
- Latest Vercel Staging deployment `dpl_BBvx9Qsi7p4HCi1gsfBLctpQX1Y7` reached READY for PR #45 at commit `9b31e20af170158324ad1cedb7ced19a06cba118`: https://shahoo-1hhyw2nyh-shahoo.vercel.app/oil-guide. The separate encyclopedia DB is still unimported/unconfigured, so the guide correctly renders its disabled-source state.
- The complete v3.2 package is still not imported into the isolated Neon branch. The taxonomy DDL/seed code has not yet been executed against that branch; its live PostgreSQL view creation and row-count verification remain unverified.
- No dedicated login reader, Vercel encyclopedia connection string, enable flag, product mappings or customer-content approvals exist. No Production migration, secret change, feature activation or Production deployment has been performed.
- The owner is currently using an iPhone and has no Windows PC or ready VPS. The guarded importer helper remains pending until a network-capable environment is available; no connection string should be pasted into chat.

### Next steps

1. Complete PR #45 CI and resolve any remaining failures before merging.
2. Deploy the final PR head to Vercel Staging and verify the new route tree and safe empty-state experience.
3. When a network-capable environment is available, import v3.2 into the isolated Neon integration branch and verify the four taxonomy views, all source relationships, grants and zero initial customer-visible mappings.
4. Create a dedicated read-only login role and configure only the approved Staging Preview environment after the import is verified.
5. Review the pending taxonomy mappings with a qualified human reviewer. Do not activate public guide content until mapping approval and source publication gates both pass.


## 12. Owner-clarified Oil Guide recommendation and redesign direction — 2026-11-27

The owner clarified that the current PR #45 visual design is not the desired final UX. The implementation must be preserved as a technical baseline, while the customer-facing experience is redesigned around a guided questionnaire and a three-result ranked recommendation.

- Candidate universe: all 41 canonical v3.2 oils, not the current three storefront oil products. Product mapping, listing status and stock must not affect recommendation eligibility or rank.
- Separate canonical oil identity, reviewed recommendation eligibility, customer-content publication approval and commerce availability. The current v3.2 snapshot still has no final-approved oil profiles and no customer-approved Problem_Oil_Map rows; no publication gate may be bypassed to make the feature appear populated.
- Questionnaire: source-backed areas, categories and concerns, with relevant progressive questions for hair/skin attributes, intended use, preferences and sensitivities only where reviewed data supports them.
- Results: three unique oils ranked 1–3 whenever at least three are legitimately eligible. Use a transparent 0–100 compatibility score, not a claim of proven efficacy or probability. Safety exclusions are hard gates; missing data is not a positive match.
- A non-stocked/non-listed oil remains a valid recommendation; show commerce availability separately and offer a purchase link only for an explicit oil-product mapping.
- Do not invent unsupported concerns/categories, benefits, usage protocols or safety claims. Keep the roots/scalp category combined as in source data unless reviewed evidence justifies a taxonomy change.
- Full requirements, current code paths, operational limitations, UX direction and acceptance tests are documented in [docs/OIL_GUIDE_PRODUCT_AND_DESIGN_HANDOFF.md](OIL_GUIDE_PRODUCT_AND_DESIGN_HANDOFF.md). This focused document was explicitly requested by the owner.

This section supersedes any earlier implication that the final Oil Guide should remain a product-only recommender or that its customer experience should be limited to browsing the taxonomy. PR #45 remains an unmerged feature branch; no production action is authorized.


## 13. Oil Guide guided questionnaire and 41-oil recommender — 2026-11-27

### Branch and preservation boundary

- PR #45 remains open, unmerged and unchanged. The follow-up branch `feat/oil-guide-guided-recommendations` was created from the inspected PR #45 head `bc726036d3e185d02113dc10dc4e8c91ba2ed80f`, not from `main`.
- All follow-up changes are isolated to that new branch. No merge, shared database import, Vercel secret/flag update, Production change or deployment was performed.

### Implemented in the follow-up branch

- Replaced the primary `/oil-guide` customer journey with a Persian RTL, mobile-first staged questionnaire. The old product-only recommender is no longer the primary flow; the existing taxonomy/search pages remain secondary browse paths.
- Added validated server functions for questionnaire data and recommendation submission. Encyclopedia reads use the separate connection in read-only transactions and only the dedicated guide views. The browser never connects to Neon.
- Added an explicit recommendation review table, seeded pending for every canonical oil. Its limited customer-facing name/attribute snapshot is NULL by default and must be transcribed from source and approved by an authorized reviewer; import does not auto-fill it. The review table keeps `recommendation_status`, `safety_decision` and `display_status` separate; the candidate view exposes recommendation-candidate eligibility and customer-display approval separately and combines them only for customer ranking. A new candidate view starts from all canonical `oils` rows and has no storefront/product/inventory join. Names and facts are returned only after separate recommendation-specific human review and limited display approval.
- Recommendation snapshot approval, recommendation eligibility, safety decision, limited customer display approval and questionnaire concern approval are separate from full encyclopedia profile/public-content approval. Every scored concern relationship must still pass its human mapping review and the source `public_problem_oils` final-signoff view. The new questionnaire label gate is limited to the new recommender views; the existing PR #45 `public_guide_oils` browse projection retains its prior behavior and the detailed profile/browse gates remain unchanged.
- Added deterministic scoring (initial weights: concern 60, category 25, area 10, texture 5), reason codes, factor breakdown, canonical-ID deduplication, deterministic tie-breaks and hard safety eligibility gates. Scores are compatibility scores, not clinical efficacy or probability.
- Added post-ranking storefront availability enrichment. Approved product mapping, product publication and stock are never candidate filters or scoring inputs.

### Tests added

- `scripts/oil-guide-recommendations.test.mjs`: 41 canonical candidate rows remain in the pool when only three storefront products are mapped; an unlisted oil can still rank; commerce metadata does not change rank/score; deduplication, safety exclusions, missing attributes, deterministic ordering and fewer-than-three behavior.
- `scripts/oil-guide-taxonomy.test.mjs`: review/publication gates and the canonical-oil-rooted recommendation view, including the absence of storefront/inventory joins.
- CI run #280 on follow-up head `78dbc447ac5350241138e18276a888bba281c9f9` completed successfully. Project tests: 147 passed, 0 failed. Quality/build, PostgreSQL integration and migrations, migration inventory, security checks, Windows native build/recovery, self-host Docker/Compose validation, and payment/SMS mocks all passed. The optional Manus private platform harness was skipped by the workflow. This is CI verification only; it is not a database import or deployment.

### Data and release limitations

- The v3.2 source still has no final-approved full oil profiles or public problem-oil mappings. The recommendation-specific snapshot rows and concern/mapping approvals are pending/hidden; no source approval is bypassed or fabricated.
- The full source import and SQL execution against the isolated Neon branch remain outstanding. The customer questionnaire remains closed and shows an insufficient-approved-data readiness notice until at least three oils and their source-backed relationships pass the separate recommendation, safety and display reviews.
- PR #45's Staging preview, disabled source state and all existing production/release boundaries remain untouched.

### Oil Guide acceptance follow-up — PR #46
Ranking requires a selected category and, when supplied, a selected concern. Only active concern relationships enter the candidate projection. Published snapshots require a source version, record reference and review note. Optional questions follow the selected categories and topics. Verification covers context-only rejection, active concern filtering and provenance constraints. The isolated v3.2 import and human approval of customer content remain open in #37.


## 14. Agent governance, quota discipline and context handoff — 2026-11-28

This policy update is tracked by [Issue #47](https://github.com/shahoo-workspace/shahoo/issues/47) and is defined operationally in [AGENTS.md](../AGENTS.md). It applies to the owner, maintainers and all AI coding agents.

### Issue-first work and closure

- Material bugs, security/reliability/performance findings, architectural concerns, technical debt and substantial implementation tasks must be duplicate-checked and represented by a GitHub Issue before implementation.
- Each Issue records evidence/context, impact, scope/non-goals, acceptance criteria, dependencies/risks and expected verification. The corresponding existing technical docs/runbooks retain the durable technical explanation; the Issue remains the canonical task tracker.
- When resolved, update the Issue with the linked PR/commit, checks actually run, acceptance results and remaining risk. Close only after merge and verification. Unresolved or blocked findings remain open with an explicit reason. Trivial changes may be included in an existing Issue/PR.

### Quota-aware execution

- Perform investigation, reproduction and proportionate tests in the agent's local/sandbox environment first. Batch coherent changes and push when a reviewable checkpoint is ready.
- Avoid unnecessary deployments, repeated Preview deployments, manual workflow reruns, duplicate branches/PRs, repeated push cycles and noisy status activity. Use hosted Preview only when the behavior under test requires it.
- Run focused local checks first and use one appropriate CI checkpoint for the PR. Never weaken or bypass required checks, release controls or security gates to save quota. No live provider or Production operations are authorized by this process rule.

### Fast onboarding and continuity

- Replacement agents receive a progressive reading path: AGENTS.md, PROJECT_HANDOFF.md, relevant portions of this report, docs/README.md only as an index, then the specific Issue/PR and task-related source/tests. Archived Batch reports and unrelated code are not mandatory onboarding material.
- ZIP-only agents start from the same compact context files and package.json, inspect the top-level tree, and then trace only task-specific paths. They must not bulk-read the repository. Lack of live GitHub access must be reported as an unknown, not guessed.
- PROJECT_HANDOFF.md is the concise shared start point; this report remains the single implementation/verification record; GitHub Issues remain the task tracker. Do not create a new report/handoff for each agent switch.

### Scope and verification of this update

This is a documentation/governance change only. It does not alter application code, CI workflows, deployment configuration, environment variables, database state, provider credentials or Production. No deployment or manual workflow run is part of this change. Acceptance is verified by reviewing consistency across AGENTS.md, PROJECT_HANDOFF.md and this section; runtime/build tests are not applicable to the documentation-only change.
