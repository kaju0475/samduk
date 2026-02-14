$output = "git_deep_search.log"
"[START] Deep Search at $(Get-Date)" | Out-File $output -Encoding utf8

function log($msg) {
    Write-Host $msg
    $msg | Out-File $output -Append -Encoding utf8
}

log "--- 1. Searching AppData/Local ---"
$search1 = Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "git.exe" -Recurse -Depth 4 -ErrorAction SilentlyContinue
$search1 | Select-Object FullName | Out-String | log

log "--- 2. Searching AppData/Roaming ---"
$search2 = Get-ChildItem -Path "$env:AppData" -Filter "git.exe" -Recurse -Depth 4 -ErrorAction SilentlyContinue
$search2 | Select-Object FullName | Out-String | log

log "--- 3. Checking .git integrity ---"
if (Test-Path .git/config) {
    log ".git/config found. Reading..."
    try {
        $cfg = Get-Content .git/config -Raw
        log "Config Length: $($cfg.Length)"
        # Check for null bytes
        if ($cfg -match "\u0000") { log "WARNING: Null bytes detected in .git/config!" }
    } catch { log "Error reading config." }
}

log "--- 4. Checking Remote ---"
try {
    # Using raw cmd to avoid PS intercept
    cmd /c "git remote -v" 2>&1 | log
} catch {}

log "[END] Deep Search Completed."
