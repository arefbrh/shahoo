> **Revision 02.1 continuity notice (2026-11-19):** The content below is a historical snapshot, not current release or next-batch authorization. The latest completed remediation is Batch 08 Revision 02; current work is Batch 08 Revision 02.1. Release is **NOT READY FOR RELEASE**, final approval is pending, and Batch 09 has not started. For current evidence and actions, read `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `REMAINING_ISSUES.md`, `BATCH_08_FINAL_RELEASE_EVIDENCE.md`, and `docs/PRODUCTION.md`. Historical “checkpoint” numbering is not authorization for Batch 09.

---

# CLEANUP PLAN — v1.0.0

No source file was deleted for this release. Migrations, tests, brand assets, and platform files stayed.

Zod was updated from the 4.4 range to `^4.6.6` because of a published memory advisory. No other package was removed.

`better-auth` remains. The shop does not authenticate through it, and a version jump was not required to ship the store.

## Kept on purpose

| Path | Why it stayed |
| --- | --- |
| `migrations/0002`–`0007` | Applied history |
| `public/assets/brand/**` | Official logos |
| `public/__grok/**` and `scripts/grok-pwa-*` | Platform preview and share-card injector |
| `@radix-ui/*`, `react-hook-form` | Workspace scaffold, no shop import |
| `better-auth` | Platform package, shop flag stays off |
