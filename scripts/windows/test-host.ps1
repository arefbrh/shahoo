# Disposable GitHub-hosted Windows runner only. Uses a dedicated local database and media directory.
$ErrorActionPreference = "Stop"
if ($env:GITHUB_ACTIONS -ne "true" -or (Test-Path ".env")) { throw "A clean CI runner is required." }
$bin = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_ctl.exe" | Sort-Object FullName -Descending | Select-Object -First 1).DirectoryName
if (-not $bin) { throw "Install PostgreSQL on the runner." }
$env:Path = "$bin;$env:Path"
$root = Join-Path $env:RUNNER_TEMP ("shahoo-" + [guid]::NewGuid())
$pgdata = Join-Path $root "postgres"
$media = Join-Path $root "media"
$backup = Join-Path $root "backup"
New-Item -ItemType Directory -Path $media -Force | Out-Null
& initdb.exe -D $pgdata -U shahoo_admin -A trust -E UTF8
if ($LASTEXITCODE) { throw "initdb failed" }
& pg_ctl.exe -D $pgdata -l "$root\postgres.log" -o "-h 127.0.0.1 -p 5439" -w start
if ($LASTEXITCODE) { throw "Local PostgreSQL startup failed" }
try {
    & createdb.exe -h 127.0.0.1 -p 5439 -U shahoo_admin shahoo_ci
    if ($LASTEXITCODE) { throw "createdb failed" }
    $env:DATABASE_URL = "postgresql://shahoo_app:ci_only@127.0.0.1:5439/shahoo_ci"
    @(
        "DATABASE_URL=$env:DATABASE_URL"
        "RESTORE_DATABASE_URL=postgresql://shahoo_admin:restore_ci_only@127.0.0.1:5439/shahoo_ci"
        "APP_DB_USER=shahoo_app"
        "APP_DB_PASSWORD=ci_only"
        "STORAGE_PROVIDER=local"
        "STORAGE_LOCAL_DIR=$media"
        "ALLOW_LOCAL_STORAGE=true"
        "APP_URL=https://localhost"
        "APP_DOMAIN=localhost"
    ) | Set-Content -Encoding ascii .env
    . "$PSScriptRoot\runtime-env.ps1"
    $config = Read-ShahooRuntimeEnv ".env"
    if ($config.ContainsKey("RESTORE_DATABASE_URL") -or $config.ContainsKey("APP_DB_PASSWORD") -or !$config.DATABASE_URL) { throw "Invalid runtime secret scope" }
    & "$PSScriptRoot\bootstrap-db.ps1" -Force
    $env:NODE_ENV = "test"
    & node scripts/migrate.mjs
    if ($LASTEXITCODE) { throw "Migration failed" }
    & "$PSScriptRoot\install-service.ps1"
    & "$PSScriptRoot\setup-server.ps1" -ConfigureFirewall:$false
    # The hosted image includes IIS. Reserve HTTP/S for the proxy under test.
    if (Get-Service W3SVC -ErrorAction SilentlyContinue) { Stop-Service W3SVC -Force }
    & "$PSScriptRoot\install-caddy-service.ps1" -ServiceName "ShahooCaddy"
    function Assert-Ready {
        foreach ($try in 1..30) {
            $body = curl.exe --noproxy "*" -kfs --max-time 5 "https://localhost/api/health?type=ready"
            if ($LASTEXITCODE -eq 0 -and ($body | ConvertFrom-Json).db -eq "connected") { return }
            Start-Sleep -Seconds 1
        }
        throw "Store failed its HTTPS readiness check"
    }
    Assert-Ready
    Restart-Service ShahooStore
    Assert-Ready
    & "$PSScriptRoot\release-expired-holds.ps1"
    if ($LASTEXITCODE) { throw "Worker failed" }
    & "$PSScriptRoot\backup-media.ps1" -BackupDir $backup
    $empty = Get-ChildItem "$backup\*.zip" | Select-Object -First 1
    Set-Content -Encoding ascii "$media\sample.txt" "original"
    $expected = (Get-FileHash "$media\sample.txt").Hash
    & "$PSScriptRoot\backup-media.ps1" -BackupDir "$backup\full"
    Set-Content "$media\sample.txt" "changed"
    & "$PSScriptRoot\restore-media.ps1" -ArchiveFile (Get-ChildItem "$backup\full\*.zip").FullName -Force
    if ((Get-FileHash "$media\sample.txt").Hash -ne $expected) { throw "Media bytes differ" }
    & "$PSScriptRoot\backup-db.ps1" -BackupDir $backup
    & "$PSScriptRoot\restore-db.ps1" -BackupDir $backup -Force
    Assert-Ready
    $count = & psql.exe $env:DATABASE_URL -Atc "SELECT COUNT(*) FROM _migrations"
    if ($LASTEXITCODE -or [int]$count -ne @(Get-ChildItem migrations\*.sql).Count) { throw "Restored migration history differs" }
    & "$PSScriptRoot\restore-media.ps1" -ArchiveFile $empty.FullName -Force
    if (@(Get-ChildItem $media).Count) { throw "Empty archive restore failed" }
} catch {
    if (Test-Path "logs/caddy-service-stderr.log") { Get-Content "logs/caddy-service-stderr.log" -Tail 8 }
    throw
} finally {
    & pg_ctl.exe -D $pgdata -m fast -w stop
    Remove-Item .env -ErrorAction SilentlyContinue
}
