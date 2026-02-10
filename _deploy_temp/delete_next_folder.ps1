# .next 폴더 삭제 스크립트
# 사용법: 이 파일을 우클릭 → "PowerShell로 실행" 또는 더블클릭

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  .next 폴더 삭제 스크립트" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$nextFolder = Join-Path $PSScriptRoot ".next"

if (Test-Path $nextFolder) {
    Write-Host "발견: .next 폴더 존재함" -ForegroundColor Green
    Write-Host "경로: $nextFolder" -ForegroundColor Gray
    Write-Host ""
    
    try {
        Write-Host "삭제 중..." -ForegroundColor Yellow
        Remove-Item -Path $nextFolder -Recurse -Force -ErrorAction Stop
        Write-Host ""
        Write-Host "✅ 성공: .next 폴더 삭제 완료!" -ForegroundColor Green
        Write-Host ""
        Write-Host "다음 단계:" -ForegroundColor Cyan
        Write-Host "1. VSCode 재시작" -ForegroundColor White
        Write-Host "2. 새 터미널에서 'npm run build' 실행" -ForegroundColor White
        Write-Host ""
    }
    catch {
        Write-Host ""
        Write-Host "❌ 오류: 삭제 실패" -ForegroundColor Red
        Write-Host "원인: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "해결 방법:" -ForegroundColor Yellow
        Write-Host "1. VSCode 완전 종료" -ForegroundColor White
        Write-Host "2. 이 스크립트 다시 실행" -ForegroundColor White
        Write-Host "3. 여전히 실패 시 → 컴퓨터 재부팅 후 재시도" -ForegroundColor White
        Write-Host ""
    }
}
else {
    Write-Host "ℹ️  .next 폴더가 없습니다." -ForegroundColor Yellow
    Write-Host "이미 삭제되었거나 아직 빌드를 한 번도 안 한 상태입니다." -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "아무 키나 누르면 종료됩니다..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
