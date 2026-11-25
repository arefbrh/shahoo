[CmdletBinding()]
param(
    [string]$ServiceName = "Caddy",
    [string]$NssmPath = "nssm.exe",
    [string]$CaddyPath = "caddy.exe",
    [string]$EnvFile = ".env",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this script from an elevated PowerShell session." }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$EnvPath = Join-Path $ProjectRoot $EnvFile
$ConfigPath = Join-Path $ProjectRoot "Caddyfile.windows"
$LogsPath = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $EnvPath)) { throw "Configure $EnvFile before installing Caddy." }
if (-not (Test-Path $ConfigPath)) { throw "Caddyfile.windows is missing." }

if ($CaddyPath -eq "caddy.exe") {
    $found = (Get-Command caddy.exe -ErrorAction SilentlyContinue).Source
    if ($found) { $CaddyPath = $found }
}
if (-not (Test-Path $CaddyPath) -and -not (Get-Command $CaddyPath -ErrorAction SilentlyContinue)) {
    throw "Caddy for Windows was not found. Install it separately and pass -CaddyPath."
}
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
$domain = [string]$envMap["APP_DOMAIN"]
if (-not $domain -or $domain -notmatch '^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$') {
    throw "APP_DOMAIN must be a hostname without scheme, port, path or wildcard."
}

New-Item -ItemType Directory -Path $LogsPath -Force | Out-Null
$env:APP_DOMAIN = $domain
& $CaddyPath validate --config $ConfigPath --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw "Caddy configuration validation failed." }

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
    throw "Service '$ServiceName' already exists. Review it and rerun with -Force to replace its configuration."
}

function Invoke-Nssm([string[]]$Arguments) {
    & $NssmPath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "NSSM command failed: $($Arguments -join ' ')" }
}

if ($existing -and $existing.Status -eq "Running") {
    Stop-Service -Name $ServiceName -Force
    $existing.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
}
if (-not $existing) {
    Invoke-Nssm @("install", $ServiceName, $CaddyPath)
}
Invoke-Nssm @("set", $ServiceName, "AppDirectory", $ProjectRoot)
Invoke-Nssm @("set", $ServiceName, "AppParameters", "run --config `"$ConfigPath`" --adapter caddyfile")
Invoke-Nssm @("set", $ServiceName, "DisplayName", "Caddy HTTPS Reverse Proxy")
Invoke-Nssm @("set", $ServiceName, "Description", "SHAHOO Caddy reverse proxy and automatic HTTPS")
Invoke-Nssm @("set", $ServiceName, "Start", "SERVICE_AUTO_START")
Invoke-Nssm @("set", $ServiceName, "AppExit", "Default", "Restart")
Invoke-Nssm @("set", $ServiceName, "AppRestartDelay", "5000")
Invoke-Nssm @("set", $ServiceName, "AppStdout", (Join-Path $LogsPath "caddy-service-stdout.log"))
Invoke-Nssm @("set", $ServiceName, "AppStderr", (Join-Path $LogsPath "caddy-service-stderr.log"))
Invoke-Nssm @("set", $ServiceName, "AppRotateFiles", "1")
Invoke-Nssm @("set", $ServiceName, "AppRotateOnline", "1")
Invoke-Nssm @("set", $ServiceName, "AppRotateBytes", "10485760")
Invoke-Nssm @("set", $ServiceName, "AppEnvironmentExtra", "APP_DOMAIN=$domain")
Invoke-Nssm @("start", $ServiceName)
$service = Get-Service -Name $ServiceName
$service.WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
if ($service.Status -ne "Running") { throw "Caddy service did not reach Running state." }
Write-Host "Caddy service '$ServiceName' is running for $domain. Verify DNS, firewall, HTTPS issuance and renewal."
