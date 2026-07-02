# Push current work to dev — PowerShell-safe (npm script-shell is PS 5.1,
# which has no `&&`). Stops at the first failing step instead of pushing anyway.
param(
    [string]$Message = "update"
)

$ErrorActionPreference = "Stop"

git add -A
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Commit only if there's something staged (otherwise keep going to push)
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "Nothing new to commit - pushing existing commits." -ForegroundColor Yellow
}

# Owner bypass for the .githooks/pre-push protected-branch guard.
# $env: persists for child processes (git -> sh hook), unlike cmd's `set X=1 &&`.
$env:VEGGAT_OWNER = "1"
git push origin dev
exit $LASTEXITCODE
