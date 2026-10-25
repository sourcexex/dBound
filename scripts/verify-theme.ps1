# Theme & dark mode demo helper.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [switch]$OnlySettings,
  [int]$Scroll = 0,
  [string]$Shot = 'theme-settings.png'
)

$ErrorActionPreference = 'Stop'
reg add 'HKCU\Software\dBound' /v License /t REG_SZ /d 1 /f | Out-Null
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class TCheck {
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
[void][TCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [TCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [TCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][TCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][TCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][TCheck]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Save-Rect([int]$x, [int]$y, [int]$w, [int]$h, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
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
[void][TCheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object TCheck+RECT
[void][TCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object TCheck+POINT
[void][TCheck]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][TCheck]::SetForegroundWindow($main)
  [void][TCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [TCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [TCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 600
}

# Open settings -> 系统 tab (6th).
Click-Css 342 24
Start-Sleep -Milliseconds 600
Click-Css 323 62
Start-Sleep -Milliseconds 700
if ($Scroll -gt 0) {
  [void][TCheck]::SetCursorPos([int]($origin.X + 210 * $scale), [int]($origin.Y + 420 * $scale))
  Start-Sleep -Milliseconds 200
  [TCheck]::mouse_event(0x0800, 0, 0, -$Scroll, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 600
}
Save-Rect $origin.X $origin.Y $w $h $Shot

if (-not $OnlySettings) {
  # Switch to 青碧 theme (second card), then capture the main window.
  Click-Css 295 178
  Start-Sleep -Milliseconds 500
  Save-Rect $origin.X $origin.Y $w $h 'theme-settings-ocean.png'
  Click-Css 30 24
  Start-Sleep -Milliseconds 800
  Save-Rect $origin.X $origin.Y $w $h 'theme-main-ocean.png'

  # Enter settings again and enable dark mode.
  Click-Css 342 24
  Start-Sleep -Milliseconds 600
  Click-Css 375 62
  Start-Sleep -Milliseconds 700
  Click-Css 359 285
  Start-Sleep -Milliseconds 600
  Save-Rect $origin.X $origin.Y $w $h 'theme-settings-dark.png'
  Click-Css 30 24
  Start-Sleep -Milliseconds 800
  Save-Rect $origin.X $origin.Y $w $h 'theme-main-dark.png'

  # Fullscreen dark
  [void][TCheck]::SetForegroundWindow($main)
  [TCheck]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [TCheck]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Seconds 6
  $full = Find-Window $process.Id 'dBound Fullscreen'
  if ($full -ne [IntPtr]::Zero) {
    $rect = New-Object TCheck+RECT
    [void][TCheck]::GetWindowRect($full, [ref]$rect)
    Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) 'theme-fullscreen-dark.png'
    [void][TCheck]::SetForegroundWindow($full)
    Start-Sleep -Milliseconds 300
    [TCheck]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [TCheck]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
  } else {
    Write-Host 'FULLSCREEN NOT FOUND'
  }
}

Start-Sleep -Milliseconds 400
if (-not $process.HasExited) { $process.Kill() }
