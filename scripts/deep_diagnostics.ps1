# Deep Diagnostics for Git
$output = "git_forensics.log"
"[START] Git Forensics at $(Get-Date)" | Out-File $output -Encoding utf8

function log($msg) {
    Write-Host $msg
    $msg | Out-File $output -Append -Encoding utf8
}

log "--- 1. Registry Check ---"
try {
    $reg = Get-ItemProperty HKLM:\SOFTWARE\GitForWindows -ErrorAction SilentlyContinue
    log "HKLM Git: $($reg.InstallPath)"
} catch {}
try {
    $reg = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\GitForWindows" -ErrorAction SilentlyContinue
    log "HKLM (x64) Git: $($reg.InstallPath)"
} catch {}


log "--- 2. Path Environment Variables ---"
log "Machine PATH: $( [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') )"
log "User PATH: $( [System.Environment]::GetEnvironmentVariable('PATH', 'User') )"

log "--- 3. Running Processes (Git Related) ---"
Get-Process | Where-Object { $_.Name -match "git" -or $_.Name -match "ssh" } | Select-Object Name, Id, Path | Out-String | log

log "--- 4. Directory Check ---"
log "Current Directory: $pwd"
if (Test-Path .git) {
    log ".git folder exists."
    if (Test-Path .git/index.lock) { log "CRITICAL: index.lock found!" }
}

log "--- 5. Command Search ---"
try {
    $where = where.exe git
    log "Where git: $where"
} catch {
    log "Where git failed."
}

log "[END] Forensics Completed."
