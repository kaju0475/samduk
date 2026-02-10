@echo off
echo [SAFE BUILD] Starting build process... > build_status.txt
echo [SAFE BUILD] Log will be saved to build.log >> build_status.txt

cmd /c "npm run build" > build.log 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [SAFE BUILD] Build SUCCESS! >> build_status.txt
) else (
    echo [SAFE BUILD] Build FAILED with code %ERRORLEVEL% >> build_status.txt
)
