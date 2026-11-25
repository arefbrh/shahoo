# Neon Object Storage configuration for SHAHOO

## Staging branch currently provisioned

- Project: `shahoo-staging` (`morning-voice-81212343`)
- Branch: `staging` (`br-young-heart-b96c797x`)
- Endpoint: `https://br-young-heart-b96c797x.storage.c-7.eu-central-1.aws.neon.tech`
- Region: `eu-central-1`
- Bucket: `shahoo-media`
- Access: `private`

The bucket is private because the application serves images through `/media/file/:assetId`, where the server reads the object using its scoped credential and returns the image. The browser does not receive S3 credentials.

## Environment variables

Set `STORAGE_PROVIDER=s3` and `STORAGE_S3_BUCKET=shahoo-media`. The adapter accepts either the canonical SHAHOO names or Neon's AWS-standard names:

| Purpose | SHAHOO variable | Neon/AWS-standard alternative |
|---|---|---|
| Endpoint | `STORAGE_S3_ENDPOINT` | `AWS_ENDPOINT_URL_S3` |
| Region | `STORAGE_S3_REGION` | `AWS_REGION` |
| Access key ID | `STORAGE_S3_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` |
| Secret key | `STORAGE_S3_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` |
| Bucket | `STORAGE_S3_BUCKET` | `S3_BUCKET` |

Neon does not provide a bucket name as part of its standard four S3 connection variables; set `STORAGE_S3_BUCKET` explicitly.

Use a credential scoped to the intended branch with `storage:read` and `storage:write`. Do not use an AI Gateway credential. Keep the secret in Vercel's encrypted Preview environment variables or the self-hosted server's secret store. Never commit the values to Git or an `.env` example.

## Production boundary

Production Storage is enabled in Neon but no Production bucket or new credential was created. Do not point the Production app at the Staging endpoint. Provision a separate Production bucket and branch-scoped credential only during the approved Production configuration/cutover.

## Verification boundary

The Staging bucket's existence and private access mode were verified through Neon. An actual application-level object upload/read/delete test remains outstanding because the S3 credential secret was not retrieved or configured in the Vercel Preview environment.
