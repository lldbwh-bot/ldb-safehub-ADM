param(
  [switch]$SkipBuild,
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$taskName = 'LDB SafeHub AutoStart'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $projectRoot 'Run-LDB-SafeHub-AutoStart.ps1'
$healthUrl = 'http://127.0.0.1:3000/api/health'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $runnerPath)) { throw "Missing runner: $runnerPath" }
if (-not $SkipBuild) {
  $build = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'build' `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
  if ($build.ExitCode -ne 0) { throw "Production build failed with exit code $($build.ExitCode)." }
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runnerPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description 'Keeps the local LDB SafeHub web server available on port 3000.'

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.status -eq 'ok') {
      Write-Output 'LDB SafeHub auto-start installed and healthy at http://127.0.0.1:3000/.'
      exit 0
    }
  }
  catch {}
  Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

throw "Scheduled Task was registered, but SafeHub did not become healthy within $TimeoutSeconds seconds."
