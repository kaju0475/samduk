# .next 폴더 즉시 삭제 스크립트
$nextPath = ".next"

Write-Host "====================================="
Write-Host "  .next 폴더 강제 삭제 시작"
Write-Host "====================================="
Write-Host ""

if (Test-Path $nextPath) {
    Write-Host "발견: .next 폴더 존재함"
    Write-Host ""
    
    Write-Host "1단계: 읽기 전용 속성 제거 중..."
    Get-ChildItem -Path $nextPath -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $_.Attributes = 'Normal'
        } catch {}
    }
    
    Write-Host "2단계: 강제 삭제 중..."
    Remove-Item -Path $nextPath -Recurse -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 1
    
    if (-not (Test-Path $nextPath)) {
        Write-Host ""
        Write-Host "[성공] .next 폴더 완전 삭제!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[오류] 삭제 실패" -ForegroundColor Red
    }
} else {
    Write-Host "[성공] .next 폴더가 이미 없습니다!" -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================="
