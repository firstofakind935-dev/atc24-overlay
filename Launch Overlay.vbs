Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d """ & Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\")) & """ && npx electron .", 0, False
