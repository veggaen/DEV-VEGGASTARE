<#
@fileOverview Starts Veggat dev servers with smart port cleanup.
  1. Cleans up busy ports (kills stale processes on 3000/3001/3002)
  2. Runs both servers via concurrently (color-coded [FE]/[BE] output)

  For split terminal panes: press Ctrl+Shift+B or say "start my project" in Copilot Chat.
@stability stable
#>

param(
  [int[]]$Ports = @(3000, 3001, 3002),
  [switch]$ForceRestartIfBusy = $true
)

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$stopScript = Join-Path $PSScriptRoot 'dev-stop.ps1'

function Get-BusyDevPorts([int[]]$PortList) {
  $busy = @()
  foreach ($port in $PortList) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listeners) { $busy += $port }
  }
  return $busy
}

# ── Port cleanup ──────────────────────────────────────────────
Push-Location $workspaceRoot
try {
  $busyPorts = Get-BusyDevPorts -PortList $Ports

  if ($busyPorts.Count -gt 0) {
    if ($ForceRestartIfBusy) {
      Write-Host "Detected busy dev port(s): $($busyPorts -join ', '). Stopping existing processes first..." -ForegroundColor Yellow
      & $stopScript -Ports $Ports
      Start-Sleep -Milliseconds 700
    } else {
      Write-Warning "Port(s) busy: $($busyPorts -join ', '). Use -ForceRestartIfBusy to auto-restart."
      exit 1
    }
  }

  # ── Run both servers in this terminal ─────────────────────
  Write-Host "Starting frontend (:3000) + backend (:3001)..." -ForegroundColor Cyan
  Write-Host "Tip: For split panes, press Ctrl+Shift+B instead." -ForegroundColor DarkGray
  npm run dev
} finally {
  Pop-Location
}
