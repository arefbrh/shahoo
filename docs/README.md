# SHAHOO documentation map

This directory explains which documents are current, which are historical, and where future agents should start.

## Canonical starting points

1. [Project handoff](../PROJECT_HANDOFF.md) — **single current handoff**: product context, stack, verified repository and deployment history, Neon/Vercel Preview configuration boundaries, PR history, tests actually run, release gates, and ordered roadmap.
2. [Remaining issues](../REMAINING_ISSUES.md) — current issue register. Treat each status and its evidence boundary literally.
3. [Batch 09 comprehensive audit](../BATCH_09_COMPREHENSIVE_AUDIT.md) and [remediation report](../BATCH_09_REMEDIATION_REPORT.md) — detailed source audit and corrective work evidence.
4. [AGENTS.md](../AGENTS.md) — non-negotiable contributor/agent rules.
5. [Production guidance](PRODUCTION.md) — deployment and release constraints; never infer that Production is configured merely because Preview works.
6. [Test evidence](../TEST_REPORT.md) — results by candidate and environment, including deferred checks.
7. [Release milestone](https://github.com/shahoo-workspace/shahoo/milestone/1) — active work items and their acceptance criteria.

## Roadmap and self-hosting operations

- [Admin implementation tracker](ADMIN_IMPLEMENTATION_TRACKER.md) — Batch 01–10 roadmap and current exit criteria.

## Self-hosting and operations

- [Integration diff](INTEGRATION_DIFF.md) — files added, changed, corrected and deliberately left untouched.
- [Project status](PROJECT_STATUS.md) — source comparison and actual verification boundary.
- [Capability matrix](CAPABILITY_MATRIX.md) — code presence versus tested/verified status.
- [Provider status](PROVIDER_STATUS.md) — exact runtime environment names and disabled-by-default integrations.
- [Self-hosting architecture](SELF_HOSTING_ARCHITECTURE.md) — intended Docker/VPS topology, not a live host.
- [VPS deployment](VPS_DEPLOYMENT.md) — Linux/Docker instructions; migrate only with the explicit guard.
- [Windows Server deployment](WINDOWS_SERVER_DEPLOYMENT.md) — native Windows instructions and service prerequisites.
- [Backup and restore runbook](BACKUP_RESTORE_RUNBOOK.md) — current scripts and unimplemented PITR/off-site work.
- [Release checklist](RELEASE_CHECKLIST.md) — owner-operated release gates.
- [Security hardening](SECURITY_HARDENING.md) — controls and verification limits.

## Current technical references

- [PostgreSQL verification](POSTGRESQL_VERIFICATION.md)
- [Payment state machine](PAYMENT_STATE_MACHINE.md)
- [CMS media](CMS_MEDIA.md)
- [Provider verification](BATCH_09_PROVIDER_VERIFICATION.md)
- [PayPing configuration checklist](PAYPING_CONFIGURATION_CHECKLIST.md)
- [SMS.ir configuration checklist](SMSIR_CONFIGURATION_CHECKLIST.md)
- [Release 1.0.0 notes](RELEASE_1.0.0.md)

Provider checklists are preparation documents, not proof of live credentials or successful real transactions. PostgreSQL instructions must only target disposable databases unless an explicitly approved release procedure says otherwise.

## Historical records and archives

- Root-level `BATCH_*_REPORT.md`, `BATCH09-*.md`, `CHANGELOG.md`, and `DECISIONS.md` preserve implementation history and decisions. They are not all current status sources.
- `LATEST_HANDOFF.md`, `PROJECT_STATE.md`, `NEXT_BATCH_BRIEF.md`, `FILE_INVENTORY.md`, `CLEANUP_PLAN.md`, and `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` contain historical snapshots. Read their supersession notices before relying on any dated status or instruction.
- `docs/archive/` contains superseded originals retained for audit/history. Do not restore or follow archived instructions without checking current source and the canonical handoff.

## Cleanup policy

Do not delete historical reports, migrations, tests, assets, or scripts solely because they look old or duplicated. First search all references and workflows, verify whether the content is represented elsewhere, and preserve unique evidence in the archive. Delete only files proven to be unused and non-authoritative; never delete customer/order/payment/inventory/media data or weaken tests to make CI pass.


## Admin platform implementation

See [Admin Implementation Tracker](./ADMIN_IMPLEMENTATION_TRACKER.md) for the phased admin-platform plan, portability rules, active branch, verification evidence, and agent handoff instructions.

- [Neon Object Storage setup and Staging status](NEON_OBJECT_STORAGE_SETUP.md)
