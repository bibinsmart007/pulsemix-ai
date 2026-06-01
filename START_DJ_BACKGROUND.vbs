Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\user\ANTIGRAVITY1\public"
WshShell.Run "python -m http.server 8080", 0
WScript.Sleep 1000
WshShell.Run "http://localhost:8080/dj_live.html"
Set WshShell = Nothing
