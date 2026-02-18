<#
@fileOverview Restarts Veggat dev servers by stopping known dev ports, then launching VS Code dev task.
@stability stable
#>

$scriptRoot = $PSScriptRoot

& "$scriptRoot/dev-stop.ps1"
Start-Sleep -Seconds 1
& "$scriptRoot/dev-start.ps1"
