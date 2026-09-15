# overnight-debug.ps1
# Place in the root of 'Source'

$Model      = "qwen7b-fit"
$TargetDir  = "."
$OutputDir  = ".\debug_reports"
$Extensions = @('.ts', '.tsx', '.js', '.mjs')
$MaxBytes   = 60000   # Skip files larger than this (context safety)

$IgnoredDirNames = @(
    'node_modules', '.next', '.wrangler', '.cursor', '.vscode',
    '.git', 'debug_reports', 'dist', 'build'
)
$SegmentPattern = '[\\/](?:' + 
    (($IgnoredDirNames | ForEach-Object { [regex]::Escape($_) }) -join '|') + 
    ')(?:[\\/]|$)'

# --- Preflight: Is Ollama responding? ---
try {
    Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 | Out-Null
} catch {
    Write-Host "Ollama is not reachable at http://localhost:11434 — start it first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$Files = Get-ChildItem -Path $TargetDir -Recurse -File |
    Where-Object {
        $Extensions -contains $_.Extension -and
        $_.Name -ne "overnight-debug.ps1" -and
        $_.FullName -notmatch $SegmentPattern
    }

$FileCount = @($Files).Count
if ($FileCount -eq 0) {
    Write-Host "No matching source files found to audit." -ForegroundColor Red
    exit
}

Write-Host "Discovered $FileCount source files. Starting overnight audit..." -ForegroundColor Cyan

$Fence = '```'

foreach ($File in $Files) {
    $Timestamp = Get-Date -Format "HH:mm:ss"
    
    # Safely extract relative path
    $RelPath = $File.FullName.Substring($PWD.Path.Length).TrimStart('\', '/')
    Write-Host "[$Timestamp] Auditing: $RelPath" -ForegroundColor Yellow

    if ($File.Length -gt $MaxBytes) {
        Write-Host "Skipping (too large: $($File.Length) bytes)" -ForegroundColor DarkYellow
        continue
    }

    $Code = Get-Content -Path $File.FullName -Raw
    if ([string]::IsNullOrWhiteSpace($Code)) {
        Write-Host "Skipping empty file." -ForegroundColor DarkGray
        continue
    }

    $SystemPrompt = @"
You are an expert static code analysis and debugging assistant.
Thoroughly analyse the provided TypeScript/JavaScript code.
Identify:
1. Logic defects, edge cases, and unhandled promise/async failures.
2. Race conditions, state mutation bugs, or memory leaks.
3. Security flaws (e.g., Supabase RLS bypasses, credential leakage, improper input sanitisation).
4. Concrete refactored code fixes with concise explanations.
Keep feedback directly actionable, commercially disciplined, and technically rigorous.
"@

    $UserPrompt = @"
File: $($File.Name)
Path: $($File.FullName)

$Fence`ntypescript`n$Code`n$Fence
"@

    $PayloadJson = @{
        model    = $Model
        messages = @(
            @{ role = "system"; content = $SystemPrompt },
            @{ role = "user";   content = $UserPrompt   }
        )
        stream   = $false
        options  = @{
            temperature = 0.2
            num_ctx     = 16384
        }
    } | ConvertTo-Json -Depth 5

    # Force UTF-8 encoding to prevent Windows PowerShell 5.1 ISO-8859-1 corruption
    $PayloadBytes = [System.Text.Encoding]::UTF8.GetBytes($PayloadJson)

    try {
        $Response = Invoke-RestMethod -Uri "http://localhost:11434/api/chat" `
                                      -Method Post `
                                      -ContentType "application/json; charset=utf-8" `
                                      -Body $PayloadBytes `
                                      -TimeoutSec 600

        $CleanName  = ($RelPath -replace '[\\/]', '_') -replace '\.[^.]+$', ''
        $OutputFile = Join-Path $OutputDir ("DEBUG_" + $CleanName + ".md")

        $ReportContent = "# Audit Report: $($File.Name)`n`nPath: ``$($File.FullName)```n`n" + 
                         $Response.message.content
        Set-Content -Path $OutputFile -Value $ReportContent -Encoding utf8
        Write-Host "Report saved -> $OutputFile" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to audit $($File.Name): $_" -ForegroundColor Red
    }
}

Write-Host "Audit completed. Reports generated in $OutputDir" -ForegroundColor Cyan