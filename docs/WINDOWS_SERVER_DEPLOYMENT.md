
# SHAHOO — Native Windows Server Deployment Guide

**Target:** Windows Server 2022/2025 or Windows 10/11 Pro on a dedicated VPS.  
**Status:** source instructions and PowerShell scripts are provided; no Windows host was configured or tested.

## 1. Required components

- Node.js 22 LTS (x64)
- PostgreSQL 16 (local or a separately managed PostgreSQL host)
- Caddy for Windows, used as the reverse proxy and HTTPS certificate manager
- NSSM, installed and verified separately if the Node process must run as a Windows service

Do not expose PostgreSQL port 5432 to the public internet. Allow inbound 80/443 for Caddy and restrict SSH/RDP to trusted administrator addresses.

## 2. Prepare the application

Copy the complete project to a stable directory such as `C:\shahoo`. Open an elevated PowerShell window in that directory:

```powershell
Copy-Item .env.production.example .env
notepad .env
```

Set at minimum:
- `DATABASE_URL` to the intended PostgreSQL 16 database using the non-superuser application role.
- `RESTORE_DATABASE_URL` to a separate database-administrator role with the privileges needed to drop/create the database; the restore script uses this URL.
- `APP_URL` to the public HTTPS origin and `APP_DOMAIN` to the matching hostname (for example, `https://shop.example.com` and `shop.example.com`).
- `STORAGE_PROVIDER=local`, `ALLOW_LOCAL_STORAGE=true`, and a persistent writable `STORAGE_LOCAL_DIR` such as `C:\shahoo\storage\media`.
- `SHAHOO_TRUST_PROXY=1` when using the supplied Caddy reverse proxy.
- A strong PostgreSQL password in the connection string. Use a hex-generated password to avoid URL-encoding ambiguity.

PayPing and SMS.ir remain disabled. Do not enable them until the merchant account, approved SMS template, callback URL and sandbox tests are verified.

## 3. Bootstrap roles and apply database migrations

On a fresh database, first create the non-superuser application role. `RESTORE_DATABASE_URL` must point to a PostgreSQL administrator role. This operation changes database/schema ownership and requires explicit confirmation:

```powershell
powershell -File scripts\windows\bootstrap-db.ps1
```

Do not run the bootstrap against an existing database without reviewing current roles and ownership first. Then check that `DATABASE_URL` points to the intended database and a current backup exists:

```powershell
$env:NODE_ENV = "production"
$env:SHAHOO_ALLOW_PRODUCTION_MIGRATE = "1"
node scripts/migrate.mjs
if ($LASTEXITCODE -ne 0) { throw "Migration failed." }
Remove-Item Env:SHAHOO_ALLOW_PRODUCTION_MIGRATE
```

The production migration guard is intentional. Never point this command at the wrong database.

## 4. Build and run

```powershell
npm ci
npm run build:windows
if ($LASTEXITCODE -ne 0) { throw "Build failed." }
powershell -File scripts\windows\start-shahoo.ps1
```

The build script sets Nitro's `node-server` preset. The app should answer on `http://127.0.0.1:3000/api/health?type=ready`; a successful root-page response alone is not a database readiness check.

## 5. Run as a Windows service

The service installer expects NSSM to be installed separately; it no longer downloads an unverified executable. After configuring `.env` and building:

```powershell
powershell -File scripts\windows\install-service.ps1
```

The installer passes the configured `.env` values to NSSM. Restrict ACLs on the project directory, `.env`, NSSM service configuration and log directory. Verify the service account has write access to persistent media and logs.

## 6. Caddy reverse proxy and HTTPS

Use the Windows-specific Caddyfile, not the Docker Caddyfile:

`Caddyfile.windows` uses the `APP_DOMAIN` process environment variable and proxies to `127.0.0.1:3000`. Install Caddy as a persistent service (NSSM must be installed separately) using the same hostname from `.env`:

```powershell
powershell -File scripts\windows\install-caddy-service.ps1 -CaddyPath "C:\caddy\caddy.exe"
```

The script reads `APP_DOMAIN` from `.env`, validates the Caddyfile, configures automatic restart and log rotation, and refuses to replace an existing service unless `-Force` is supplied. Review an existing Caddy service before using `-Force`. The Docker `Caddyfile` instead proxies to the Compose service name `app`; it is not suitable for native Windows execution.

Before expecting certificate issuance, point both the hostname in `APP_DOMAIN` and `www.` plus that hostname to the server's public IP; allow inbound TCP 80/443. HTTPS issuance and renewal were not tested in this source-only audit.

## 7. Backup, restore and monitoring

```powershell
powershell -File scripts\windows\backup-db.ps1
powershell -File scripts\windows\monitor-health.ps1
```

The backup script validates its dump with `pg_restore --list`. Restore is destructive and requires typing `RESTORE`:

```powershell
powershell -File scripts\windows\restore-db.ps1
```

Use `-Force` only when an operator deliberately chooses to bypass the interactive confirmation. The monitor can send alerts if `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` or `BALE_WEBHOOK_URL` are configured in `.env`.

## 8. Not yet verified

- Native Windows build and service startup
- NSSM service restart and secret ACLs
- Caddy service registration, certificate issuance and renewal
- PostgreSQL migration and concurrent workload on Windows
- Backup/restore drill and media backup
- Real PayPing, SMS.ir, shipping-provider and Torob integrations

### Windows operator settings

Keep the app account limited to its database, logs and media directory. Put restore/bootstrap credentials in an administrator-only file and pass its name with `-EnvFile` to the corresponding scripts. The web service imports only runtime settings. Set the local media path to an absolute Windows directory. Run `scripts/windows/setup-server.ps1` to schedule the independent inventory worker. Its five-minute task ignores overlapping runs. A failed database restore leaves the worker disabled and the web service stopped until an operator verifies recovery.

In the content panel enter public contact details, support hours, order follow-up and telephone return instructions when known. Empty details are valid. In the offers panel set delivery methods, charges and delivery estimates (method description). Publish the shipping, terms, returns and privacy pages from the content panel. Online return submissions and online return processing are disabled. Product specifications can hold verified ingredients, allergens, origin, lot information and shelf-life details from the actual label. Use the natural-product filter only for the corresponding catalog classification.
