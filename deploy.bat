@echo off
setlocal
set "PROJECT_ROOT=%~dp0"
set "GIT_PATH=%PROJECT_ROOT%.agent\git\cmd"
set "PATH=%GIT_PATH%;%PATH%"

echo ==========================================
echo      Samduk System Deployment Helper
echo ==========================================

:: 1. Configure Identity (Critical for fresh git)
git config user.email "auto-deploy@samduk.system"
git config user.name "Samduk Auto Deploy"

:: 2. Ensure Branch
git checkout -b master 2>nul
git branch -M master

:: 3. Stage & Commit
echo [1/3] Adding files...
git add .

echo [2/3] Committing...
git commit -m "Auto-deploy via helper"

:: 4. Push
echo [3/3] Uploading...
echo.
echo [LOGIN REQUIRED] Please login in the browser/popup.
echo.
git push -u origin master

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Upload failed.
) else (
    echo.
    echo [SUCCESS] All Done!
)
pause
