# ============================================================================
# DEPRECATED 2026-10-05 — DO NOT RE-ENABLE.
#
# Superseded by the 2026-10-05 "Write Separation Architecture" decision
# (vault: 10_Projects/ALICE/GEMINI X DEEPSEEK 2026-10-05 Hermes stack.md):
# automated edge writes go EXCLUSIVELY to 10_Projects/ALICE/Backlog_Auto.md;
# 10_Projects/ALICE/Backlog.md is the manual-planning file.
#
# $aliceTarget below still points at Backlog.md, so re-enabling this task
# would silently resume writing automated captures into the manual file.
# Automated capture is now owned by the Hermes Edge Worker (hermes-courier),
# which writes Backlog_Auto.md and dead-letters failures to
# 00_Inbox/_failed_routes.md.
#
# Last observed run: 2026-10-05 17:30 (see scripts/logs/dispatch-2026-10-05.log).
# Kept for reference only.
# ============================================================================
# Obsidian Loki Inbox -> Backlog & Action Log Dispatcher
# Silent-safe for Task Scheduler via run-silent.vbs (wscript.exe)
# Hardened: empty-file guard + auto-archive, OneDrive sync detection,
#           partial-route atomicity, batch cap, run summary, BOM-free logging.
# Extended: line-by-line Pending_Email_Triage.md handling + #personal/#admin route.

$vaultRoot   = "C:\Users\kuroi\OneDrive\Obsidian\Loki"
$inboxDir    = Join-Path $vaultRoot "00_Inbox"
$archiveDir  = Join-Path $vaultRoot "60_Archive"
$partialDir  = Join-Path $archiveDir "_partial"
$emptyDir    = Join-Path $archiveDir "_empty"
$aliceTarget = Join-Path $vaultRoot "10_Projects\ALICE\Backlog.md"
$govLog      = Join-Path $vaultRoot "10_Governance\action-log.md"
$personalLog = Join-Path $vaultRoot "20_Areas\Personal\Tasks.md"

# Tunables
$MaxFilesPerRun           = 50      # cap per invocation so bursts don't stack up
$MinAgeSeconds            = 30      # skip files younger than this (Obsidian may still be typing)
$StabilitySleepMs         = 400     # wait between size/mtime samples
$EmptyArchiveAfterMinutes = 60      # empty files older than this go to 60_Archive\_empty
$LogRetentionDays         = 30      # auto-delete logs older than this
$TriageFileName           = "Pending_Email_Triage.md"

# --- logging ---
$logDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$script:logFile = Join-Path $logDir ("dispatch-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Append-Utf8NoBom([string]$path, [string]$text) {
    $dir = Split-Path -Parent $path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($path, $text, $enc)
}

function Log-Message([string]$msg) {
    $line = "[{0}] {1}`r`n" -f (Get-Date -Format "HH:mm:ss"), $msg
    Append-Utf8NoBom -path $script:logFile -text $line
}

# --- log rotation ---
try {
    Get-ChildItem -LiteralPath $logDir -Filter "dispatch-*.log" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LogRetentionDays) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
} catch { }

# --- helper: dispatch a single tagged string to one or more destinations ---
function Invoke-Routes {
    param(
        [string]$Scan,
        [string]$Body,
        [string]$Label
    )
    $attempted = 0
    $succeeded = 0

    if ($Scan -match '(?im)(?:^|\s)#(alice|task|bug|feature)\b') {
        $attempted++
        try {
            Append-Utf8NoBom -path $aliceTarget -text $Body
            Log-Message "  -> Backlog OK ($Label)"
            $succeeded++
        } catch {
            Log-Message "  -> Backlog FAIL ($Label) :: $_"
        }
    }

    if ($Scan -match '(?im)(?:^|\s)#(gov|governance|board|compliance)\b') {
        $attempted++
        try {
            Append-Utf8NoBom -path $govLog -text $Body
            Log-Message "  -> GovLog OK ($Label)"
            $succeeded++
        } catch {
            Log-Message "  -> GovLog FAIL ($Label) :: $_"
        }
    }

    if ($Scan -match '(?im)(?:^|\s)#(personal|admin)\b') {
        $attempted++
        try {
            Append-Utf8NoBom -path $personalLog -text $Body
            Log-Message "  -> Personal OK ($Label)"
            $succeeded++
        } catch {
            Log-Message "  -> Personal FAIL ($Label) :: $_"
        }
    }

    [PSCustomObject]@{ Attempted = $attempted; Succeeded = $succeeded }
}

