#!/usr/bin/env pwsh
# Kill all Node.js and Playwright processes

Write-Host "🔄 Killing all Node.js and Playwright processes..." -ForegroundColor Yellow

# Kill Node processes
Get-Process | Where-Object {
    $_.ProcessName -like "*node*"
} | ForEach-Object {
    Write-Host "  Killing: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Kill Playwright processes
Get-Process | Where-Object {
    $_.ProcessName -like "*playwright*" -or
    $_.ProcessName -like "*chrome*" -or
    $_.ProcessName -like "*firefox*"
} | ForEach-Object {
    Write-Host "  Killing: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "✅ All processes killed successfully!" -ForegroundColor Green
