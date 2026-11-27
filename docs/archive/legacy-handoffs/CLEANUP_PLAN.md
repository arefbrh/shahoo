> **Historical cleanup note:** This file records the original v1.0.0 dependency and retention decisions. It is not the current repository inventory or release plan. Current status and authoritative engineering instructions are in [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md); the documentation map is [docs/README.md](docs/README.md).

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
