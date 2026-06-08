Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(22, 27, 34))
$font = New-Object System.Drawing.Font('Segoe UI', 100, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(88, 166, 255))
$g.DrawString('A', $font, $brush, 55, 70)
$bmp.Save('icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host 'done'
