# Download Git Installer
$url = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"
$desktop = [Environment]::GetFolderPath("Desktop")
$out = "$desktop\Git-Installer.exe"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Downloading Git for Windows..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Host "Download Success!" -ForegroundColor Green
    Write-Host "File saved to: $out" -ForegroundColor Green
    Write-Host "Launching Installer..." -ForegroundColor Yellow
    Start-Process $out
} catch {
    Write-Host "Download Failed. Please download manually from git-scm.com" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
