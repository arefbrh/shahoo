[CmdletBinding()]
param(
    [string]$AppUrl = "http://127.0.0.1:3000/api/health?type=ready",
    [int]$MinDiskFreePercent = 15,
    [string]$TelegramBotToken = "",
    [string]$TelegramChatId = "",
    [string]$BaleWebhookUrl = "",
    [string]$EnvFile = ".env"
)
$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogFile = Join-Path $LogDir "health-monitor.log"

function Log-Health([string]$Message, [string]$Status = "OK") {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Status] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}
$envValues = @{}
$envPath = Join-Path $ProjectRoot $EnvFile
if (Test-Path $envPath) {
    foreach ($raw in Get-Content $envPath) {
        $line = $raw.Trim()
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $envValues[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
}
if (-not $TelegramBotToken) { $TelegramBotToken = $envValues["TELEGRAM_BOT_TOKEN"] }
if (-not $TelegramChatId) { $TelegramChatId = $envValues["TELEGRAM_CHAT_ID"] }
if (-not $BaleWebhookUrl) { $BaleWebhookUrl = $envValues["BALE_WEBHOOK_URL"] }

function Send-AlertNotification([string]$AlertMessage) {
    Log-Health $AlertMessage "ALERT"
    if ($TelegramBotToken -and $TelegramChatId) {
        try {
            $tgUrl = "https://api.telegram.org/bot$TelegramBotToken/sendMessage"
            $body = @{ chat_id = $TelegramChatId; text = "SHAHOO health alert`n$AlertMessage" } | ConvertTo-Json
            Invoke-RestMethod -Uri $tgUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 10 | Out-Null
        } catch { Log-Health "Telegram alert delivery failed." "WARN" }
    }
    if ($BaleWebhookUrl) {
        try {
            $body = @{ text = "SHAHOO health alert`n$AlertMessage" } | ConvertTo-Json
            Invoke-RestMethod -Uri $BaleWebhookUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 10 | Out-Null
        } catch { Log-Health "Bale alert delivery failed." "WARN" }
    }
}

$issues = @()
Log-Health "Starting Windows host health checks."

try {
    $response = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 8 -Method Get
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
        $issues += "Application readiness returned HTTP $($response.StatusCode)."
    } else {
        Log-Health "Application readiness endpoint responded with HTTP $($response.StatusCode)."
    }
} catch {
    $issues += "Application readiness endpoint is unavailable."
}

$service = Get-Service -Name "ShahooStore" -ErrorAction SilentlyContinue
if ($service -and $service.Status -ne "Running") {
    $issues += "ShahooStore Windows service is not running ($($service.Status))."
} elseif ($service) {
    Log-Health "ShahooStore service is running."
}

$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService -and $pgService.Status -ne "Running") {
    $issues += "PostgreSQL service is not running ($($pgService.Status))."
} elseif ($pgService) {
    Log-Health "PostgreSQL service is running."
}

$drive = Get-PSDrive -Name C -ErrorAction SilentlyContinue
if ($drive -and ($drive.Used + $drive.Free) -gt 0) {
    $freePercent = [Math]::Round(($drive.Free / ($drive.Used + $drive.Free)) * 100, 1)
    if ($freePercent -lt $MinDiskFreePercent) {
        $issues += "Disk C free space is low: $freePercent%."
    } else {
        Log-Health "Disk C free space: $freePercent%."
    }
}

$dbBackupDir = "C:\shahoo-backups\database"
$mediaBackupDir = "C:\shahoo-backups\media"
$dbBackup = Get-ChildItem -Path $dbBackupDir -Filter "shahoo_backup_*.dump" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-26) } | Select-Object -First 1
$mediaBackup = Get-ChildItem -Path $mediaBackupDir -Filter "shahoo_media_*.zip" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-26) } | Select-Object -First 1
if (-not $dbBackup) { $issues += "No verified database backup newer than 26 hours." }
if (-not $mediaBackup) { $issues += "No media backup newer than 26 hours." }

$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
if ($os -and $os.TotalVisibleMemorySize -gt 0) {
    $usedPercent = [Math]::Round((1 - ($os.FreePhysicalMemory / $os.TotalVisibleMemorySize)) * 100, 1)
    if ($usedPercent -gt 92) { $issues += "RAM use is high: $usedPercent%." }
    else { Log-Health "RAM use: $usedPercent%." }
}

if ($issues.Count -gt 0) {
    Send-AlertNotification ($issues -join "`n")
    exit 1
}
Log-Health "All configured Windows host checks passed." "SUCCESS"
exit 0
