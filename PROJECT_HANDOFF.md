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
