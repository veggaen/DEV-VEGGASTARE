# Promote dev -> main and return to dev. PowerShell-safe with hard stops:
# a failed pull or merge (conflict) aborts BEFORE anything is pushed.
$ErrorActionPreference = "Stop"

git checkout main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git pull origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Pull failed - aborting." -ForegroundColor Red; git checkout dev; exit 1 }

git merge dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "Merge conflict - resolve it, then run: npm run push:main" -ForegroundColor Red
    exit 1
}

$env:VEGGAT_OWNER = "1"
git push origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git checkout dev
exit $LASTEXITCODE
