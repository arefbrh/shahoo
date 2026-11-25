[CmdletBinding()]
param(
    [string]$EnvFile = ".env",
    [switch]$Force
)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$EnvPath = Join-Path $ProjectRoot $EnvFile
if (-not (Test-Path $EnvPath)) { throw "Configure .env before bootstrapping PostgreSQL roles." }

$values = @{}
foreach ($raw in Get-Content $EnvPath) {
    $line = $raw.Trim()
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
}
if (-not $values["APP_DB_USER"] -or -not $values["APP_DB_PASSWORD"]) {
    throw "APP_DB_USER and APP_DB_PASSWORD are required."
}
if (-not $values["RESTORE_DATABASE_URL"]) {
    throw "RESTORE_DATABASE_URL must point to a PostgreSQL administrator role."
}

$uri = [Uri]$values["RESTORE_DATABASE_URL"]
$userInfo = $uri.UserInfo.Split(":", 2)
$adminUser = [Uri]::UnescapeDataString($userInfo[0])
$adminPassword = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
$dbName = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
$port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
if ($adminUser -eq $values["APP_DB_USER"]) { throw "APP_DB_USER must be different from the administrative database role." }
$psql = (Get-Command psql.exe -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $candidate = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
    if (Test-Path $candidate) { $psql = $candidate }
}
if (-not $psql) { throw "psql.exe for PostgreSQL 16 must be installed or added to PATH." }
if (-not $adminPassword) { throw "Administrator password is missing from RESTORE_DATABASE_URL." }

Write-Host "This creates/updates the non-superuser application role and changes database/schema ownership for '$dbName'." -ForegroundColor Yellow
if (-not $Force) {
    $confirm = Read-Host "Type BOOTSTRAP to continue"
    if ($confirm -cne "BOOTSTRAP") { Write-Host "Bootstrap cancelled."; exit 0 }
}

$env:PGPASSWORD = $adminPassword
$env:APP_DB_USER = $values["APP_DB_USER"]
$env:APP_DB_PASSWORD = $values["APP_DB_PASSWORD"]
try {
    & $psql -h $uri.Host -p $port -U $adminUser -d $dbName -v ON_ERROR_STOP=1 -f (Join-Path $ProjectRoot "scripts\init-db.sql")
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL role bootstrap failed with exit code $LASTEXITCODE." }
    Write-Host "Application role bootstrap completed. Verify grants before running migrations." -ForegroundColor Green
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:APP_DB_USER -ErrorAction SilentlyContinue
    Remove-Item Env:APP_DB_PASSWORD -ErrorAction SilentlyContinue
}
