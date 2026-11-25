[CmdletBinding()]
param(
    [string]$BackupDir = "C:\shahoo-backups\database",
    [int]$RetentionDays = 30,
    [string]$EnvFile = ".env"
)
$ErrorActionPreference = "Stop"
if ($RetentionDays -lt 1) { throw "RetentionDays must be at least 1." }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogFile = Join-Path $LogDir "backup.log"

function Write-Log([string]$Message, [string]$Level = "INFO") {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}
function Read-EnvFile([string]$Path) {
    $values = @{}
    if (Test-Path $Path) {
        foreach ($raw in Get-Content $Path) {
            $line = $raw.Trim()
            if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }
    return $values
}
function Resolve-DbConfig($Values) {
    $config = @{
        User = ($Values["POSTGRES_USER"] ?? "shahoo_app")
        Name = ($Values["POSTGRES_DB"] ?? "shahoo_db")
        Host = "127.0.0.1"
        Port = "5432"
        Password = ($Values["POSTGRES_PASSWORD"] ?? "")
    }
    $raw = $Values["RESTORE_DATABASE_URL"]
    if (-not $raw) { $raw = $Values["DATABASE_URL"] }
    if ($raw) {
        $uri = [Uri]$raw
        $userInfo = $uri.UserInfo.Split(":", 2)
        $config.User = [Uri]::UnescapeDataString($userInfo[0])
        if ($userInfo.Count -gt 1) { $config.Password = [Uri]::UnescapeDataString($userInfo[1]) }
        $config.Host = $uri.Host
        if ($uri.Port -gt 0) { $config.Port = [string]$uri.Port }
        $config.Name = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
    }
    return $config
}

$PgDump = (Get-Command pg_dump.exe -ErrorAction SilentlyContinue).Source
$PgRestore = (Get-Command pg_restore.exe -ErrorAction SilentlyContinue).Source
if (-not $PgDump) { $candidate = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"; if (Test-Path $candidate) { $PgDump = $candidate } }
if (-not $PgRestore) { $candidate = "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"; if (Test-Path $candidate) { $PgRestore = $candidate } }
if (-not $PgDump -or -not $PgRestore) { throw "pg_dump.exe and pg_restore.exe for PostgreSQL 16 must be installed or added to PATH." }

$envValues = Read-EnvFile (Join-Path $ProjectRoot $EnvFile)
$db = Resolve-DbConfig $envValues
if (-not $db.Password) { throw "Database password is missing from the configured environment." }

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $BackupDir "shahoo_backup_$stamp.dump"
$temp = "$backup.tmp"
$env:PGPASSWORD = $db.Password
try {
    Write-Log "Starting PostgreSQL backup for database '$($db.Name)' at $($db.Host):$($db.Port)."
    & $PgDump -h $db.Host -p $db.Port -U $db.User -d $db.Name -Fc -Z 6 -f $temp
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
    $info = Get-Item $temp
    if ($info.Length -lt 5000) { throw "Backup file is unexpectedly small ($($info.Length) bytes)." }
    & $PgRestore --list $temp | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_restore validation failed with exit code $LASTEXITCODE." }
    Move-Item -Path $temp -Destination $backup -Force
    Write-Log "Verified backup created: $backup ($([Math]::Round((Get-Item $backup).Length / 1MB, 2)) MB)" "SUCCESS"
}
catch {
    if (Test-Path $temp) { Remove-Item $temp -Force }
    Write-Log "Backup failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Get-ChildItem -Path $BackupDir -Filter "shahoo_backup_*.dump" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays)
} | ForEach-Object {
    Write-Log "Removing expired backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}
