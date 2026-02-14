# Git Factory Reset Tool - "Fresh Start"
# 이 스크립트는 꼬여버린 .git 폴더를 완전히 삭제하고, 
# 현재 로컬 코드를 기준으로 새로 저장소를 초기화하여 GitHub에 강제로 맞춥니다.

$token = "YOUR_GITHUB_TOKEN"
$repo = "github.com/kaju0475/samduk.git"
$remoteUrl = "https://$token@$repo"

Write-Host "============================" -ForegroundColor Cyan
Write-Host "  SAMDUK GIT FACTORY RESET" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "주의: 이 작업은 .git 폴더를 삭제하고 새로 만듭니다." -ForegroundColor Yellow
Write-Host "현재 로컬 파일(Mutex 수정 포함)을 기준으로 서버를 덮어씁니다." -ForegroundColor Yellow
Write-Host "3초 뒤 시작합니다..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# 1. Kill Zombie Processes
Write-Host "[1/5] Git 프로세스 정리 중..."
try {
    Stop-Process -Name "git" -Force -ErrorAction SilentlyContinue
    Write-Host "  - 완료" -ForegroundColor Green
} catch {}

# 2. Delete .git folder
Write-Host "[2/5] 손상된 .git 폴더 삭제 중..."
if (Test-Path .git) {
    Remove-Item .git -Recurse -Force -ErrorAction SilentlyContinue
    # Windows CMD를 이용한 강제 삭제 (PowerShell이 실패할 경우 대비)
    cmd /c "rmdir /s /q .git" > $null 2>&1
    Write-Host "  - 완료" -ForegroundColor Green
} else {
    Write-Host "  - .git 폴더가 이미 없습니다." -ForegroundColor Green
}

# 3. Path Hunting & Re-init
Write-Host "[3/5] Git 초기화 및 파일 추가..."

# --- Git Hunting Logic Start ---
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
    Write-Host "[ERROR] Git을 찾을 수 없습니다. Git Bash에서 실행해 주세요." -ForegroundColor Red
    pause
    exit 1
}
Write-Host "[OK] Git 경로: $gitPath" -ForegroundColor Green
function git_exec { param($args_list) Invoke-Expression "$gitPath $args_list" }
# --- Git Hunting Logic End ---

git_exec "init" > $null
git_exec "config user.email `"bot@samduk.com`"" > $null
git_exec "config user.name `"Samduk Bot`"" > $null
git_exec "config credential.helper `"`"" > $null

git_exec "add ." > $null
git_exec "commit -m `"feat: complete system refresh (Mutex + Vercel Fixes)`"" > $null

# 4. Force Push
Write-Host "[4/5] GitHub 연결 및 강제 업로드..." -ForegroundColor Yellow
git_exec "remote add origin $remoteUrl" > $null
git_exec "push -u origin main --force"

# 5. Finish
if ($LASTEXITCODE -eq 0) {
    Write-Host "============================" -ForegroundColor Green
    Write-Host "  성공! 환경이 초기화되었습니다." -ForegroundColor Green
    Write-Host "  이제 'git commit' 멈춤 현상이 사라졌을 것입니다." -ForegroundColor Green
    Write-Host "============================" -ForegroundColor Green
} else {
    Write-Host "[ERROR] 업로드 실패. 인터넷 연결을 확인하세요." -ForegroundColor Red
}
pause
