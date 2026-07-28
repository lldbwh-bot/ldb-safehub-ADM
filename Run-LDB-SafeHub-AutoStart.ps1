param(
  [int]$HealthIntervalSeconds = 10,
  [int]$StartupTimeoutSeconds = 45,
  [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$healthUrl = 'http://127.0.0.1:3000/api/health'
$serverBundle = Join-Path $projectRoot 'dist\server.cjs'
$stdoutLog = Join-Path $projectRoot 'autostart.out.log'
$stderrLog = Join-Path $projectRoot 'autostart.err.log'

function Test-SafeHubHealth {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    return $response.status -eq 'ok'
  }
  catch {
    return $false
  }
}

function Wait-ForSafeHubHealth([int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-SafeHubHealth) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

if (-not (Test-Path -LiteralPath $serverBundle)) {
  throw "Production server bundle is missing: $serverBundle. Run npm run build."
}

$node = Get-Command node.exe -ErrorAction Stop

while ($true) {
  while (Test-SafeHubHealth) {
    Start-Sleep -Seconds $HealthIntervalSeconds
  }

  $env:NODE_ENV = 'production'
  $server = Start-Process -FilePath $node.Source -ArgumentList $serverBundle `
    -WorkingDirectory $projectRoot -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog -WindowStyle Hidden -PassThru

  if (-not (Wait-ForSafeHubHealth -TimeoutSeconds $StartupTimeoutSeconds)) {
    if (-not $server.HasExited) {
      $server.Kill()
      $server.WaitForExit()
    }
    Add-Content -LiteralPath $stderrLog `
      -Value "[$(Get-Date -Format o)] LDB SafeHub failed to become healthy; retrying."
    Start-Sleep -Seconds $RestartDelaySeconds
    continue
  }

  $server.WaitForExit()
  Add-Content -LiteralPath $stderrLog `
    -Value "[$(Get-Date -Format o)] LDB SafeHub exited with code $($server.ExitCode); restarting."
  Start-Sleep -Seconds $RestartDelaySeconds
}
