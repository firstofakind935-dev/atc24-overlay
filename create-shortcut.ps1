$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\nilam\Desktop\ATC24 Overlay.lnk")
$Shortcut.TargetPath = "C:\Users\nilam\flight plan generator\node_modules\electron\dist\electron.exe"
$Shortcut.WorkingDirectory = "C:\Users\nilam\flight plan generator"
$Shortcut.Arguments = "."
$Shortcut.Description = "ATC24 Flight Plan Generator Overlay"
$Shortcut.IconLocation = "C:\Users\nilam\flight plan generator\node_modules\electron\dist\electron.exe,0"
$Shortcut.Save()
Write-Host "Shortcut created on Desktop!"
