[CmdletBinding()]
param(
    [string]$EnvFile = ".env",
    [int]$Port = 3000,
    [string]$HostAddress = "0.0.0.0"
)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
Set-Location $ProjectRoot

$EnvPath = Join-Path $ProjectRoot $EnvFile
if (-not (Test-Path $EnvPath)) {
    Copy-Item (Join-Path $ProjectRoot ".env.production.example") $EnvPath
    Write-Error "Created .env from the template. Configure DATABASE_URL and secrets, then run this script again."
}
foreach ($raw in Get-Content $EnvPath) {
    $line = $raw.Trim()
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim().Trim('"').Trim("'"), "Process")
    }
}
if (-not $env:DATABASE_URL -or $env:DATABASE_URL -like "*replace_with_*") {
    throw "DATABASE_URL must point to the intended PostgreSQL database before starting SHAHOO."
}

$env:NODE_ENV = "production"
$env:PORT = [string]$Port
$env:HOST = $HostAddress
$env:TZ = "Asia/Tehran"

$ServerEntry = Join-Path $ProjectRoot ".output\server\index.mjs"
if (-not (Test-Path $ServerEntry)) {
    npm run build:windows
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $ServerEntry)) {
        throw "Standalone Node server build failed."
    }
}
node $ServerEntry
