@echo off
REM .next 폴더 강제 삭제 (관리자 권한)
REM 우클릭 -> "관리자 권한으로 실행"

echo =====================================
echo   .next 폴더 강제 삭제
echo =====================================
echo.

REM 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] 관리자 권한이 필요합니다!
    echo.
    echo 해결 방법:
    echo 1. 이 파일을 우클릭
    echo 2. "관리자 권한으로 실행" 선택
    echo.
    pause
    exit /b 1
)

echo [확인] 관리자 권한 OK
echo.

if exist ".next" (
    echo 발견: .next 폴더 존재함
    echo.
    
    echo 1단계: 읽기 전용 속성 제거 중...
    attrib -r -s -h ".next\*.*" /s /d >nul 2>&1
    
    echo 2단계: 강제 삭제 중...
    rd /s /q ".next" >nul 2>&1
    
    if not exist ".next" (
        echo.
        echo [성공] .next 폴더 완전 삭제!
        echo.
        echo 다음 단계:
        echo 1. VSCode 재시작
        echo 2. npm run build 실행
    ) else (
        echo.
        echo [오류] 여전히 삭제 실패
        echo.
        echo 최후의 수단:
        echo 1. 컴퓨터 재부팅
        echo 2. 재부팅 직후 이 파일 다시 실행 (관리자 권한)
    )
) else (
    echo [성공] .next 폴더가 이미 삭제되었습니다!
)

echo.
echo =====================================
echo.
pause
