# SHAHOO — Agent Handoff

**Last consolidated:** 2026-11-27  
**Repository:** `shahoo-workspace/shahoo`  
**Default / production branch:** `main`  
**Current master report:** [docs/PROJECT_MASTER_REPORT.md](docs/PROJECT_MASTER_REPORT.md)  
**Active work:** [GitHub Issues](https://github.com/shahoo-workspace/shahoo/issues) · [Release milestone](https://github.com/shahoo-workspace/shahoo/milestone/1)

## Start here

1. Read [AGENTS.md](AGENTS.md) for mandatory constraints.
2. Read [the Project Master Report](docs/PROJECT_MASTER_REPORT.md) for implemented features, architecture, Batch 00–10 history, exact test evidence, security review and current release blockers.
3. Fetch the current open GitHub Issues and any relevant PR before starting work. Issues are the source of truth for task status and acceptance criteria.
4. Work on a new branch; submit changes through a single reviewable PR. Do not push directly to `main`.

## Current state

- PR #11 (self-hosting integration) is merged; PR #19 (repository documentation refresh) is merged.
- PR #12 (post-merge schema/Release verification) remains Draft; its follow-up checks were deferred by the owner.
- Current root migration history ends at `0019`. The last recorded Production schema is `0016`; Staging/disposable validation was recorded at `0019`.
- PayPing and SMS.ir are implemented as adapters but not verified against real merchant accounts or Sandbox. Keep Live disabled.
- Native Windows and Docker self-hosting code is present. A real owner VPS restore/reboot/production rehearsal is still outstanding.
- Production release is **not approved**.

## Newly tracked work

- [#35](https://github.com/shahoo-workspace/shahoo/issues/35): DDoS/WAF/bot protection and bounded Staging verification.
- [#36](https://github.com/shahoo-workspace/shahoo/issues/36): repository license, SBOM/third-party notices and asset-rights review.
- [#37](https://github.com/shahoo-workspace/shahoo/issues/37): connect the Oil Encyclopedia v3.2 only to the oil recommendation engine; no public encyclopedia or broad site integration.

All agents must extend the existing Project Master Report and focused runbooks; do not create new report/status/handoff files unless the owner explicitly approves.

## Safety boundaries

Never use Production data/credentials in tests, migrations, restore drills or local builds. Use synthetic fixtures and disposable PostgreSQL. Do not modify Production environment settings, deploy, enable live providers, rotate secrets, rewrite public Git history or delete production data without a separate explicit owner authorization.

The previous Batch reports and point-in-time handoffs are retained under [docs/archive](docs/archive/README.md). They are historical evidence, not competing instructions. For current status, this file, the master report and GitHub Issues supersede any older status banner.

 
## Current active integration work — 2026-11-27

- Security/legal documentation and the no-new-report-file policy were merged in PR #38. Issues #35 (DDoS/WAF/bot), #36 (licensing/third-party rights) and #37 (oil recommendation integration) are open.
- PR #42 was merged into `main` as squash commit `b51be73505b4e43c1e61b0a877d153d3de483b61`; CI passed. Issue #37 was reopened because the Neon data import, dedicated login reader, and staging verification remain incomplete. The scope remains limited to the existing oil guide; no public encyclopedia section is being added.
- The importer now qualifies cross-view dependencies, inserts active JSON tables in topological foreign-key order (and refuses dependency cycles), and requires exact target host/database allowlists in addition to the non-production branch confirmation. These safeguards are covered by the PR test suite; full Neon import is still pending.
- Neon integration branch: `oil-encyclopedia-v32-integration` (`br-raspy-river-b9kyn1t1`). Migration #0020 exists there and the mapping table is empty. `pg_trgm` and the NOLOGIN group role `shahoo_oil_encyclopedia_reader` are provisioned there; the `oil_encyclopedia` schema and full v3.2 bank import have not run. The dedicated LOGIN reader is not created.
- No Vercel `OIL_ENCYCLOPEDIA_DATABASE_URL` or enable flag was added, and no deployment for the merge commit was found. Keep the integration disabled until import, grants, a read-only login, explicit product mappings and data signoff are complete.
- Continue updating [docs/PROJECT_MASTER_REPORT.md](docs/PROJECT_MASTER_REPORT.md) and the relevant GitHub Issues. Do not create new report/status/handoff files.
## Oil Guide taxonomy and discovery implementation — 2026-11-27

- PR #45 (`feat/oil-guide-taxonomy-discovery`) is open. It changes `/oil-guide` into a knowledge-discovery landing page while retaining the existing quick recommendation wizard.
- New nested routes cover area, category, concern, search and canonical oil profile. Data is fetched server-side through validated TanStack Start server functions; the browser never connects to Neon.
- The v3.2 importer now creates `guide_areas`, `guide_categories`, `guide_concerns` and `oil_guide_mappings` inside the isolated `oil_encyclopedia` schema. It derives three areas and five categories from the actual `Applications.category` values and creates hidden/pending links from `Problem_Oil_Map` rows.
- The actual v3.2 category values are `ساقه مو`, `ریشه مو و پوست سر`, `پوست`, `سنتی و موضعی` and `ماساژ`. Roots/scalp remain combined because that is how the source classifies them. No unsupported hair-ends/feet categories or inferred oil/product mappings are created.
- Only `public_guide_*` views are granted to the separate read-only role. A guide mapping must be manually approved/published and must join to the existing signed-off `public_problem_oils` and `public_oil_profiles` views before it can appear to customers.
- Current v3.2 import and Vercel reader configuration are still absent. Therefore the new pages intentionally show a disabled/unavailable/empty state; they do not fabricate categories, oil counts or approved content. No Neon import, Vercel secret, Production migration or feature activation is part of PR #45.
- Latest Vercel Staging deployment for PR #45: `dpl_BBvx9Qsi7p4HCi1gsfBLctpQX1Y7` is READY at commit `9b31e20af170158324ad1cedb7ced19a06cba118`: https://shahoo-1hhyw2nyh-shahoo.vercel.app/oil-guide. The deployment has no encyclopedia DB connection; its disabled-source state is expected.
- PR #44 was merged as `97fc3db151394beb50cc92f8043b96f232cd2336`; its guarded Windows importer helper remains unexecuted because the owner currently has only an iPhone and no network-capable Windows/VPS environment.


## Owner's clarified Oil Guide product/design brief — 2026-11-27

- The current PR #45 design is a preserved technical baseline, **not the owner's desired final customer experience**. Keep it in GitHub; the next agent should redesign the customer journey rather than discard the taxonomy/data work.
- The primary outcome is a guided, Persian RTL questionnaire that returns **three unique, ranked oil recommendations** (best match, second, third) with a transparent 0–100 compatibility score and reasons.
- The candidate pool is the full **41 canonical oils** in Encyclopedia v3.2, independent of whether an oil has a storefront SKU, explicit product mapping, active product, or inventory. Store availability affects only the purchase CTA/status, never candidate eligibility or rank.
- Keep recommendation eligibility, customer-content publication approval, canonical oil identity, and commerce availability as separate concepts. Never bypass source publication/safety gates. The 41 source profiles and 793 problem-oil mappings are not customer-approved in the current snapshot; review/approval remains a real dependency.
- Use source-backed areas/categories/concerns and progressively ask relevant customer questions. Do not invent concerns, unsupported subcategories, benefits, safety statements or protocols. Roots/scalp are one source category in v3.2.
- The score is a compatibility score, not a clinically proven efficacy percentage or probability. Safety exclusions are hard gates; missing data is not a positive match. Return exactly three only when at least three eligible oils exist; never fabricate or pad results.
- Full product/design, data, API, UX and acceptance criteria are in [Oil Guide Product & Design Handoff](docs/OIL_GUIDE_PRODUCT_AND_DESIGN_HANDOFF.md). This owner-requested focused handoff is an explicit exception to the general no-new-handoff-file rule in AGENTS.md.


## Oil Guide guided recommender follow-up — 2026-11-27

- Follow-up branch: `feat/oil-guide-guided-recommendations`, created from PR #45 head `bc726036d3e185d02113dc10dc4e8c91ba2ed80f`. PR #45 remains unchanged and unmerged.
- The primary `/oil-guide` flow is now a Persian RTL, mobile-first staged questionnaire with three ranked compatibility results when at least three eligible oils exist. The taxonomy browser is secondary.
- Candidate data starts from every canonical encyclopedia oil, not storefront products. A separate pending-by-default review controls a narrow name/attribute snapshot that reviewers must transcribe and approve; it is never auto-filled. Recommendation eligibility, safety decision and limited customer-display approval are distinct fields/gates. Each scored relationship still requires human mapping approval, an approved questionnaire concern and source `public_problem_oils` final signoff. Full profile publication remains separate.
- Storefront mapping/availability is looked up only after ranking and cannot affect candidate eligibility, score or rank.
- New focused tests cover the 41-oil pool with only three mapped shop products, unlisted recommendations, safety, missing data, deduplication and deterministic scoring. CI run #280 on the latest code/documentation head passed: 147 project tests, quality/build, PostgreSQL integration/migrations, migration inventory, security, Windows native build/recovery, Docker/Compose and payment/SMS mocks. The optional Manus private platform harness was skipped.
- The v3.2 import and all recommendation/concern/mapping approvals remain outstanding. The customer questionnaire must remain closed and show the insufficient-approved-data readiness notice until at least three candidates are legitimately recommendation-eligible, safety-cleared and display-approved. No Neon import, Vercel configuration, Staging activation, merge or Production action was performed.
- Detailed implementation and review-gate notes are in [Oil Guide Product & Design Handoff](docs/OIL_GUIDE_PRODUCT_AND_DESIGN_HANDOFF.md) and section 13 of [Project Master Report](docs/PROJECT_MASTER_REPORT.md).
