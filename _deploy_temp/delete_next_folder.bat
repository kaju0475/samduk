@echo off
REM .next 폴더 삭제 배치 파일
REM 더블클릭으로 실행 가능

echo =====================================
echo   .next 폴더 삭제 스크립트
echo =====================================
echo.

if exist ".next" (
    echo 발견: .next 폴더 존재함
    echo 삭제 중...
    echo.
    
    rd /s /q ".next"
    
    if not exist ".next" (
        echo [성공] .next 폴더 삭제 완료!
        echo.
        echo 다음 단계:
        echo 1. VSCode 재시작
        echo 2. 새 터미널에서 'npm run build' 실행
    ) else (
        echo [오류] 삭제 실패
        echo.
        echo 해결 방법:
        echo 1. VSCode 완전 종료
        echo 2. 이 파일 다시 실행
        echo 3. 여전히 실패 시 컴퓨터 재부팅 후 재시도
    )
) else (
    echo [알림] .next 폴더가 없습니다.
    echo 이미 삭제되었거나 아직 빌드를 한 번도 안 한 상태입니다.
)

echo.
echo =====================================
echo.
pause
