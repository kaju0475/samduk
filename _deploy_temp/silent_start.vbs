Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c npm run dev > logs/server_silent.log 2>&1", 0, False
