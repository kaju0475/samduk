@echo off
echo [SERVER START] Launching production server... > server_status.txt
echo [SERVER START] Logs will be saved to server.log >> server_status.txt

cmd /c "npm run start" > server.log 2>&1
