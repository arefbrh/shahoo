> **Revision 02.1 continuity notice (2026-11-19):** The content below is a historical snapshot, not current release or next-batch authorization. The latest completed remediation is Batch 08 Revision 02; current work is Batch 08 Revision 02.1. Release is **NOT READY FOR RELEASE**, final approval is pending, and Batch 09 has not started. For current evidence and actions, read `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `REMAINING_ISSUES.md`, `BATCH_08_FINAL_RELEASE_EVIDENCE.md`, and `docs/PRODUCTION.md`. Historical “checkpoint” numbering is not authorization for Batch 09.

---

# Deployment notes — v1.0.0

Batch 01 correction: `npm run build` does not migrate. Use `npm run db:migrate` after configuring `DATABASE_URL`. Production also needs `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`. See `docs/PRODUCTION.md` and `.env.example`. No new secret was added. Do not create a `.env` in the repository.

## Install and run

```text
npm install
npm test
npm run build
npm run dev
```

`npm run dev` listens on `0.0.0.0:8080` and sets `SEED_DEMO=1`, `ECHO_OTP=1`, and `ALLOW_DEV_CSP=1` for that process only. Those flags do nothing when `NODE_ENV=production`. Without `DATABASE_URL`, development uses embedded PGLite. A Postgres database is migrated only by an explicit `npm run db:migrate`, never by `npm run build`. This batch was not executed against a live Neon database.

## Environment

See `docs/PRODUCTION.md`. New or tightened names:

- `ALLOW_LOCAL_STORAGE=true` is required before production will store uploads on disk. Unset means the upload desk says storage is not configured. Development still uses local disk.
- `PAYMENT_PROVIDER=mock` works only with `ALLOW_MOCK_PAYMENT=1` and when `NODE_ENV` is not `production`. Zarinpal, Zibal, and IDPay still throw instead of calling the network.
- Relaxed CSP requires `ALLOW_DEV_CSP=1` and is ignored in production. `unsafe-inline` remains.
- `STORAGE_PROVIDER` other than empty or `local` stores nothing. No cloud adapter is implemented.

`VITE_AUTH_ENABLED` stays false. Customer and admin sessions are the shop cookies.

## This version

There is no new SQL file. `0007_media_primary.sql` from v0.9.2 still enforces one primary product image. Orders and media rows are not rewritten.

Production CSP is strict unless the process is not production and `ALLOW_DEV_CSP=1`. `npm run dev` sets that flag for local preview. `unsafe-inline` remains in `script-src` and `style-src` because removing it breaks the TanStack Start bootstrap. There is no nonce plumbing in this framework setup.

JPEG uploads are decoded and encoded again (`jpeg-js`). PNG pixels are unfiltered and compressed again. GIF is LZW-checked and kept so animation is not flattened. WebP uploads are currently rejected until a real pixel decoder/encoder is installed; do not re-enable based on RIFF/chunk inspection alone. The return desk applies the server row, including order status and history, and then reloads the queue.

Database backup is still the host’s job. This zip is source, not an order backup.

This version can take unpaid orders and record an internal refund. It must not be described as ready to charge a real card until a gateway is connected and checked with a real or official sandbox transaction.
