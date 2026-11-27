# SHAHOO documentation map

This directory separates the one current project report from focused operational references and historical archives.

## Start here

1. [Project Master Report](PROJECT_MASTER_REPORT.md) — authoritative consolidated summary of Batch 00–10, features and fixes, test evidence, current release blockers, and security review.
2. [Project Handoff](../PROJECT_HANDOFF.md) — quick starting instructions for the next agent or maintainer.
3. [AGENTS.md](../AGENTS.md) — required engineering and safety rules.
4. [GitHub Issues](https://github.com/shahoo-workspace/shahoo/issues) — canonical task/status tracker; do not maintain a duplicate issue database in Markdown.
5. [Release milestone](https://github.com/shahoo-workspace/shahoo/milestone/1) — grouped release gates.

## Operations and hosting

- [Production deployment and environment rules](PRODUCTION.md)
- [Release checklist](RELEASE_CHECKLIST.md)
- [Self-hosting architecture](SELF_HOSTING_ARCHITECTURE.md)
- [Linux/Docker VPS deployment](VPS_DEPLOYMENT.md)
- [Native Windows Server deployment](WINDOWS_SERVER_DEPLOYMENT.md)
- [Windows VPS compatibility](WINDOWS_VPS_COMPATIBILITY.md)
- [Backup and restore runbook](BACKUP_RESTORE_RUNBOOK.md)
- [Security hardening](SECURITY_HARDENING.md)
- [PostgreSQL verification and migration procedure](POSTGRESQL_VERIFICATION.md)

## Application technical references

- [Capability matrix](CAPABILITY_MATRIX.md)
- [Provider status](PROVIDER_STATUS.md)
- [Payment state machine](PAYMENT_STATE_MACHINE.md)
- [PayPing configuration checklist](PAYPING_CONFIGURATION_CHECKLIST.md)
- [SMS.ir configuration checklist](SMSIR_CONFIGURATION_CHECKLIST.md)
- [Provider verification evidence](BATCH_09_PROVIDER_VERIFICATION.md)
- [Media storage](MEDIA_STORAGE.md)
- [CMS media](CMS_MEDIA.md)
- [Neon Object Storage setup](NEON_OBJECT_STORAGE_SETUP.md)
- [Release 1.0.0 notes](RELEASE_1.0.0.md)

Provider checklists are preparation material, not proof of live provider credentials or real transactions. PostgreSQL procedures must use disposable databases unless the owner has explicitly approved an exact Production release operation.

## Historical archive

The former root-level Batch reports, interim handoffs and test/status snapshots are retained under `archive/`:
- `archive/batch-reports/` — Batch 00–10 and correction/revision reports.
- `archive/legacy-handoffs/` — old project-state snapshots, prompts and continuation notes.
- `archive/status-reports/` — dated integration, test and infrastructure reports.
- `archive/issue-register/` — the previous long-form issue register snapshot.
- `archive/AGENTS.grok-platform-original.md` — original platform-specific instructions, retained for traceability only.

Archived files may contain superseded statuses, old test totals and instructions that no longer apply. They are not current agent instructions. Use the Project Master Report and open GitHub Issues for current status.

## Cleanup and deletion policy

Do not delete migrations, tests, code, scripts, media, brand assets or history simply because a filename appears old or duplicated. Check current imports, server middleware, Vite plugins, test runners, workflow references, public routes and compatibility fallbacks first. Prefer archival moves for historical evidence. Remove an active file only when it is proven unused and the removal has focused verification.
