@echo off
chcp 65001
echo ==========================================
echo 🚀 안전 배포 시스템 (Safe Deploy System)
echo ==========================================
echo.

echo 1️⃣ [백업] Supabase 데이터 내려받는 중...
node scripts/backup-from-supabase.js
if %errorlevel% neq 0 (
    echo ❌ 백업 실패! 배포를 중단합니다.
    pause
    exit /b %errorlevel%
)
echo.

echo 2️⃣ [배포] Vercel 배포 시작...
echo (로그인 요청 시 브라우저에서 승인해주세요)
echo.
call npx vercel --prod
echo.

echo ==========================================
echo ✅ 모든 작업이 완료되었습니다.
echo ==========================================
pause
