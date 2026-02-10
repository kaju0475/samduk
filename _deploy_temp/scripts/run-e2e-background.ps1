# E2E 테스트 백그라운드 실행 스크립트
# 멈춤 현상 없이 테스트를 실행합니다

Write-Host "=== E2E 테스트 백그라운드 실행 ===" -ForegroundColor Cyan

# 1. 개발 서버 확인
Write-Host "`n[1/3] 개발 서버 확인 중..." -ForegroundColor Yellow
$devServer = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*3000*" -or $_.CommandLine -like "*dev*" }

if (-not $devServer) {
    Write-Host "⚠️  개발 서버가 실행 중이 아닙니다!" -ForegroundColor Red
    Write-Host "먼저 개발 서버를 실행하세요: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 개발 서버 실행 중 (PID: $($devServer.Id))" -ForegroundColor Green

# 2. 이전 Playwright 프로세스 정리
Write-Host "`n[2/3] 이전 테스트 프로세스 정리 중..." -ForegroundColor Yellow
Get-Process -Name "playwright*", "chromium*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "✅ 정리 완료" -ForegroundColor Green

# 3. 백그라운드에서 테스트 실행
Write-Host "`n[3/3] 테스트 백그라운드 실행 중..." -ForegroundColor Yellow
Write-Host "📝 결과는 test-results.txt에 저장됩니다" -ForegroundColor Cyan

$job = Start-Job -ScriptBlock {
    param($projectPath)
    Set-Location $projectPath
    npx playwright test e2e/security_and_search.spec.ts --reporter=list --timeout=30000 2>&1
} -ArgumentList (Get-Location).Path

Write-Host "✅ 테스트 시작됨 (Job ID: $($job.Id))" -ForegroundColor Green
Write-Host "`n진행 상황 확인: " -ForegroundColor Cyan
Write-Host "  Get-Job $($job.Id) | Receive-Job -Keep" -ForegroundColor White
Write-Host "`n테스트 완료 대기: " -ForegroundColor Cyan
Write-Host "  Wait-Job $($job.Id); Receive-Job $($job.Id) | Out-File test-results.txt" -ForegroundColor White

# 30초 동안 진행 상황 모니터링
Write-Host "`n⏳ 30초 동안 진행 상황 모니터링..." -ForegroundColor Yellow
for ($i = 1; $i -le 6; $i++) {
    Start-Sleep -Seconds 5
    $status = Get-Job $job.Id
    Write-Host "  [$i/6] 상태: $($status.State)" -ForegroundColor Gray
    
    if ($status.State -eq "Completed" -or $status.State -eq "Failed") {
        break
    }
}

# 결과 확인
$finalStatus = Get-Job $job.Id
if ($finalStatus.State -eq "Completed") {
    Write-Host "`n✅ 테스트 완료!" -ForegroundColor Green
    $result = Receive-Job $job.Id
    Write-Host $result
    $result | Out-File "test-results.txt"
    Write-Host "`n📄 결과 저장됨: test-results.txt" -ForegroundColor Cyan
} elseif ($finalStatus.State -eq "Running") {
    Write-Host "`n⏳ 테스트가 아직 실행 중입니다..." -ForegroundColor Yellow
    Write-Host "완료 대기: Wait-Job $($job.Id); Receive-Job $($job.Id)" -ForegroundColor White
} else {
    Write-Host "`n❌ 테스트 실패" -ForegroundColor Red
    Receive-Job $job.Id
}

Write-Host "`n=== 완료 ===" -ForegroundColor Cyan
