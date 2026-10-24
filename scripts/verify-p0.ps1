# P0 acceptance check: live reading changes over time, and pause releases the microphone.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class P0Check {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@

[void][P0Check]::SetProcessDPIAware()

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

[void][P0Check]::SetForegroundWindow($handle)
Start-Sleep -Seconds 4

$client = New-Object P0Check+RECT
[void][P0Check]::GetClientRect($handle, [ref]$client)
$origin = New-Object P0Check+POINT
[void][P0Check]::ClientToScreen($handle, [ref]$origin)
$width = $client.Right - $client.Left
$height = $client.Bottom - $client.Top
$scale = $width / 420.0
Write-Host "client: ${width}x${height} at $($origin.X),$($origin.Y) scale=$([math]::Round($scale,3))"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Save-Shot([string]$name) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $width, $height))
  $path = Join-Path $OutDir $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Host "saved $path"
}

Save-Shot 'p0-a.png'
Start-Sleep -Seconds 3
Save-Shot 'p0-b.png'

# Mode switch: 232 CSS px wide, centred, top row. Reverse segment centre ~ (268, 72).
$xReverse = [int]($origin.X + 268 * $scale)
$yMode = [int]($origin.Y + 72 * $scale)
Write-Host "click reverse at $xReverse,$yMode"
[void][P0Check]::SetCursorPos($xReverse, $yMode)
Start-Sleep -Milliseconds 150
[P0Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 60
[P0Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Seconds 3
Save-Shot 'p0-c-reverse.png'

# Pause button: 40 CSS px round button at the left of the 68 px footer.
$x = [int]($origin.X + 40 * $scale)
$y = [int]($origin.Y + (640 - 34) * $scale)

function Click-Pause([string]$label) {
  Write-Host "click pause ($label) at $x,$y"
  [void][P0Check]::SetForegroundWindow($handle)
  [void][P0Check]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 250
  [P0Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [P0Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Seconds 2
}

Click-Pause 'pause'
Save-Shot 'p0-d-paused.png'
Click-Pause 'resume'
Save-Shot 'p0-e-resumed.png'

if (-not $process.HasExited) { $process.Kill() }
