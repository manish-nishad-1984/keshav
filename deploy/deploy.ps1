# One-step deploy for keshav.kriviinfotech.com (site4now IISNode). Run DEPLOY.cmd, or:
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
#
# What it does, in order (stops at the first failure, nothing on the server is ever deleted):
#   1. builds packages/types, packages/shared, the Prisma client, apps/api and apps/web
#   2. applies pending Prisma migrations to the production database
#   3. uploads the built files over MsDeploy (same paths as the repo layout on the server)
#   4. uploads deploy\web.config (iisnode handler + JSON error pass-through), which restarts the app
#   5. checks /api/v1/health and that the live page serves this build's assets
#
# Secrets are read from deploy\deploy.local.env (gitignored) - see deploy\deploy.local.env.example.

param(
  # Skip step 2 (useful when you know there is no schema change).
  [switch]$SkipMigrations
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$msdeploy = 'C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe'
$site = 'jigneshsatani-001-subsite10'
$liveUrl = 'http://keshav.kriviinfotech.com'

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function Fail($text) {
  Write-Host "`nDEPLOY FAILED: $text" -ForegroundColor Red
  Write-Host 'Nothing after this step was changed. Copy this window to Claude.' -ForegroundColor Yellow
  exit 1
}
# Runs a native command; fails the deploy on a non-zero exit code.
function Run($label, [scriptblock]$cmd) {
  & $cmd
  if ($LASTEXITCODE -ne 0) { Fail "$label (exit code $LASTEXITCODE)" }
}

# --- config ----------------------------------------------------------------------------------
$envFile = Join-Path $PSScriptRoot 'deploy.local.env'
if (-not (Test-Path $envFile)) { Fail "Missing $envFile (copy deploy.local.env.example and fill it in)" }
$cfg = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"') }
}
foreach ($key in 'MSDEPLOY_USER', 'MSDEPLOY_PASSWORD', 'PROD_DATABASE_URL') {
  if (-not $cfg[$key]) { Fail "$key is empty in deploy.local.env" }
}
if (-not (Test-Path $msdeploy)) { Fail "Web Deploy not found at $msdeploy" }
$dest = "computerName=https://win8194.site4now.net:8172/msdeploy.axd?site=$site,userName=$($cfg.MSDEPLOY_USER),password=$($cfg.MSDEPLOY_PASSWORD),authtype=Basic"

# Live should match what is in git: warn about uncommitted app code (not a blocker).
$dirty = git status --porcelain -- apps/api/src apps/api/prisma apps/web/src packages
if ($dirty) {
  Write-Host 'Warning: these app files have uncommitted changes and will be deployed as they are:' -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
}
Write-Host ("Deploying commit " + (git log --oneline -1)) -ForegroundColor Gray

# --- 1. build ------------------------------------------------------------------------------
Step '1/5 Build'
Run 'build packages/types' { npm run build -w packages/types }
Run 'build packages/shared' { npm run build -w packages/shared }

Push-Location apps/api
npx prisma generate
$generateOk = $LASTEXITCODE -eq 0
Pop-Location
if (-not $generateOk) {
  # Usually the local dev API holds the engine file open. The JS client is still fine if it
  # was generated from the current schema - compare before giving up.
  $repoSchema = (Get-Content apps/api/prisma/schema.prisma -Raw) -replace "`r", ''
  $clientSchema = (Get-Content node_modules/.prisma/client/schema.prisma -Raw) -replace "`r", ''
  if ($repoSchema -ne $clientSchema) { Fail 'prisma generate failed - stop the local API (npm run dev) and run DEPLOY again' }
  Write-Host 'prisma generate could not replace the engine file (local API running) - client already matches the schema, continuing.' -ForegroundColor Yellow
}

Run 'build apps/api' { npm run build -w apps/api }
Run 'build apps/web' { npm run build -w apps/web }
$expectedJs = (Get-Content apps/web/dist/index.html -Raw | Select-String -Pattern 'assets/index-[^"]+\.js').Matches[0].Value
# A local dev API URL baked into the bundle would make the live site call the user's own PC.
if (Select-String -Path "apps/web/dist/$expectedJs" -Pattern 'localhost:4000' -SimpleMatch -Quiet) {
  Fail 'the web build points at localhost:4000 (check apps/web/.env.production)'
}

