<#
.SYNOPSIS
    اسکریپت نصب و آماده‌سازی خودکار سرور ویندوز برای شاهو (Windows Server Setup & Automation)
.DESCRIPTION
    این اسکریپت فایروال ویندوز را تنظیم کرده و تسک‌های زمان‌بندی‌شده (Task Scheduler) برای
    بکاپ خودکار شبانه و پایش سلامت ۵ دقیقه‌ای را ثبت می‌کند.
#>

[CmdletBinding()]
param(
    [switch]$ConfigureFirewall = $true,
    [switch]$CreateScheduledTasks = $true
)

$ErrorActionPreference = "Stop"

# بررسی دسترسی ادمین
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and ($ConfigureFirewall -or $CreateScheduledTasks)) {
    throw "Run this script from an elevated PowerShell session to configure firewall rules or scheduled tasks."
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   آماده‌سازی خودکار Windows Server برای فروشگاه شاهو     " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# ۱. پیکربندی فایروال ویندوز (Windows Defender Firewall)
if ($ConfigureFirewall -and $isAdmin) {
    Write-Host "`n[1/3] تنظیم قوانین فایروال ویندوز..." -ForegroundColor Gray
    try {
        # باز کردن پورت 80 (HTTP)
        if (-not (Get-NetFirewallRule -DisplayName "SHAHOO Web HTTP (Port 80)" -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName "SHAHOO Web HTTP (Port 80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow | Out-Null
        }
        if (-not (Get-NetFirewallRule -DisplayName "SHAHOO Web HTTPS (Port 443)" -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName "SHAHOO Web HTTPS (Port 443)" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow | Out-Null
        }
        Write-Host "پورت‌های 80 و 443 در فایروال ویندوز با موفقیت مجاز شدند." -ForegroundColor Green
    } catch {
        Write-Warning "تنظیم فایروال با خطا مواجه شد: $_"
    }
}

# ۲. ایجاد تسک‌های زمان‌بندی‌شده در Windows Task Scheduler
if ($CreateScheduledTasks -and $isAdmin) {
    Write-Host "`n[2/3] ایجاد تسک‌های خودکار در Windows Task Scheduler..." -ForegroundColor Gray

    $workerScript = Join-Path $ScriptDir "release-expired-holds.ps1"
    $workerAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$workerScript`""
    $workerTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
    $workerSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -StartWhenAvailable
    Register-ScheduledTask -TaskName "SHAHOO_Release_Expired_Holds" -Action $workerAction -Trigger $workerTrigger -Settings $workerSettings -User "SYSTEM" -Force | Out-Null

    $BackupScript = Join-Path $ScriptDir "backup-db.ps1"
    $MonitorScript = Join-Path $ScriptDir "monitor-health.ps1"
    $MediaBackupScript = Join-Path $ScriptDir "backup-media.ps1"

    # تسک بکاپ شبانه ساعت ۰۳:۰۰ بامداد
    $backupAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupScript`""
    $backupTrigger = New-ScheduledTaskTrigger -Daily -At "03:00AM"
    Register-ScheduledTask -TaskName "SHAHOO_Daily_Database_Backup" -Action $backupAction -Trigger $backupTrigger -Description "بکاپ‌گیری خودکار شبانه دیتابیس شاهو" -User "SYSTEM" -Force | Out-Null
    Write-Host "تسک زمان‌بندی‌شده بکاپ دیتابیس (SHAHOO_Daily_Database_Backup) ثبت شد." -ForegroundColor Green

    # تسک بکاپ رسانه ساعت ۰۴:۰۰ بامداد
    $mediaAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$MediaBackupScript`""
    $mediaTrigger = New-ScheduledTaskTrigger -Daily -At "04:00AM"
    Register-ScheduledTask -TaskName "SHAHOO_Daily_Media_Backup" -Action $mediaAction -Trigger $mediaTrigger -Description "بکاپ‌گیری روزانه فایل‌های رسانه شاهو" -User "SYSTEM" -Force | Out-Null
    Write-Host "تسک بکاپ رسانه (SHAHOO_Daily_Media_Backup) ثبت شد." -ForegroundColor Green

    # تسک مانیتورینگ سلامت هر ۵ دقیقه
    $monitorAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$MonitorScript`""
    $monitorTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
    Register-ScheduledTask -TaskName "SHAHOO_Health_Monitor_5min" -Action $monitorAction -Trigger $monitorTrigger -Description "پایش پیوسته سلامت سایت و منابع سرور ویندوز" -User "SYSTEM" -Force | Out-Null
    Write-Host "تسک زمان‌بندی‌شده پایش سلامت ۵ دقیقه‌ای (SHAHOO_Health_Monitor_5min) با موفقیت ثبت شد." -ForegroundColor Green
}

# ۳. خلاصه راهنما برای اپراتور
Write-Host "`n[3/3] پیکربندی پایه تکمیل شد!" -ForegroundColor Green
Write-Host "دستورات کاربردی ویندوز:" -ForegroundColor Cyan
Write-Host "• اجرای دستی سرور شاهو: powershell -File scripts\windows\start-shahoo.ps1" -ForegroundColor Yellow
Write-Host "• اجرای دستی بکاپ دیتابیس: powershell -File scripts\windows\backup-db.ps1" -ForegroundColor Yellow
Write-Host "• بررسی لحظه‌ای سلامت سرور: powershell -File scripts\windows\monitor-health.ps1" -ForegroundColor Yellow
