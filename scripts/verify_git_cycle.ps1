$ErrorActionPreference = "Stop"
$gitPath = "$PSScriptRoot\..\.agent\git\cmd"
$env:PATH = "$gitPath;" + $env:PATH

function Test-GitCommand {
    param($command, $description)
    Write-Host "TEST: $description..." -NoNewline
    try {
        Invoke-Expression $command | Out-Null
        Write-Host " [PASS]" -ForegroundColor Green
    } catch {
        Write-Host " [FAIL]" -ForegroundColor Red
        Write-Host $_
        exit 1
    }
}

Write-Host "=== STARTING GIT CYCLE VERIFICATION ==="

# 1. Environment Check
Test-GitCommand "git --version" "Checking Git Version"
Test-GitCommand "git status" "Checking Repository Status"

# 2. CRUD Operation - Create
$testFile = "GIT_VERIFICATION_TOKEN.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Set-Content -Path $testFile -Value "Verification Token: $timestamp"
Write-Host "Created test file: $testFile"

# 3. Stage & Commit
Test-GitCommand "git add $testFile" "Staging Test File"
Test-GitCommand "git commit -m 'chore: git verification cycle test [skip ci]'" "Committing Test File"

# 4. Push (Write Access)
Write-Host "TEST: Pushing to Remote (Write Access)..." 
# Use standard system credential manager or existing auth
git push origin master
if ($LASTEXITCODE -eq 0) {
    Write-Host " [PASS]" -ForegroundColor Green
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    exit 1
}

# 5. Fetch (Read Access)
Test-GitCommand "git fetch origin" "Fetching from Remote (Read Access)"

# 6. Cleanup
Remove-Item -Path $testFile -Force
Test-GitCommand "git add $testFile" "Staging Cleanup"
Test-GitCommand "git commit -m 'chore: cleanup verification token [skip ci]'" "Committing Cleanup"
Test-GitCommand "git push origin master" "Pushing Cleanup"

Write-Host "=== VERIFICATION COMPLETE: ALL SYSTEMS NOMINAL ==="
