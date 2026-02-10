@echo off
cd /d "%~dp0"
echo Starting Next.js Server Silently...
echo Output will be redirected to logs/server_silent.log
echo Do NOT close this window (you can minimize it).
npm run dev > logs/server_silent.log 2>&1
pause
