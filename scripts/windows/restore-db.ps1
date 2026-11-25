[CmdletBinding()]
param(
    [string]$DumpFile,
    [string]$BackupDir = "C:\shahoo-backups\database",
    [string]$EnvFile = ".env",
    [switch]$Force
)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

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
function Resolve-DbConfig($Values, [bool]$UseAdmin = $false) {
    $config = @{
        User = $(if ($Values["POSTGRES_USER"]) { $Values["POSTGRES_USER"] } else { "shahoo_app" })
        Name = $(if ($Values["POSTGRES_DB"]) { $Values["POSTGRES_DB"] } else { "shahoo_db" })
        Host = "127.0.0.1"
        Port = "5432"
        Password = [string]$Values["POSTGRES_PASSWORD"]
    }
    $raw = if ($UseAdmin) { $Values["RESTORE_DATABASE_URL"] } else { $Values["DATABASE_URL"] }
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

$PgRestore = (Get-Command pg_restore.exe -ErrorAction SilentlyContinue).Source
if (-not $PgRestore) { $candidate = "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"; if (Test-Path $candidate) { $PgRestore = $candidate } }
if (-not $PgRestore) { throw "pg_restore.exe for PostgreSQL 16 must be installed or added to PATH." }

if (-not $DumpFile) {
    $latest = Get-ChildItem -Path $BackupDir -Filter "shahoo_backup_*.dump" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) { $DumpFile = $latest.FullName }
}
if (-not $DumpFile -or -not (Test-Path $DumpFile)) { throw "A valid backup file is required." }

$dumpList = & $PgRestore --list $DumpFile
if ($LASTEXITCODE -ne 0) { throw "The selected backup failed pg_restore validation." }
# The administrator recreates these extensions, so their archive entries cannot be restored by the application role.
$restoreList = $dumpList | Where-Object { $_ -notmatch '^\d+;\s+\d+\s+\d+\s+(EXTENSION -|COMMENT - EXTENSION)\s+"?(pgcrypto|uuid-ossp)"?(\s|$)' }

$envValues = Read-EnvFile (Join-Path $ProjectRoot $EnvFile)
$adminDb = Resolve-DbConfig $envValues $true
$appDb = Resolve-DbConfig $envValues $false
if (-not $envValues["RESTORE_DATABASE_URL"] -or -not $envValues["DATABASE_URL"]) {
    throw "Both RESTORE_DATABASE_URL and DATABASE_URL must be explicitly configured."
}
if (-not $adminDb.Password -or -not $appDb.Password) { throw "Both administrator and application database credentials are required." }
if ($adminDb.Host -ne $appDb.Host -or $adminDb.Port -ne $appDb.Port -or $adminDb.Name -ne $appDb.Name) {
    throw "RESTORE_DATABASE_URL and DATABASE_URL must target the same database host, port and name."
}

Write-Host "WARNING: this operation recreates database '$($adminDb.Name)' on $($adminDb.Host):$($adminDb.Port)." -ForegroundColor Yellow
if (-not $Force) {
    $confirm = Read-Host "Type RESTORE to continue"
    if ($confirm -cne "RESTORE") { Write-Host "Restore cancelled."; exit 0 }
}

$DropDb = (Get-Command dropdb.exe -ErrorAction SilentlyContinue).Source
$CreateDb = (Get-Command createdb.exe -ErrorAction SilentlyContinue).Source
$Psql = (Get-Command psql.exe -ErrorAction SilentlyContinue).Source
if (-not $DropDb) { $candidate = "C:\Program Files\PostgreSQL\16\bin\dropdb.exe"; if (Test-Path $candidate) { $DropDb = $candidate } }
if (-not $CreateDb) { $candidate = "C:\Program Files\PostgreSQL\16\bin\createdb.exe"; if (Test-Path $candidate) { $CreateDb = $candidate } }
if (-not $Psql) { $candidate = "C:\Program Files\PostgreSQL\16\bin\psql.exe"; if (Test-Path $candidate) { $Psql = $candidate } }
if (-not $DropDb -or -not $CreateDb -or -not $Psql) { throw "dropdb.exe, createdb.exe and psql.exe for PostgreSQL 16 must be installed or added to PATH." }

$restoreListFile = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllLines($restoreListFile, [string[]]$restoreList, [Text.UTF8Encoding]::new($false))
    $taskName = "SHAHOO_Release_Expired_Holds"
    $workerTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    $resumeWorker = $workerTask -and $workerTask.State -ne "Disabled"
    if ($resumeWorker) {
        Disable-ScheduledTask -TaskName $taskName | Out-Null
        Stop-ScheduledTask -TaskName $taskName
    }
    $service = Get-Service -Name "ShahooStore" -ErrorAction SilentlyContinue
    $serviceWasRunning = $service -and $service.Status -eq "Running"
    if ($serviceWasRunning) { Stop-Service -Name "ShahooStore" -Force }
    $env:PGPASSWORD = $adminDb.Password
    & $DropDb -h $adminDb.Host -p $adminDb.Port -U $adminDb.User --if-exists --force $adminDb.Name
    if ($LASTEXITCODE -ne 0) { throw "dropdb failed with exit code $LASTEXITCODE." }
    & $CreateDb -h $adminDb.Host -p $adminDb.Port -U $adminDb.User -O $appDb.User $adminDb.Name
    if ($LASTEXITCODE -ne 0) { throw "createdb failed with exit code $LASTEXITCODE." }
    $setupSql = @'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER DATABASE :"db_name" SET timezone TO 'Asia/Tehran';
ALTER ROLE :"app_role" SET timezone TO 'Asia/Tehran';
'@
    $setupSql | & $Psql -X -h $adminDb.Host -p $adminDb.Port -U $adminDb.User -d $adminDb.Name -v ON_ERROR_STOP=1 -v "db_name=$($adminDb.Name)" -v "app_role=$($appDb.User)" -f -
    if ($LASTEXITCODE -ne 0) { throw "Restored database configuration failed." }
    $env:PGPASSWORD = $appDb.Password
    & $PgRestore -h $appDb.Host -p $appDb.Port -U $appDb.User -d $appDb.Name --exit-on-error --no-owner --use-list $restoreListFile $DumpFile
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE." }
    if ($serviceWasRunning) { Start-Service -Name "ShahooStore" }
    if ($resumeWorker) { Enable-ScheduledTask -TaskName $taskName | Out-Null }
    Write-Host "Restore command completed. Run the post-restore validation checklist." -ForegroundColor Green
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $restoreListFile -ErrorAction SilentlyContinue
}
