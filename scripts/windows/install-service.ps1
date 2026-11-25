[CmdletBinding()]
param(
    [string]$ServiceName = "ShahooStore",
    [string]$DisplayName = "SHAHOO eCommerce Store Service",
    [int]$Port = 3000,
    [string]$NssmPath = "nssm.exe",
    [string]$EnvFile = ".env"
)
$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this script from an elevated PowerShell session." }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$EnvPath = Join-Path $ProjectRoot $EnvFile
if (-not (Test-Path $EnvPath)) { throw "Configure $EnvFile before installing the Windows service." }

if ($NssmPath -eq "nssm.exe") {
    $found = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
    if ($found) { $NssmPath = $found }
    else {
        $local = Join-Path $ProjectRoot "tools\nssm.exe"
        if (Test-Path $local) { $NssmPath = $local }
    }
}
if (-not (Test-Path $NssmPath) -and -not (Get-Command $NssmPath -ErrorAction SilentlyContinue)) {
    throw "NSSM is not installed. Install and verify NSSM separately, then rerun with -NssmPath."
}

$envMap = @{}
foreach ($raw in Get-Content $EnvPath) {
    $line = $raw.Trim()
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $envMap[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
}
if (-not $envMap["DATABASE_URL"] -or $envMap["DATABASE_URL"] -like "*replace_with_*") {
    throw "DATABASE_URL must be configured before registering the service."
}
$envMap["NODE_ENV"] = "production"
$envMap["PORT"] = [string]$Port
$envMap["HOST"] = "0.0.0.0"
$envMap["TZ"] = "Asia/Tehran"

$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { throw "node.exe was not found in PATH." }
$serverMjs = Join-Path $ProjectRoot ".output\server\index.mjs"
if (-not (Test-Path $serverMjs)) {
    npm run build:windows
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $serverMjs)) { throw "Standalone Node server build failed." }
}
$logs = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null

function Invoke-Nssm([string[]]$Arguments) {
    & $NssmPath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "NSSM command failed: $($Arguments -join ' ')" }
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existing) {
    Invoke-Nssm @("install", $ServiceName, $nodeExe, "`"$serverMjs`"")
}
Invoke-Nssm @("set", $ServiceName, "AppDirectory", $ProjectRoot)
Invoke-Nssm @("set", $ServiceName, "DisplayName", $DisplayName)
Invoke-Nssm @("set", $ServiceName, "Description", "SHAHOO self-hosted storefront")
Invoke-Nssm @("set", $ServiceName, "Start", "SERVICE_AUTO_START")
Invoke-Nssm @("set", $ServiceName, "AppExit", "Default", "Restart")
Invoke-Nssm @("set", $ServiceName, "AppRestartDelay", "5000")
Invoke-Nssm @("set", $ServiceName, "AppStdout", (Join-Path $logs "service-stdout.log"))
Invoke-Nssm @("set", $ServiceName, "AppStderr", (Join-Path $logs "service-stderr.log"))
Invoke-Nssm @("set", $ServiceName, "AppRotateFiles", "1")
Invoke-Nssm @("set", $ServiceName, "AppRotateOnline", "1")
Invoke-Nssm @("set", $ServiceName, "AppRotateBytes", "10485760")
$envArgs = @($envMap.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" })
Invoke-Nssm (@("set", $ServiceName, "AppEnvironmentExtra") + $envArgs)

if ($existing -and $existing.Status -eq "Running") {
    Stop-Service -Name $ServiceName -Force
}
Invoke-Nssm @("start", $ServiceName)
Write-Host "Service '$ServiceName' registered and started. Protect the service configuration and .env with restrictive ACLs."
