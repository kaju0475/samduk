@echo off
chcp 65001 > nul
echo ==========================================
echo        SAMDUK UNIVERSAL GIT RESET
echo ==========================================

REM --- FORCE ROOT DIR ---
cd /d "%~dp0.."
echo [INFO] Working Directory: %CD%
REM ----------------------

echo [1/6] Searching for Git...

REM --- FORCE PATH INJECTION ---
set "PATH=%PATH%;C:\Program Files\Git\cmd"
set "PATH=%PATH%;C:\Program Files\Git\bin"
set "PATH=%PATH%;C:\Program Files (x86)\Git\cmd"
set "PATH=%PATH%;C:\Program Files (x86)\Git\bin"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Git\cmd"
set "PATH=%PATH%;%USERPROFILE%\AppData\Local\Programs\Git\cmd"
REM ----------------------------

git --version
if %ERRORLEVEL% NEQ 0 goto INSTALL_GIT

echo [OK] Git found!
goto CONTINUE

:INSTALL_GIT
    echo [CRITICAL ERROR] Git checking failed.
    echo Git cannot be found in any standard folder.
    
    echo [AUTO-FIX] Initiating Git Installer Download...
    powershell -ExecutionPolicy Bypass -File "%~dp0download_git_installer.ps1"
    
    echo.
    echo [ACTION REQUIRED]
    echo 1. The Git Installer has been launched.
    echo 2. Please complete the installation (Click Next - Next - Finish).
    echo 3. AFTER installation, press any key to restart this script.
    pause
    
    REM Restart script
    "%~f0"
    exit /b

:CONTINUE
    echo [2/6] Killing Zombies...
taskkill /F /IM git.exe /T > nul 2>&1

echo [3/6] Wiping .git...
rd /s /q .git > nul 2>&1
if exist .git (
    echo [ERROR] Failed to delete .git. Close VS Code and try again.
    pause
    exit /b 1
)

echo [4/6] Re-init...
git init
git config user.email "bot@samduk.com"
git config user.name "Samduk Bot"
git config credential.helper ""

echo [5/6] Committing local state...
git add .
git commit -m "feat: System Fresh Start (Universal Fix)"

echo [6/6] Force Pushing...
set REMOTE=https://YOUR_GITHUB_TOKEN@github.com/kaju0475/samduk.git
git remote add origin %REMOTE%
git push -u origin main --force

if %ERRORLEVEL% equ 0 (
    echo.
    echo ==========================================
    echo      SUCCESS! SYSTEM NORMALIZED.
    echo ==========================================
) else (
    echo.
    echo [ERROR] Push failed. Check internet.
)
pause
