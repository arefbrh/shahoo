[CmdletBinding()]
param(
    [string]$BackupDir = "C:\shahoo-backups\media",
    [string]$EnvFile = ".env",
    [int]$RetentionDays = 30
)
$ErrorActionPreference = "Stop"
if ($RetentionDays -lt 1) { throw "RetentionDays must be at least 1." }

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
if (-not (Test-Path $mediaPath)) { throw "Media directory not found: $mediaPath" }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archive = Join-Path $BackupDir "shahoo_media_$stamp.zip"
$temp = Join-Path $BackupDir ("media-" + [guid]::NewGuid() + ".zip")
try {
    $mediaFiles = @(Get-ChildItem -Path $mediaPath -Force)
    if ($mediaFiles.Count -gt 0) {
        Compress-Archive -Path (Join-Path $mediaPath "*") -DestinationPath $temp -CompressionLevel Optimal
    } else {
        $emptyZip = [System.IO.Compression.ZipFile]::Open($temp, [System.IO.Compression.ZipArchiveMode]::Create)
        $emptyZip.Dispose()
    }
    $check = Get-Item $temp
    if ($mediaFiles.Count -gt 0 -and $check.Length -lt 100) { throw "Media archive is unexpectedly small." }
    $zip = [System.IO.Compression.ZipFile]::OpenRead($temp)
    try { if ($mediaFiles.Count -gt 0 -and $zip.Entries.Count -eq 0) { throw "Media archive contains no files." } }
    finally { $zip.Dispose() }
    Move-Item -Path $temp -Destination $archive -Force
    Write-Host "Verified media archive created: $archive"
}
catch {
    if (Test-Path $temp) { Remove-Item $temp -Force }
    throw
}

Get-ChildItem -Path $BackupDir -Filter "shahoo_media_*.zip" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays)
} | ForEach-Object { Remove-Item $_.FullName -Force }
