$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $projectRoot 'Install-LDB-SafeHub-AutoStart.ps1'
$taskName = 'LDB SafeHub AutoStart'
$healthUrl = 'http://127.0.0.1:3000/api/health'

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -SkipBuild -TimeoutSeconds 60
if ($LASTEXITCODE -ne 0) { throw "Installer failed with exit code $LASTEXITCODE" }

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$xml = [xml](Export-ScheduledTask -TaskName $taskName)
if ($task.TaskName -ne $taskName) { throw 'Unexpected task name.' }
$logonTriggers = @($task.Triggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskLogonTrigger' })
if ($logonTriggers.Count -lt 1) { throw 'Missing logon trigger.' }
if ($xml.Task.Settings.MultipleInstancesPolicy -ne 'IgnoreNew') { throw 'Duplicate protection is not IgnoreNew.' }
if ($xml.Task.Settings.ExecutionTimeLimit -ne 'PT0S') { throw 'Execution time limit is not unlimited.' }
if ([int]$xml.Task.Settings.RestartOnFailure.Count -lt 1) { throw 'Restart-on-failure is not configured.' }
if ($xml.Task.Actions.Exec.Arguments -notmatch 'Run-LDB-SafeHub-AutoStart\.ps1') { throw 'Task action does not run the supervisor.' }

$health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
if ($health.status -ne 'ok') { throw "Unexpected health status: $($health.status)" }
$page = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 5
if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'id="root"') { throw 'SafeHub page is not ready.' }

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2
$listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop)
if ($listeners.Count -ne 1) { throw "Expected one listener on port 3000; found $($listeners.Count)." }

$oldPid = $listeners[0].OwningProcess
Stop-Process -Id $oldPid -Force
$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep -Seconds 1
  try {
    $newHealth = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    $newListener = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop)
    if ($newHealth.status -eq 'ok' -and $newListener.Count -eq 1 -and $newListener[0].OwningProcess -ne $oldPid) {
      Write-Output 'SafeHub auto-start integration test passed.'
      exit 0
    }
  }
  catch {}
} while ((Get-Date) -lt $deadline)

throw 'SafeHub did not recover after the managed server process stopped.'
