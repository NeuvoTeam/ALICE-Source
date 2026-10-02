# Obsidian Loki Inbox -> Backlog & Action Log Dispatcher
# Silent-safe for Task Scheduler via run-silent.vbs (wscript.exe)

$vaultRoot   = "C:\Users\kuroi\OneDrive\Obsidian\Loki"
$inboxDir    = Join-Path $vaultRoot "00_Inbox"
$archiveDir  = Join-Path $vaultRoot "60_Archive"
$aliceTarget = Join-Path $vaultRoot "10_Projects\ALICE\Backlog.md"
$govLog      = Join-Path $vaultRoot "10_Governance\action-log.md"

# --- logging ---
$logDir  = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir ("dispatch-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Log-Message([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

# Append UTF-8 without BOM, matching Obsidian's default encoding
function Append-Utf8NoBom([string]$path, [string]$text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($path, $text, $enc)
}

try {
    if (-not (Test-Path -LiteralPath $inboxDir)) {
        Log-Message "ERROR: Inbox directory not found at $inboxDir"
        exit 2
    }

    @(
        (Split-Path -Parent $aliceTarget),
        (Split-Path -Parent $govLog),
        $archiveDir
    ) | ForEach-Object {
        if (-not (Test-Path -LiteralPath $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
        }
    }

    Get-ChildItem -LiteralPath $inboxDir -Filter *.md -File | ForEach-Object {
        $note = $_

        # --- stability check: skip files still being written by OneDrive ---
        try {
            $fi1 = Get-Item -LiteralPath $note.FullName -ErrorAction Stop
            Start-Sleep -Milliseconds 400
            $fi2 = Get-Item -LiteralPath $note.FullName -ErrorAction Stop
        } catch {
            Log-Message "SKIPPED (vanished mid-check): $($note.Name)"
            return
        }
        if ($fi1.Length -ne $fi2.Length -or $fi1.LastWriteTimeUtc -ne $fi2.LastWriteTimeUtc) {
            Log-Message "SKIPPED (still syncing): $($note.Name)"
            return
        }

        $content   = Get-Content -LiteralPath $note.FullName -Raw -Encoding UTF8
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")

        # strip code fences + inline code so URLs/comments don't false-match
        $scan = $content -replace '(?s)```.*?```', '' -replace '`[^`]*`', ''

        $dispatched = $false

        # 1. ALICE engineering route
        if ($scan -match '(?im)(?:^|\s)#(alice|task|bug|feature)\b') {
            $entry = "`n### Captured: $($note.BaseName) ($timestamp)`n$content`n"
            try {
                Append-Utf8NoBom -path $aliceTarget -text $entry
                Log-Message "Dispatched $($note.Name) -> ALICE Backlog"
                $dispatched = $true
            } catch {
                Log-Message "WARNING: Append to Backlog failed for $($note.Name): $_"
            }
        }

        # 2. Governance route — independent IF so dual-tagged notes land in both
        if ($scan -match '(?im)(?:^|\s)#(gov|governance|board|compliance)\b') {
            $govEntry = "`n### Captured: $($note.BaseName) ($timestamp)`n$content`n"
            try {
                Append-Utf8NoBom -path $govLog -text $govEntry
                Log-Message "Dispatched $($note.Name) -> Governance Log"
                $dispatched = $true
            } catch {
                Log-Message "WARNING: Append to Gov Log failed for $($note.Name): $_"
            }
        }

        # 3. Archive only if at least one route succeeded
        if ($dispatched) {
            $dest = Join-Path $archiveDir $note.Name
            if (Test-Path -LiteralPath $dest) {
                $dest = Join-Path $archiveDir (
                    "{0}-{1}{2}" -f $note.BaseName, (Get-Date -Format "yyyyMMdd-HHmmss"), $note.Extension
                )
            }
            try {
                Move-Item -LiteralPath $note.FullName -Destination $dest -ErrorAction Stop
                Log-Message "Archived $($note.Name) -> 60_Archive"
            } catch {
                Log-Message "WARNING: Move to Archive failed for $($note.Name): $_"
            }
        } else {
            Log-Message "Skipped (no matching tags): $($note.Name)"
        }
    }
}
catch {
    Log-Message "FATAL ERROR: $_"
    exit 1
}