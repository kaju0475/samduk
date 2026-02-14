# .next 폴더 강제 삭제 스크립트 (관리자 권한)
# 사용법: 우클릭 → "관리자 권한으로 실행"

Write-Host "=====================================" -ForegroundColor Red
Write-Host "  .next 폴더 강제 삭제 (관리자)" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Red
Write-Host ""

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 오류: 관리자 권한이 필요합니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "해결 방법:" -ForegroundColor Yellow
    Write-Host "1. 이 파일을 우클릭" -ForegroundColor White
    Write-Host "2. '관리자 권한으로 실행' 선택" -ForegroundColor White
    Write-Host ""
    Write-Host "아무 키나 누르면 종료됩니다..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

Write-Host "✅ 관리자 권한 확인됨" -ForegroundColor Green
Write-Host ""

$nextFolder = Join-Path $PSScriptRoot ".next"

if (Test-Path $nextFolder) {
    Write-Host "발견: .next 폴더 존재함" -ForegroundColor Green
    Write-Host "경로: $nextFolder" -ForegroundColor Gray
    Write-Host ""
    
    try {
        Write-Host "1단계: 읽기 전용 속성 제거 중..." -ForegroundColor Yellow
        Get-ChildItem -Path $nextFolder -Recurse -Force | ForEach-Object {
            try {
                $_.Attributes = 'Normal'
            }
            catch {
                # 무시
            }
        }
        
        Write-Host "2단계: 강제 삭제 중..." -ForegroundColor Yellow
        Remove-Item -Path $nextFolder -Recurse -Force -ErrorAction Stop
        
        Write-Host ""
        Write-Host "✅ 성공: .next 폴더 완전 삭제!" -ForegroundColor Green
        Write-Host ""
        Write-Host "다음 단계:" -ForegroundColor Cyan
        Write-Host "1. VSCode 재시작" -ForegroundColor White
        Write-Host "2. 새 터미널에서 'npm run build' 실행" -ForegroundColor White
        Write-Host ""
    }
    catch {
        Write-Host ""
        Write-Host "❌ 오류: 여전히 삭제 실패" -ForegroundColor Red
        Write-Host "원인: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "최후의 수단:" -ForegroundColor Yellow
        Write-Host "1. 컴퓨터 재부팅" -ForegroundColor White
        Write-Host "2. 재부팅 직후 이 스크립트 다시 실행 (관리자 권한)" -ForegroundColor White
        Write-Host ""
    }
}
else {
    Write-Host "✅ .next 폴더가 이미 삭제되었습니다!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "=====================================" -ForegroundColor Red
Write-Host ""
Write-Host "아무 키나 누르면 종료됩니다..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
