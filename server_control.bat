@echo off
chcp 65001 > nul
setlocal

:: 프로젝트 경로 설정 (절대 경로)
set "PROJECT_DIR=c:\Users\new\Desktop\삼덕용기\samduk-system"

:MENU
cls
echo ====================================================
echo    Samduk System Server Control
echo ====================================================
echo.
echo    1. Start Server (서버 시작)
echo    2. Stop Server (서버 종료)
echo    3. Restart Server (서버 재시작)
echo    4. Exit (나가기)
echo.
echo    Current Dir: %PROJECT_DIR%
echo ====================================================
set /p choice="Select an option (1-4): "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto RESTART
if "%choice%"=="4" goto EXIT
goto MENU

:START
echo.
echo Starting server...
cd /d "%PROJECT_DIR%"
if %errorlevel% neq 0 (
    echo Error: Could not find project directory.
    echo Path: %PROJECT_DIR%
    pause
    goto MENU
)

:: 새 창에서 실행 및 유지
start "Samduk Server" cmd /k "echo Server launching... && npm run dev"
echo Server started in a new window.
timeout /t 2 > nul
goto MENU

:STOP
echo.
echo Stopping all Node.js processes (Server clean up)...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% equ 0 (
    echo All Node.js processes have been stopped.
) else (
    echo No Node.js processes were running.
)
echo Server stopped.
pause
goto MENU

:RESTART
echo.
echo Restarting server...
call :STOP
timeout /t 2 > nul
goto START

:EXIT
endlocal
exit
