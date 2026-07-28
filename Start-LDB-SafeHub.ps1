param(
  [switch]$NoOpen,
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$previewUrl = 'http://127.0.0.1:3000/'
$healthUrl = 'http://127.0.0.1:3000/api/health'
$stdoutLog = Join-Path $projectRoot 'preview.out.log'
$stderrLog = Join-Path $projectRoot 'preview.err.log'

function Test-PreviewHealth {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    return $response.status -eq 'ok'
  }
  catch {
    return $false
  }
}

if (-not (Test-PreviewHealth)) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    $install = Start-Process -FilePath 'npm.cmd' -ArgumentList 'ci' -WorkingDirectory $projectRoot -Wait -PassThru -WindowStyle Hidden
    if ($install.ExitCode -ne 0) {
      throw "Dependency installation failed with exit code $($install.ExitCode)."
    }
  }

  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $projectRoot -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline -and -not (Test-PreviewHealth)) {
    Start-Sleep -Milliseconds 250
  }

  if (-not (Test-PreviewHealth)) {
    throw "LDB SafeHub did not start within $TimeoutSeconds seconds. Check preview.err.log."
  }
}

if (-not $NoOpen) {
  Start-Process $previewUrl
}

Write-Output "LDB SafeHub is running at $previewUrl"
