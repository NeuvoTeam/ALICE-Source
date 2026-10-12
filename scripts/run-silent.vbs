Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""D:\Work\Neuvo\ALICE\Source\scripts\dispatch-inbox.ps1""", 0, False
