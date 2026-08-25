$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$SupabaseUrl = "https://mpklydfhglclnebptjwv.supabase.co"
$SupabaseKey = "sb_publishable_doUfmTRHBzXEMzGlBrmzNQ_1p495QJb"
$BackupRoot = Join-Path $PSScriptRoot "..\backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$Headers = @{
  apikey = $SupabaseKey
  Authorization = "Bearer $SupabaseKey"
  Accept = "application/json"
}

function Get-SupabaseTable {
  param(
    [Parameter(Mandatory = $true)][string]$Table,
    [Parameter(Mandatory = $true)][string]$Order
  )

  $Uri = "$SupabaseUrl/rest/v1/$Table`?select=*&order=$Order"
  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$People = @(Get-SupabaseTable -Table "people" -Order "name.asc")
$Events = @(Get-SupabaseTable -Table "events" -Order "created_at.desc")
$SettlementPayments = @(Get-SupabaseTable -Table "settlement_payments" -Order "created_at.desc")

try {
  $SettlementBatches = @(Get-SupabaseTable -Table "settlement_batches" -Order "created_at.desc")
} catch {
  $SettlementBatches = @()
}

$Payload = [ordered]@{
  exported_at = (Get-Date).ToString("o")
  source = $SupabaseUrl
  counts = [ordered]@{
    people = $People.Count
    events = $Events.Count
    settlement_payments = $SettlementPayments.Count
    settlement_batches = $SettlementBatches.Count
  }
  people = $People
  events = $Events
  settlement_payments = $SettlementPayments
  settlement_batches = $SettlementBatches
}

$Json = $Payload | ConvertTo-Json -Depth 50
$SnapshotPath = Join-Path $BackupRoot "sports-split-$Timestamp.json"
$LatestPath = Join-Path $BackupRoot "sports-split-latest.json"

$Json | Set-Content -Path $SnapshotPath -Encoding UTF8
$Json | Set-Content -Path $LatestPath -Encoding UTF8

Write-Host "Backup complete:"
Write-Host "  $SnapshotPath"
Write-Host "  $LatestPath"
