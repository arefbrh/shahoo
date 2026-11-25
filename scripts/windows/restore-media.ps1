[CmdletBinding()]
param(
    [string]$ArchiveFile,
    [string]$BackupDir = "C:\shahoo-backups\media",
    [string]$EnvFile = ".env",
    [switch]$Force
)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$envPath = Join-Path $ProjectRoot $EnvFile
$mediaPath = Join-Path $ProjectRoot "storage\media"

if ($env:STORAGE_PROVIDER -eq "s3") {
    throw "Local media operation is disabled for STORAGE_PROVIDER=s3; use object-storage backup/restore."
}
if (Test-Path $envPath) {
    foreach ($raw in Get-Content $envPath) {
        $line = $raw.Trim()
        if ($line -match '^STORAGE_PROVIDER\s*=\s*[\"\'']?s3[\"\'']?\s*$') {
            throw "Local media operation is disabled for STORAGE_PROVIDER=s3 in the env file."
        }
        if ($line -match '^STORAGE_LOCAL_DIR=(.*)$') {
            $candidate = $matches[1].Trim().Trim('"').Trim("'")
            if ($candidate) { $mediaPath = $candidate }
        }
    }
}
if (-not $ArchiveFile) {
    $latest = Get-ChildItem -Path $BackupDir -Filter "shahoo_media_*.zip" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) { $ArchiveFile = $latest.FullName }
}
if (-not $ArchiveFile -or -not (Test-Path $ArchiveFile)) { throw "A valid media archive is required." }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ArchiveFile))
$hasEntries = $false
try {
    $hasEntries = $zip.Entries.Count -gt 0
    foreach ($entry in $zip.Entries) {
        $name = $entry.FullName.Replace("\", "/")
        $unixMode = ($entry.ExternalAttributes -shr 16) -band 0xFFFF
        $fileType = $unixMode -band 0xF000
        if ($fileType -ne 0 -and $fileType -ne 0x8000 -and $fileType -ne 0x4000) {
            throw "Unsafe archive file type (link or special file): $($entry.FullName)"
        }
        if (($entry.ExternalAttributes -band 0x400) -ne 0) {
            throw "Unsafe archive reparse point: $($entry.FullName)"
        }
        if ($name.StartsWith("/") -or $name -match '(^|/)\.\.(/|$)' -or $name -match '^[A-Za-z]:' -or $name.Contains(":")) {
            throw "Unsafe path in media archive: $($entry.FullName)"
        }
    }
}
finally { $zip.Dispose() }

Write-Host "WARNING: files under '$mediaPath' may be overwritten." -ForegroundColor Yellow
if (-not $Force) {
    $confirm = Read-Host "Type RESTORE to continue"
    if ($confirm -cne "RESTORE") { Write-Host "Restore cancelled."; exit 0 }
}

$service = Get-Service -Name "ShahooStore" -ErrorAction SilentlyContinue
$serviceWasRunning = $service -and $service.Status -eq "Running"
if ($serviceWasRunning) { Stop-Service -Name "ShahooStore" -Force }
if (Test-Path $mediaPath) {
    $previous = "$mediaPath.pre-restore-$([guid]::NewGuid())"
    Move-Item -Path $mediaPath -Destination $previous
}
New-Item -ItemType Directory -Path $mediaPath -Force | Out-Null
if ($hasEntries) { Expand-Archive -Path $ArchiveFile -DestinationPath $mediaPath -Force }
if ($serviceWasRunning) { Start-Service -Name "ShahooStore" }
Write-Host "Media restore command completed. Validate file references and permissions." -ForegroundColor Green
