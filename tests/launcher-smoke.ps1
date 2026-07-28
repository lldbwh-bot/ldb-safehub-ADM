$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$cmdLauncher = Join-Path $projectRoot 'Start-LDB-SafeHub.cmd'
$powerShellLauncher = Join-Path $projectRoot 'Start-LDB-SafeHub.ps1'

if (-not (Test-Path -LiteralPath $cmdLauncher)) {
  throw 'Missing one-click launcher: Start-LDB-SafeHub.cmd'
}

if (-not (Test-Path -LiteralPath $powerShellLauncher)) {
  throw 'Missing launcher implementation: Start-LDB-SafeHub.ps1'
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $powerShellLauncher -NoOpen -TimeoutSeconds 15
if ($LASTEXITCODE -ne 0) {
  throw "Launcher exited with code $LASTEXITCODE"
}

$health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 5
if ($health.status -ne 'ok') {
  throw "Unexpected health status: $($health.status)"
}

Write-Output 'Launcher smoke test passed.'
