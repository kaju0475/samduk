@echo off
cd /d "%~dp0"
echo Starting Silent Simulation...
echo Please ensure no VSCode terminals are active if possible.
echo Running...
node scripts/silent_sim.js
echo.
echo Simulation script has finished.
echo Check logs/sim_silent_status.txt for results.
pause
