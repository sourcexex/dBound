# Demo: readout animation settings + calmer rolling (600ms roll, 1s refresh default).
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [int]$Frames = 8,
  [int]$IntervalMs = 250
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class RCheck {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int data, UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][RCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [RCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [RCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][RCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][RCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][RCheck]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Save-Rect([int]$x, [int]$y, [int]$w, [int]$h, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $process.Refresh()
  if ($process.HasExited) { break }
  $main = Find-Window $process.Id 'dBound'
  if ($main -ne [IntPtr]::Zero) { break }
}
if ($main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }
[void][RCheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object RCheck+RECT
[void][RCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object RCheck+POINT
[void][RCheck]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][RCheck]::SetForegroundWindow($main)
  [void][RCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [RCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [RCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

# Settings -> scroll down to the 数字显示 card -> screenshot
Click-Css 342 24
Start-Sleep -Milliseconds 600
[void][RCheck]::SetCursorPos([int]($origin.X + 210 * $scale), [int]($origin.Y + 420 * $scale))
Start-Sleep -Milliseconds 200
[RCheck]::mouse_event(0x0800, 0, 0, -720, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 600
Save-Rect $origin.X $origin.Y $w $h 'readout-settings.png'

# Back to main and capture the calmer rolling
Click-Css 30 24
Start-Sleep -Milliseconds 800
for ($i = 0; $i -lt $Frames; $i++) {
  Save-Rect $origin.X $origin.Y $w $h ("roll-main-{0}.png" -f $i)
  Start-Sleep -Milliseconds $IntervalMs
}

# Fullscreen burst
[void][RCheck]::SetForegroundWindow($main)
[RCheck]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[RCheck]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Seconds 3
$full = Find-Window $process.Id 'dBound Fullscreen'
if ($full -ne [IntPtr]::Zero) {
  $rect = New-Object RCheck+RECT
  [void][RCheck]::GetWindowRect($full, [ref]$rect)
  for ($i = 0; $i -lt $Frames; $i++) {
    Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) ("roll-full-{0}.png" -f $i)
    Start-Sleep -Milliseconds $IntervalMs
  }
  [void][RCheck]::SetForegroundWindow($full)
  Start-Sleep -Milliseconds 300
  [RCheck]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [RCheck]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
}

Start-Sleep -Milliseconds 400
if (-not $process.HasExited) { $process.Kill() }
Write-Host 'demo frames captured'
