$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")
. (Join-Path $PSScriptRoot "runtime-env.ps1")
$config = Read-ShahooRuntimeEnv (Join-Path (Get-Location) ".env")
if (-not $config.DATABASE_URL) { throw "Configure DATABASE_URL before starting the worker." }
$env:DATABASE_URL = $config.DATABASE_URL
$env:NODE_ENV = "production"
& node.exe --experimental-transform-types --import ./scripts/ts-alias-register.mjs scripts/release-expired-holds.mjs
exit $LASTEXITCODE
