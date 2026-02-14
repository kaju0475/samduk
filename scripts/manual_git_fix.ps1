$token = "YOUR_GITHUB_TOKEN"
$repo = "github.com/kaju0475/samduk.git"
$remoteUrl = "https://$token@$repo"

Write-Host "============================" -ForegroundColor Cyan
Write-Host "  SAMDUK GIT REPAIR TOOL" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# 1. Git 경로 찾기 (Aggressive Hunting)
$gitPath = "git" # Default
$candidates = @(
    "git",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe",
    "C:\Git\cmd\git.exe"
)

$found = $false
foreach ($c in $candidates) {
    try {
        if ($c -eq "git") {
            git --version > $null 2>&1
            if ($LASTEXITCODE -eq 0) { $found = $true; break }
        } elseif (Test-Path $c) {
            $gitPath = "& '$c'"
            $found = $true
            break
        }
    } catch {}
}

if (-not $found) {
    Write-Host "[ERROR] 시스템 어디에서도 Git을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "Git이 설치되어 있는지 확인하거나, Git Bash를 사용해 보세요."
    pause
    exit 1
}

Write-Host "[OK] Git을 찾았습니다: $gitPath" -ForegroundColor Green
function git_exec { param($args_list) Invoke-Expression "$gitPath $args_list" }

# 2. Configure
git_exec "config --local user.email `"bot@samduk.com`"" > $null
git_exec "config --local user.name `"Samduk Bot`"" > $null
git_exec "config --local credential.helper `"`"" > $null

# 3. Reset
Write-Host "[ACTION] 리포지토리 초기화 중..." -ForegroundColor Yellow
if (Test-Path .git/index.lock) { Remove-Item .git/index.lock -Force }
git_exec "rm -r --cached ." > $null 2>&1
git_exec "add ." > $null
git_exec "commit -m `"fix: manual repair push`"" > $null

# 4. Push
Write-Host "[ACTION] GitHub로 푸시 중..." -ForegroundColor Yellow
git_exec "remote set-url origin $remoteUrl" > $null
git_exec "push -f origin main"

if ($LASTEXITCODE -eq 0) {
    Write-Host "============================" -ForegroundColor Green
    Write-Host "  SUCCESS! SYSTEM FIXED" -ForegroundColor Green
    Write-Host "  Go to GitHub Actions to see the Backup Workflow running." -ForegroundColor Green
    Write-Host "============================" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Push Failed. Check internet connection." -ForegroundColor Red
}
pause
