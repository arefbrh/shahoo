<!-- BATCH 08 REVISION 02.1 CURRENT STATUS -->
# Current inventory notice — Batch 08 Revision 02.1

This document's counts and change descriptions below are historical Batch 06/earlier snapshots, **not** the current archive inventory. For the authoritative current input/output archive identity, eligible file and directory counts, exclusions, integrity checks and checksums, see [BATCH_08_FINAL_RELEASE_EVIDENCE.md](BATCH_08_FINAL_RELEASE_EVIDENCE.md). The current documentation includes the rebuilt [issue register](REMAINING_ISSUES.md) and its [superseded original](docs/archive/REMAINING_ISSUES_pre_revision_02_1.md). Do not substitute historical counts for final packaging evidence.

**Historical content notice:** Everything below is historical; conflicting statements about current contents, status or counts are superseded. Final approval has not been granted; Batch 09 has not started.

---

# FILE INVENTORY — SHAHOO 1.0.0 (Batch 06 product/CMS package)

**Baseline:** owner-supplied complete `SHAHOO-v1.0.0-batch05-customer-account.zip`, extracted to a separate workspace. **Method:** count each eligible regular file under the project root once and count all non-root directories that contain delivered files; count files rather than ZIP directory records. Exclude `.git`, dependencies, generated/build output, caches, local database/log/key files, real `.env` files, OS metadata and ZIP archives. Retain `.env.example`. Category order: `screenshots/`, SQL migrations, `*.test.ts|tsx|mjs`, Markdown, `public/`, source folders, other. Counts below are from the final Batch 06 source tree; no archive is included in its own count.

## Batch 06 package totals

- **Eligible regular files: 428**
- **Directories containing delivered files: 42**

| Category | Files |
|---|---:|
| Source files (`src/`, `server/`, `scripts/`, excluding tests) | 242 |
| Test files | 62 |
| Migrations | 11 |
| Documentation (`.md`) | 31 |
| Screenshots | 50 |
| Public assets (including `public/manus-routes.json`) | 21 |
| Configuration and other root files | 11 |
| **Total** | **428** |

## Batch 06 change summary

Relative to the extracted Batch 05 archive, Batch 06 adds four files and removes none: public CMS page route `src/routes/pages.$pageSlug.tsx`, catalog parser tests `src/server/catalog/admin.test.ts`, `docs/CMS_MEDIA.md`, and `BATCH_06_REPORT.md`. Existing application files, test registration, route tree and handoff documents were updated. No migration was added and migrations `0001`–`0011` remain unchanged. Detailed implementation and evidence: `BATCH_06_REPORT.md`.

The package includes complete source, public assets/screenshots, all historical migrations, tests, package manifests/lockfile, required scripts and continuity documentation. It excludes `node_modules`, build output, caches, databases, secrets, local environment files and duplicate ZIPs. `.env.example` is retained as a placeholder template; no real credentials are included.

## Historical Batch 05 totals

The Batch 05 archive contained 424 eligible files in 40 directories: 241 source, 61 tests, 11 migrations, 29 Markdown documents, 50 screenshots, 21 public assets and 11 other files. Batch 06 adds four files and changes no migration count.

## Historical Batch 04 correction totals

The Batch 04 correction package contained 409 eligible files in 39 directories: 234 source, 55 tests, 10 migrations, 28 Markdown documents, 50 screenshots, 21 public assets and 11 other files. The initial Batch 04 package contained 407 eligible files; its correction added migration `0010_batch_04_home_sections.sql` and `BATCH_04_CORRECTION_REPORT.md`. These historical figures must not be conflated with Batch 05 or Batch 06.
