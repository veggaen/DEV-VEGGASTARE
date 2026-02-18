<#
@fileOverview Stops Veggat dev servers by terminating listeners on known dev ports.
@stability stable
#>

param(
  [int[]]$Ports = @(3000, 3001, 3002)
)

$processIds = New-Object System.Collections.Generic.HashSet[int]

foreach ($port in $Ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($conn in $listeners) {
    if ($conn.OwningProcess -gt 0) {
      [void]$processIds.Add([int]$conn.OwningProcess)
    }
  }
}

if ($processIds.Count -eq 0) {
  Write-Host "No dev server processes found on ports: $($Ports -join ', ')." -ForegroundColor Yellow
  exit 0
}

foreach ($procId in $processIds) {
  try {
    $proc = Get-Process -Id $procId -ErrorAction Stop
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Stopped PID $procId ($($proc.ProcessName))." -ForegroundColor Green
  } catch {
    Write-Warning "Failed to stop PID ${procId}: $($_.Exception.Message)"
  }
}

Write-Host "Dev servers shutdown complete." -ForegroundColor Green
