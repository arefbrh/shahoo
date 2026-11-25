# SHAHOO — Backup, Restore & Disaster-Recovery Runbook

**Status:** operational scripts are present in source; no production host, external backup target, or restore drill has been executed.

## 1. What exists now

| Capability | Source implementation | Verification status |
|---|---|---|
| PostgreSQL logical backup | `scripts/linux/backup-db.sh`, `scripts/windows/backup-db.ps1` | Source-reviewed; runtime not executed here |
| Backup validation | `pg_restore --list` before finalizing the dump | Source-reviewed; not run against a live DB |
| PostgreSQL restore | `scripts/linux/restore-db.sh`, `scripts/windows/restore-db.ps1` | Destructive command requires explicit confirmation; not executed |
| Media archive | `scripts/linux/backup-media.sh`, `scripts/linux/restore-media.sh` | Source-reviewed; not executed |
| Retention | Database and media archive rotation by configured age on Linux and Windows | Source-reviewed; not executed |
| Monitoring | Linux Docker health checks and Windows host checks | Source-reviewed; not installed as scheduled tasks |
| Encryption | Not implemented | OPEN |
| Off-site replication | Not configured | OPEN |
| WAL archiving / PITR | Not configured | OPEN |
| Full disaster-recovery drill | Not executed | BLOCKED until disposable PostgreSQL + media environment exists |

The 3-2-1 policy, RPO 15 minutes, and RTO 4 hours are **targets**, not achieved guarantees.

## 2. PostgreSQL logical backup — Docker/Linux

```bash
cd /opt/shahoo
scripts/linux/backup-db.sh /opt/shahoo/backups/database 30
```

The script runs `pg_dump` inside the private database container as the bootstrap database administrator, validates the custom-format archive with `pg_restore --list`, then atomically renames it. It does not publish port 5432.

## 3. Media backup — Docker/Linux

```bash
cd /opt/shahoo
scripts/linux/backup-media.sh /opt/shahoo/backups/media 30
```

The archive covers `/app/storage/media`, which is backed by the persistent `shahoo_media_data` volume. The second argument sets retention days (default 30). Restore rejects absolute paths, traversal entries and unexpected archive roots. Keep the database dump and media archive from the same recovery window.

## 4. Restore — explicit destructive operation

First verify the archive and choose the intended target. Then run:

```bash
scripts/linux/restore-db.sh /path/to/shahoo_db_YYYYMMDD_HHMMSS.dump
scripts/linux/restore-media.sh /path/to/shahoo_media_YYYYMMDD_HHMMSS.tar.gz
```

Both scripts require typing `RESTORE`. The database restore uses the bootstrap administrator to drop/recreate the target database, pre-creates required extensions/timezone, then restores objects as the application role. They stop `app` and `worker`; if stopping fails before destructive work, the scripts attempt to restart services. If database/media replacement has begun and restore fails, services intentionally remain stopped so an operator can inspect or recover the state rather than serving a partial restore. Never test against Production.

Windows native database and media operations are under `scripts/windows/`:

```powershell
powershell -File scripts\windows\backup-db.ps1
powershell -File scripts\windows\backup-media.ps1
powershell -File scripts\windows\restore-db.ps1
powershell -File scripts\windows\restore-media.ps1
```

`restore-db.ps1` recreates the selected database after explicit confirmation; it requires a role allowed to drop/create the database. `restore-media.ps1` preserves the previous media directory under a `.pre-restore-*` name, rejects absolute/traversal paths and accepts a valid empty archive. If a restore fails after replacement begins, the app service remains stopped for manual inspection. Both restore commands require an explicit confirmation unless the operator deliberately supplies `-Force`.

## 5. Scheduling

Linux example (after validating paths, permissions and service account):

```cron
0 3,15 * * * cd /opt/shahoo && ./scripts/linux/backup-db.sh
0 4 * * * cd /opt/shahoo && ./scripts/linux/backup-media.sh
*/5 * * * * cd /opt/shahoo && ./scripts/linux/monitor-health.sh
```

Windows scheduled tasks are registered by `scripts/windows/setup-server.ps1`. The tasks run as `SYSTEM`; verify that the service account can read the environment file and write to the backup directory.

## 6. Required work before Production approval

- Configure encrypted backups with a separately stored encryption key.
- Configure an independent off-site destination and verify object retention/immutability.
- Configure PostgreSQL WAL archiving and PITR only after choosing and testing a supported archive tool.
- Back up and restore roles/globals and all media, not only the public schema.
- Run a restore drill on a disposable PostgreSQL instance with representative media.
- Compare migration state, row counts, indexes, and media references after restore.
- Record actual RPO/RTO measurements and the operator responsible.
- Alert on failed backup, stale backup, disk pressure, and failed restore.
- Never claim PITR, encryption, off-site recovery, or a successful restore until evidence exists.
