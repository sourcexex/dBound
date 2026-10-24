# Capture the settings pages of the debug build (CSS coords are mapped to the client area).
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Grab {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@

[void][Grab]::SetProcessDPIAware()

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$handle = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  $process.Refresh()
  if ($process.HasExited) { break }
  if ($process.MainWindowHandle -ne [IntPtr]::Zero) { $handle = $process.MainWindowHandle; break }
}
if ($handle -eq [IntPtr]::Zero) { Write-Host 'WINDOW NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }

[void][Grab]::SetForegroundWindow($handle)
Start-Sleep -Seconds 4

$client = New-Object Grab+RECT
[void][Grab]::GetClientRect($handle, [ref]$client)
$origin = New-Object Grab+POINT
[void][Grab]::ClientToScreen($handle, [ref]$origin)
$width = $client.Right - $client.Left
$height = $client.Bottom - $client.Top
$scale = $width / 420.0
Write-Host "client ${width}x${height} origin $($origin.X),$($origin.Y) scale $([math]::Round($scale,3))"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Save-Shot([string]$name) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $width, $height))
  $path = Join-Path $OutDir $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Host "saved $name"
}

function Click-At([double]$cssX, [double]$cssY) {
  $x = [int]($origin.X + $cssX * $scale)
  $y = [int]($origin.Y + $cssY * $scale)
  [void][Grab]::SetForegroundWindow($handle)
  [void][Grab]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 180
  [Grab]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [Grab]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

Save-Shot 'p2-main.png'

# Gear button in the title bar (settings, minimise, close from the right).
Click-At 342 24
Start-Sleep -Milliseconds 500
Save-Shot 'p2-settings-mode.png'

# Settings tabs: 模式 / 级别 / 校准 / 设备 / 系统
Click-At 132 62
Save-Shot 'p2-settings-levels.png'
Click-At 150 253
Save-Shot 'p2-settings-levels-expanded.png'
Click-At 210 62
Save-Shot 'p2-settings-calibration.png'
Click-At 210 462
Start-Sleep -Seconds 5
Save-Shot 'p2-calibration-done.png'
Click-At 288 62
Save-Shot 'p2-settings-devices.png'
Click-At 365 62
Save-Shot 'p2-settings-system.png'

if (-not $process.HasExited) { $process.Kill() }
