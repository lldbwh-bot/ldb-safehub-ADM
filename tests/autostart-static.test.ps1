$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $projectRoot 'Run-LDB-SafeHub-AutoStart.ps1'
$installerPath = Join-Path $projectRoot 'Install-LDB-SafeHub-AutoStart.ps1'
$uninstallerPath = Join-Path $projectRoot 'Uninstall-LDB-SafeHub-AutoStart.ps1'

foreach ($path in @($runnerPath, $installerPath, $uninstallerPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing auto-start script: $path"
  }

  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count -gt 0) {
    throw "PowerShell syntax errors in $path`: $($errors -join '; ')"
  }
}

$runner = Get-Content -Raw -LiteralPath $runnerPath
$installer = Get-Content -Raw -LiteralPath $installerPath
$uninstaller = Get-Content -Raw -LiteralPath $uninstallerPath

foreach ($required in @(
  'http://127.0.0.1:3000/api/health',
  'dist\server.cjs',
  'NODE_ENV',
  'production',
  'Start-Process',
  'WaitForExit',
  'RestartDelaySeconds'
)) {
  if (-not $runner.Contains($required)) { throw "Runner missing contract: $required" }
}

if ($runner.Contains('throw "LDB SafeHub exited with code')) {
  throw 'Runner must recover the child server instead of exiting after a child failure.'
}

foreach ($required in @(
  'LDB SafeHub AutoStart',
  'New-ScheduledTaskAction',
  'New-ScheduledTaskTrigger',
  '-AtLogOn',
  'New-ScheduledTaskSettingsSet',
  '-RestartCount',
  '-ExecutionTimeLimit',
  'Register-ScheduledTask',
  'Start-ScheduledTask'
)) {
  if (-not $installer.Contains($required)) { throw "Installer missing contract: $required" }
}

if ($installer -match 'Start-Process\s+.*http://127\.0\.0\.1:3000') {
  throw 'Installer must not open a browser.'
}

foreach ($required in @('LDB SafeHub AutoStart', 'Stop-ScheduledTask', 'Unregister-ScheduledTask')) {
  if (-not $uninstaller.Contains($required)) { throw "Uninstaller missing contract: $required" }
}

Write-Output 'Auto-start static contract test passed.'
