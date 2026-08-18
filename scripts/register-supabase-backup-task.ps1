param(
  [string]$TaskName = "SportsSplitCloudBackup",
  [string]$At = "23:00"
)

$ErrorActionPreference = "Stop"

$SyncScript = Join-Path $PSScriptRoot "sync-supabase-backup.ps1"
if (!(Test-Path -LiteralPath $SyncScript)) {
  throw "Cannot find sync script: $SyncScript"
}

$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$SyncScript`""

$Trigger = New-ScheduledTaskTrigger -Daily -At $At
$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Back up Sports Split Supabase data to local JSON files." `
  -Force | Out-Null

Write-Host "Scheduled task registered:"
Write-Host "  Name: $TaskName"
Write-Host "  Daily at: $At"
Write-Host "  Script: $SyncScript"
