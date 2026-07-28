$ErrorActionPreference = 'Stop'
$taskName = 'LDB SafeHub AutoStart'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($task) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Output "Removed Scheduled Task: $taskName"
} else {
  Write-Output "Scheduled Task is not installed: $taskName"
}
