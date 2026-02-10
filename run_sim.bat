@echo off
node scripts/verify_integrity_100.js > logs/sim_bat_output.txt 2>&1
if %errorlevel% neq 0 (
    echo FAILURE > logs/sim_bat_status.txt
) else (
    echo SUCCESS > logs/sim_bat_status.txt
)
