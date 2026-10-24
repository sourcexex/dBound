# Launch the debug build, grab a pixel-accurate shot of the dBound window, then close it.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$Out = 'D:\Project\Tauri\dBound\output\screenshots\p0-main.png',
  [int]$WaitSeconds = 12
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Screenshot {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();
}
"@

[void][Win32Screenshot]::SetProcessDPIAware()

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal

$handle = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  $process.Refresh()
  if ($process.HasExited) { break }
  if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
    $handle = $process.MainWindowHandle
    break
  }
}

if ($handle -eq [IntPtr]::Zero) {
  Write-Host 'WINDOW NOT FOUND'
  if (-not $process.HasExited) { $process.Kill() }
  exit 1
}

[void][Win32Screenshot]::ShowWindow($handle, 5)
[void][Win32Screenshot]::SetForegroundWindow($handle)
Start-Sleep -Seconds 4

$rect = New-Object Win32Screenshot+RECT
[void][Win32Screenshot]::GetWindowRect($handle, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
Write-Host "window rect: $($rect.Left),$($rect.Top) ${width}x${height}"

$dir = Split-Path -Parent $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $width, $height))
$bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Host "saved $Out"

if (-not $process.HasExited) { $process.Kill() }
