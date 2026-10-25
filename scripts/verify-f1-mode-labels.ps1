# Feature 1 demo: rename the two modes in settings, then check the main page and persistence.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [switch]$OnlySettings,
  [switch]$OnlyAfterRestart
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class F1Check {
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
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][F1Check]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [F1Check+EnumProc]{
    param($hWnd, $lParam)
    if (-not [F1Check]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][F1Check]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][F1Check]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][F1Check]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
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
[void][F1Check]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object F1Check+RECT
[void][F1Check]::GetClientRect($main, [ref]$client)
$origin = New-Object F1Check+POINT
[void][F1Check]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Save-Shot([string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

function Click-Css([double]$cssX, [double]$cssY) {
  [void][F1Check]::SetForegroundWindow($main)
  [void][F1Check]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [F1Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [F1Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

function Paste-Text([string]$text) {
  Set-Clipboard -Value $text
  Start-Sleep -Milliseconds 200
  [F1Check]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F1Check]::keybd_event(0x56, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [F1Check]::keybd_event(0x56, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F1Check]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 400
}

function Select-All-Text {
  [F1Check]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F1Check]::keybd_event(0x41, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F1Check]::keybd_event(0x41, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F1Check]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 200
}

if (-not $OnlyAfterRestart) {
  # Settings -> 模式 tab (first tab, already active).
  Click-Css 342 24
  Start-Sleep -Milliseconds 700
  Save-Shot 'f1-settings-before.png'

  # Forward label input (left column of the 模式名称 card).
  Click-Css 118 196
  Select-All-Text
  Paste-Text '自习课模式'
  Save-Shot 'f1-settings-typing.png'

  # Reverse label input (right column).
  Click-Css 300 196
  Select-All-Text
  Paste-Text '早读模式'
  Save-Shot 'f1-settings-after.png'

  # Back to the main page.
  Click-Css 30 24
  Start-Sleep -Milliseconds 800
  Save-Shot 'f1-main-renamed.png'
}

if (-not $OnlySettings) {
  Start-Sleep -Seconds 1
  if (-not $process.HasExited) { $process.Kill() }
  Start-Sleep -Milliseconds 800

  # Restart to confirm the labels persist.
  $process2 = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
  $main2 = [IntPtr]::Zero
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    $process2.Refresh()
    if ($process2.HasExited) { break }
    $main2 = Find-Window $process2.Id 'dBound'
    if ($main2 -ne [IntPtr]::Zero) { break }
  }
  if ($main2 -ne [IntPtr]::Zero) {
    [void][F1Check]::SetForegroundWindow($main2)
    Start-Sleep -Seconds 3
    $client2 = New-Object F1Check+RECT
    [void][F1Check]::GetClientRect($main2, [ref]$client2)
    $origin2 = New-Object F1Check+POINT
    [void][F1Check]::ClientToScreen($main2, [ref]$origin2)
    $bmp = New-Object System.Drawing.Bitmap ($client2.Right - $client2.Left), ($client2.Bottom - $client2.Top)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($origin2.X, $origin2.Y, 0, 0, (New-Object System.Drawing.Size ($client2.Right - $client2.Left), ($client2.Bottom - $client2.Top)))
    $bmp.Save((Join-Path $OutDir 'f1-main-after-restart.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host 'saved f1-main-after-restart.png'
  } else {
    Write-Host 'restart failed to show a window'
  }
  if (-not $process2.HasExited) { $process2.Kill() }
}
