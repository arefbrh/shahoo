# SHAHOO media storage

Media files use the `ObjectStorage` contract in `src/server/media/disk.ts`. Database rows store a provider-qualified key (`local:<filename>` or `s3:<filename>`); the public media route resolves the key through the currently configured adapter. Keep the database and object-store bucket backed up together.

## Development / self-hosted local disk

Local disk is the development default. For a self-hosted production server, explicitly configure:

- `STORAGE_PROVIDER=local`
- `STORAGE_LOCAL_DIR=/absolute/path/to/persistent/media`
- `ALLOW_LOCAL_STORAGE=true` (required in production)

The directory must be on durable storage, included in backups, writable by the service account, and shared by every application instance. Do not use this provider on Vercel or another ephemeral/serverless filesystem.

## S3-compatible object storage (Vercel and self-hosted)

Configure all of these server-side environment variables:

- `STORAGE_PROVIDER=s3`
- `STORAGE_S3_ENDPOINT=https://<provider-s3-api-endpoint>` (API endpoint, not the public CDN URL)
- `STORAGE_S3_BUCKET=<bucket-name>`
- `STORAGE_S3_REGION=<region>` (use the region required by the provider; Cloudflare R2 commonly uses `auto`)
- `STORAGE_S3_ACCESS_KEY_ID=<access-key-id>`
- `STORAGE_S3_SECRET_ACCESS_KEY=<secret-access-key>`
- Optional: `STORAGE_S3_PREFIX=shahoo-media`

For Neon Object Storage, the adapter also accepts the standard variables `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. Keep `STORAGE_S3_BUCKET` explicit; the endpoint and four credential values do not select a bucket by themselves.

The adapter uses path-style requests and AWS Signature Version 4 for PUT, GET and DELETE. The bucket must be private to the application credentials; public product images are served through the app's media route, which resolves only live database asset records and never exposes S3 credentials to the browser. A separately configured public CDN is an alternative. Do not place credentials in client variables or commit them to Git.

For Vercel, set the variables in the Preview environment first and redeploy the Preview before enabling uploads. Use a separate bucket/access key for Production only after owner approval and a successful Preview upload/read/delete smoke test. The Neon Staging bucket is provisioned, but the S3 credential has not been injected into Vercel Preview; no live object round-trip has been claimed.

## Operational notes

- Uploads remain capped and sanitized by the existing server-side image pipeline.
- Database insert failure triggers object cleanup.
- A database backup without the matching object bucket backup is not a complete media backup.
- The adapter does not create buckets, manage CORS, lifecycle rules, CDN domains, or credentials. Provision these with the storage provider.
