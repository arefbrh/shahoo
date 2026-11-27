# Run this from the cloned SHAHOO repository in Windows PowerShell.
# It imports only into the dedicated Neon integration branch. It never reads DATABASE_URL.

$ErrorActionPreference = "Stop"

$ExpectedBranch = "oil-encyclopedia-v32-integration"
$ExpectedHost = "ep-jolly-tree-b97logta.c-7.eu-central-1.aws.neon.tech"
$ExpectedDatabase = "shahoo"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js is required. Install the project-supported Node.js version first."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail "npm is required."
}

$SourceInput = Read-Host "Enter the extracted SHAHOO_Oil_Encyclopedia_v3.2 folder (must contain data, sql and validation)"
try {
    $SourceRoot = (Resolve-Path $SourceInput).Path
} catch {
    Fail "The source directory does not exist."
}
foreach ($RequiredPath in @("data", "sql/schema_v32.sql", "validation/validate_v32.py")) {
    if (-not (Test-Path (Join-Path $SourceRoot $RequiredPath))) {
        Fail "The selected source folder is missing $RequiredPath."
    }
}

$PgModule = Join-Path $RepoRoot "node_modules/pg"
if (-not (Test-Path $PgModule)) {
    Write-Host "Installing locked project dependencies..."
    Push-Location $RepoRoot
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { Fail "npm ci failed." }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Target branch: $ExpectedBranch"
Write-Host "Expected Neon host: $ExpectedHost"
Write-Host "Expected database: $ExpectedDatabase"
Write-Host "The importer will refuse any other host, database, or branch."
Write-Host ""

$SecureConnectionString = Read-Host "Paste the DIRECT (non-pooler) Neon connection string for this integration branch" -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureConnectionString)
$ConnectionString = $null
try {
    $ConnectionString = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
}

try {
    $ConnectionUri = [System.Uri]::new($ConnectionString)
} catch {
    Fail "The connection string is not a valid PostgreSQL URL."
}
if ($ConnectionUri.Scheme -notin @("postgres", "postgresql")) {
    Fail "The connection string must use the PostgreSQL scheme."
}
if ($ConnectionUri.Host -cne $ExpectedHost) {
    Fail "Wrong Neon host. Open the integration branch in Neon and copy its direct connection string."
}
if ($ConnectionUri.AbsolutePath.TrimStart("/") -cne $ExpectedDatabase) {
    Fail "Wrong database. The importer is allowlisted only for database 'shahoo'."
}
if ($env:DATABASE_URL -and $env:DATABASE_URL -ceq $ConnectionString) {
    Fail "The encyclopedia importer must not use the storefront DATABASE_URL."
}

$Confirmation = Read-Host "Type exactly: IMPORT TO $ExpectedBranch"
if ($Confirmation -cne "IMPORT TO $ExpectedBranch") {
    Fail "Confirmation did not match; no import was started."
}

$Keys = @(
    "OIL_ENCYCLOPEDIA_SOURCE_DIR",
    "OIL_ENCYCLOPEDIA_IMPORT_URL",
    "OIL_ENCYCLOPEDIA_TARGET_BRANCH",
    "OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_HOST",
    "OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_DATABASE"
)
$Previous = @{}
foreach ($Key in $Keys) {
    $Previous[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
}

try {
    $env:OIL_ENCYCLOPEDIA_SOURCE_DIR = $SourceRoot
    $env:OIL_ENCYCLOPEDIA_IMPORT_URL = $ConnectionString
    $env:OIL_ENCYCLOPEDIA_TARGET_BRANCH = $ExpectedBranch
    $env:OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_HOST = $ExpectedHost
    $env:OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_DATABASE = $ExpectedDatabase

    Push-Location $RepoRoot
    try {
        npm run db:import-oil-encyclopedia -- --confirm-non-production --target-branch $ExpectedBranch
        if ($LASTEXITCODE -ne 0) {
            Fail "The importer failed. Its transaction should have rolled back; inspect the error before retrying."
        }
    } finally {
        Pop-Location
    }
} finally {
    foreach ($Key in $Keys) {
        if ($null -eq $Previous[$Key]) {
            Remove-Item "Env:$Key" -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($Key, $Previous[$Key], "Process")
        }
    }
    $ConnectionString = $null
    $SecureConnectionString = $null
}

Write-Host ""
Write-Host "Importer completed. Save the JSON summary and do not enable the integration yet."
