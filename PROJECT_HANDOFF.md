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