# --- 2. migrations -------------------------------------------------------------------------
if ($SkipMigrations) {
  Step '2/5 Database migrations (skipped)'
} else {
  Step '2/5 Database migrations'
  Push-Location apps/api
  $env:DATABASE_URL = $cfg.PROD_DATABASE_URL
  npx prisma migrate deploy
  $migrateOk = $LASTEXITCODE -eq 0
  Remove-Item Env:DATABASE_URL
  Pop-Location
  if (-not $migrateOk) { Fail 'prisma migrate deploy' }
}

# --- 3. upload -----------------------------------------------------------------------------
Step '3/5 Upload'
function Upload($localPath, $remotePath, [string[]]$extra = @()) {
  Write-Host "  -> $remotePath"
  & $msdeploy -verb:sync "-source:contentPath=$root\$localPath" "-dest:contentPath=$site\$remotePath,$dest" `
    -allowUntrusted -enableRule:DoNotDeleteRule -retryAttempts:5 -retryInterval:3000 @extra |
    Select-String -Pattern 'Total changes|Error' | ForEach-Object { Write-Host "     $_" }
  if ($LASTEXITCODE -ne 0) { Fail "upload of $remotePath" }
}
Upload 'apps\api\dist' 'apps\api\dist'
Upload 'apps\api\prisma' 'apps\api\prisma'
Upload 'apps\api\server.js' 'apps\api\server.js'
Upload 'apps\api\package.json' 'apps\api\package.json'
# Generated client JS + schema; engine binaries only change with the Prisma version.
Upload 'node_modules\.prisma\client' 'node_modules\.prisma\client' @('-skip:objectName=filePath,absolutePath=\.node$')
foreach ($pkg in 'types', 'shared') {
  Upload "packages\$pkg\dist" "packages\$pkg\dist"
  Upload "packages\$pkg\dist" "node_modules\@ckfast\$pkg\dist"
}
Upload 'apps\web\dist' 'apps\web\dist'
Upload 'apps\web\dist' 'node_modules\@ckfast\web\dist'

# --- 4. web.config (restarts the app) -------------------------------------------------------
Step '4/5 web.config + restart'
$stamped = Join-Path $env:TEMP 'keshav-web.config'
(Get-Content (Join-Path $PSScriptRoot 'web.config') -Raw) -replace '</configuration>', "  <!-- deployed $(Get-Date -Format s) -->`r`n</configuration>" |
  Set-Content -Path $stamped -Encoding UTF8
& $msdeploy -verb:sync "-source:contentPath=$stamped" "-dest:contentPath=$site\web.config,$dest" -allowUntrusted -retryAttempts:5 |
  Select-String -Pattern 'Total changes|Error' | ForEach-Object { Write-Host "     $_" }
if ($LASTEXITCODE -ne 0) { Fail 'web.config upload' }
Remove-Item $stamped -ErrorAction SilentlyContinue

# --- 5. verify -----------------------------------------------------------------------------
Step '5/5 Check live site'
$healthy = $false
for ($i = 1; $i -le 6 -and -not $healthy; $i++) {
  Start-Sleep -Seconds 5
  try {
    $health = (Invoke-WebRequest "$liveUrl/api/v1/health" -UseBasicParsing -TimeoutSec 60).Content
    $healthy = $health -like '*"status":"ok"*'
  } catch { Write-Host "  waiting for the app to start ($i/6)..." }
}
if (-not $healthy) { Fail "health check did not return ok: $health" }

$page = (Invoke-WebRequest "$liveUrl/" -UseBasicParsing -TimeoutSec 60).Content
if ($page -notlike "*$expectedJs*") { Fail "live page does not serve this build ($expectedJs)" }

Write-Host "`nDEPLOY OK - $liveUrl is running this build ($expectedJs)." -ForegroundColor Green
Write-Host 'Tip: open the site with Ctrl+Shift+R so the browser drops its old cache.' -ForegroundColor Gray
