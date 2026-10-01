# PowerShell: Obsidian Loki Inbox -> Backlog & Action Log Dispatcher
# Run on-demand or via Task Scheduler

$vaultRoot   = "C:\Users\kuroi\OneDrive\Obsidian\Loki"
$inboxDir    = Join-Path$vaultRoot "00_Inbox"
$archiveDir  = Join-Path$vaultRoot "60_Archive"
$aliceTarget = Join-Path$vaultRoot "10_Projects\ALICE\Backlog.md"
$govLog      = Join-Path$vaultRoot "10_Governance\action-log.md"

if (-not (Test-Path $inboxDir)) {
    Write-Warning "Inbox directory not found: $inboxDir"
    exit
}

# Ensure destination folders exist
@( (Split-Path $aliceTarget), (Split-Path $govLog),$archiveDir ) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}

Get-ChildItem -Path $inboxDir -Filter *.md | ForEach-Object {
    $note = $_$content = Get-Content $note.FullName -Raw
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
    $dispatched =$false

    # Route ALICE engineering tasks, bugs, or feature notes
    if ($content -match '#(alice|task|bug|feature)') {
        $entry = "`n### Captured: $($note.BaseName) ($timestamp)`n$content`n"
        Add-Content -Path $aliceTarget -Value $entry
        Write-Host "Dispatched $($note.Name) -> ALICE Backlog" -ForegroundColor Cyan
        $dispatched = $true
    }

    # Route Governance or compliance notes
    if ($content -match '#(gov|governance|board|compliance)') {
        $govEntry = "`n### Captured: $($note.BaseName) ($timestamp)`n$content`n"
        Add-Content -Path $govLog -Value$govEntry
        Write-Host "Dispatched $($note.Name) -> Governance Log" -ForegroundColor Yellow
        $dispatched =$true
    }

    # Move processed note out of the inbox
    if ($dispatched) {
        Move-Item -Path $note.FullName -Destination (Join-Path $archiveDir $note.Name) -Force
    }
}