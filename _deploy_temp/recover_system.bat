@echo off
chcp 65001
echo ==============================================
echo [삼덕가스공업] 긴급 복구 시스템
echo ==============================================
echo.
echo 시스템이 데이터 손실 방지를 위해 정지되었습니다.
echo 가장 최근의 안전한 백업 데이터로 복구를 시도합니다.
echo.
pause
echo.
echo 복구 중...
node restore-db.js
echo.
if %errorlevel% equ 0 (
    echo [성공] 복구가 완료되었습니다. 서버를 다시 시작해주세요.
    echo (이 창은 닫으셔도 됩니다.)
) else (
    echo [실패] 복구에 실패했습니다. 관리자에게 문의하세요.
)
pause
