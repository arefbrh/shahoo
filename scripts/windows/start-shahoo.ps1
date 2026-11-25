[CmdletBinding()]
param(
    [string]$EnvFile = ".env",
    [int]$Port = 3000,
    [string]$HostAddress = "127.0.0.1"
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
. (Join-Path $ScriptDir "runtime-env.ps1")
$envMap = Read-ShahooRuntimeEnv $EnvPath
foreach ($name in $envMap.Keys) {
    [Environment]::SetEnvironmentVariable($name, $envMap[$name], "Process")
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