# --- main ---
try {
    if (-not (Test-Path -LiteralPath $inboxDir)) {
        Log-Message "FATAL: Inbox directory not found at $inboxDir"
        exit 2
    }

    # Ensure all target directories exist
    @(
        (Split-Path -Parent $aliceTarget),
        (Split-Path -Parent $govLog),
        (Split-Path -Parent $personalLog),
        $archiveDir,
        $partialDir,
        $emptyDir
    ) | ForEach-Object {
        if (-not (Test-Path -LiteralPath $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
        }
    }

    # Counters for run summary
    $skipped    = 0
    $dispatched = 0
    $partial    = 0
    $failed     = 0

    $files = Get-ChildItem -LiteralPath $inboxDir -Filter *.md -File |
             Sort-Object LastWriteTime |
             Select-Object -First $MaxFilesPerRun

    foreach ($note in $files) {

        # --- age gate ---
        $ageSeconds = ((Get-Date) - $note.LastWriteTime).TotalSeconds
        if ($ageSeconds -lt $MinAgeSeconds) {
            Log-Message "SKIP (age ${ageSeconds}s): $($note.Name)"
            $skipped++
            continue
        }

        # --- stability check ---
        try {
            $fi1 = Get-Item -LiteralPath $note.FullName -ErrorAction Stop
            Start-Sleep -Milliseconds $StabilitySleepMs
            $fi2 = Get-Item -LiteralPath $note.FullName -ErrorAction Stop
        } catch {
            Log-Message "SKIP (vanished): $($note.Name)"
            $skipped++
            continue
        }
        if ($fi1.Length -ne $fi2.Length -or $fi1.LastWriteTimeUtc -ne $fi2.LastWriteTimeUtc) {
            Log-Message "SKIP (syncing): $($note.Name)"
            $skipped++
            continue
        }

        # --- read content ---
        try {
            $content = Get-Content -LiteralPath $note.FullName -Raw -Encoding UTF8 -ErrorAction Stop
        } catch {
            Log-Message "SKIP (read failed): $($note.Name) :: $_"
            $skipped++
            continue
        }

        # --- empty-content guard ---
        if ([string]::IsNullOrWhiteSpace($content)) {
            if ($ageSeconds -gt ($EmptyArchiveAfterMinutes * 60)) {
                $dest = Join-Path $emptyDir $note.Name
                if (Test-Path -LiteralPath $dest) {
                    $dest = Join-Path $emptyDir (
                        "{0}-{1}{2}" -f $note.BaseName, (Get-Date -Format "yyyyMMdd-HHmmss"), $note.Extension
                    )
                }
                try {
                    Move-Item -LiteralPath $note.FullName -Destination $dest -ErrorAction Stop
                    Log-Message "ARCHIVED (empty, age ${ageSeconds}s): $($note.Name)"
                    $dispatched++
                } catch {
                    Log-Message "WARN: empty archive move failed for $($note.Name) :: $_"
                    $failed++
                }
            } else {
                Log-Message "SKIP (empty, age ${ageSeconds}s): $($note.Name)"
                $skipped++
            }
            continue
        }

        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")

        # ============================================================
        # SPECIAL CASE: line-by-line email triage sheet
        # ============================================================
        if ($note.Name -eq $TriageFileName) {
            $lines          = Get-Content -LiteralPath $note.FullName -Encoding UTF8
            $remainingLines = New-Object System.Collections.Generic.List[string]
            $anyDispatched  = $false
            $anyFailed      = $false

            foreach ($line in $lines) {
                if ($line -match '^\s*-\s*\[x\]\s*(.*)') {
                    # Checked task -> dispatch it
                    $taskLine = $line.TrimEnd()
                    $body     = "`r`n$taskLine _[approved $timestamp]_`r`n"
                    $result   = Invoke-Routes -Scan $taskLine -Body $body -Label "triage:$($note.BaseName)"

                    if ($result.Attempted -eq 0) {
                        # Checked but no tag -> leave in file, log it
                        Log-Message "  -> TRIAGE: no tag on checked line, kept: $taskLine"
                        $remainingLines.Add($line)
                    } elseif ($result.Succeeded -eq $result.Attempted) {
                        $anyDispatched = $true
                    } else {
                        # Partial -> leave the line in the file for retry
                        $anyFailed = $true
                        $remainingLines.Add($line)
                    }
                } else {
                    # Unchecked or non-task line -> keep
                    $remainingLines.Add($line)
                }
            }

            # Persist the remaining lines if anything changed
            if ($anyDispatched -or $anyFailed) {
                $remainingTaskLines = @($remainingLines | Where-Object { $_ -match '^\s*-\s*\[' })
                if ($remainingTaskLines.Count -eq 0) {
                    # All tasks handled -> archive the triage sheet
                    $dest = Join-Path $archiveDir ("{0}-{1}.md" -f $note.BaseName, (Get-Date -Format "yyyyMMdd-HHmmss"))
                    try {
                        Move-Item -LiteralPath $note.FullName -Destination $dest -ErrorAction Stop
                        Log-Message "TRIAGE: all tasks cleared, archived $($note.Name)"
                        $dispatched++
                    } catch {
                        Log-Message "WARN: triage archive move failed :: $_"
                        $failed++
                    }
                } else {
                    # Rewrite with remaining lines (preserve order, UTF-8 no BOM)
                    try {
                        $enc = New-Object System.Text.UTF8Encoding($false)
                        [System.IO.File]::WriteAllLines($note.FullName, $remainingLines, $enc)
                        Log-Message "TRIAGE: updated $($note.Name), $($remainingTaskLines.Count) task(s) remain"
                        if ($anyFailed) { $partial++ } else { $dispatched++ }
                    } catch {
                        Log-Message "WARN: triage rewrite failed :: $_"
                        $failed++
                    }
                }
            } else {
                Log-Message "SKIP (triage: no checked lines): $($note.Name)"
                $skipped++
            }
            continue
        }

        # ============================================================
        # STANDARD: raw capture note
        # ============================================================
        $scan = $content -replace '(?s)```.*?```', '' -replace '`[^`]*`', ''
        $entry = "`r`n### Captured: $($note.BaseName) ($timestamp)`r`n$content`r`n"
        $result = Invoke-Routes -Scan $scan -Body $entry -Label $note.Name

        if ($result.Attempted -eq 0) {
            Log-Message "SKIP (no tags): $($note.Name)"
            $skipped++
            continue
        }

        if ($result.Succeeded -eq $result.Attempted) {
            $dest = Join-Path $archiveDir $note.Name
            if (Test-Path -LiteralPath $dest) {
                $dest = Join-Path $archiveDir (
                    "{0}-{1}{2}" -f $note.BaseName, (Get-Date -Format "yyyyMMdd-HHmmss"), $note.Extension
                )
            }
            try {
                Move-Item -LiteralPath $note.FullName -Destination $dest -ErrorAction Stop
                Log-Message "ARCHIVED: $($note.Name)"
                $dispatched++
            } catch {
                Log-Message "WARN: archive move failed for $($note.Name) :: $_"
                $failed++
            }
        }
        elseif ($result.Succeeded -gt 0) {
            $dest = Join-Path $partialDir $note.Name
            if (Test-Path -LiteralPath $dest) {
                $dest = Join-Path $partialDir (
                    "{0}-{1}{2}" -f $note.BaseName, (Get-Date -Format "yyyyMMdd-HHmmss"), $note.Extension
                )
            }
            try {
                Move-Item -LiteralPath $note.FullName -Destination $dest -ErrorAction Stop
                Log-Message "PARTIAL: $($note.Name) -> 60_Archive\_partial ($($result.Succeeded)/$($result.Attempted))"
                $partial++
            } catch {
                Log-Message "WARN: partial move failed for $($note.Name) :: $_"
                $failed++
            }
        }
        else {
            Log-Message "FAIL: all routes failed for $($note.Name) — left in inbox"
            $failed++
        }
    }

    Log-Message ("RUN SUMMARY: files={0} dispatched={1} partial={2} skipped={3} failed={4}" -f `
        $files.Count, $dispatched, $partial, $skipped, $failed)
}
catch {
    Log-Message "FATAL: $_"
    exit 1
}