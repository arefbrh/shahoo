# SHAHOO — Provider Status & Integration Ledger

**Updated:** 25 November 2026

| Service | Code / adapter | Default state | Environment contract | Live verification |
|---|---|---|---|---|
| Database | PostgreSQL via `DATABASE_URL` / Drizzle | Required in Production | `DATABASE_URL`; Docker bootstrap uses `POSTGRES_*` admin plus `APP_DB_*` runtime role; native restore uses `RESTORE_DATABASE_URL` | Neon Staging and Production branches exist; no new Production migration was run |
| Media storage | Local disk and S3-compatible adapter | Local requires explicit Production opt-in | `STORAGE_PROVIDER=s3`, `STORAGE_S3_BUCKET`; endpoint/region/credentials may use `STORAGE_S3_*`, `S3_*`, or Neon/AWS-standard `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Neon Storage is enabled on both branches; private `shahoo-media` bucket exists on Staging; no Production bucket and no live object PUT/GET/DELETE yet |
| PayPing | PayPing v3 lifecycle and server verification | Disabled | `PAYMENT_PROVIDER=payping`, `PAYPING_LIVE=1`, `PAYPING_API_KEY`, `PAYPING_RETURN_URL` | No live merchant transaction or sandbox verification |
| SMS.ir | Verify API adapter | Disabled | `SMS_MODE=live`, `SMS_LIVE=1`, `SMS_PROVIDER=smsir`, `SMS_IR_API_KEY`, `SMS_IR_OTP_TEMPLATE_ID` | No real message or provider sandbox verification |
| Carrier tracking | Post / Tipax / Chapar links | Public links only | Carrier name and tracking code | Tipax and Chapar official portals checked; Post official tracking domain corroborated, direct page fetch timed out; codes are entered manually |
| Torob | Public product-feed endpoint | Endpoint present in candidate | `APP_URL` | Feed contract not yet validated against Torob |

## Neon Object Storage branch state

- Staging project: `morning-voice-81212343`; branch: `br-young-heart-b96c797x`.
- Staging endpoint region: `eu-central-1`; bucket `shahoo-media` is private.
- Production project: `billowing-queen-40432154`; branch: `br-curly-dust-ba1kq0xb`.
- Production Object Storage is enabled, but no bucket has been created there.
- A Staging credential with `storage:read` and `storage:write` exists. Its secret was not retrieved or changed.
- Vercel Preview does not yet have the AWS/S3 environment variables, so the app is not yet configured to use this bucket.

## Safety defaults

- PayPing is not live unless all four PayPing conditions are configured and verified.
- SMS.ir is not live unless live mode, live flag, provider, API key and approved Verify template ID are present.
- Trust marks start in `pending`; do not display a verified badge without actual approval.
- Production must use a durable PostgreSQL database and persistent media storage.
- Never paste production secrets into source, ZIPs, issue comments or reports.
