# Feature 2 demo: set the fullscreen title / subtitle in settings and show it in fullscreen.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [switch]$OnlySettings
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class F2Check {
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
[void][F2Check]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [F2Check+EnumProc]{
    param($hWnd, $lParam)
    if (-not [F2Check]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][F2Check]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][F2Check]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][F2Check]::EnumWindows($cb, [IntPtr]::Zero)
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
[void][F2Check]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object F2Check+RECT
[void][F2Check]::GetClientRect($main, [ref]$client)
$origin = New-Object F2Check+POINT
[void][F2Check]::ClientToScreen($main, [ref]$origin)
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

function Save-WindowRect([IntPtr]$hWnd, [string]$name) {
  $rect = New-Object F2Check+RECT
  [void][F2Check]::GetWindowRect($hWnd, [ref]$rect)
  $ww = $rect.Right - $rect.Left
  $hh = $rect.Bottom - $rect.Top
  $bmp = New-Object System.Drawing.Bitmap $ww, $hh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $ww, $hh))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name (${ww}x${hh})"
}

function Click-Css([double]$cssX, [double]$cssY) {
  [void][F2Check]::SetForegroundWindow($main)
  [void][F2Check]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [F2Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [F2Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

function Paste-Text([string]$text) {
  Set-Clipboard -Value $text
  Start-Sleep -Milliseconds 200
  [F2Check]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F2Check]::keybd_event(0x41, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F2Check]::keybd_event(0x41, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F2Check]::keybd_event(0x56, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [F2Check]::keybd_event(0x56, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [F2Check]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 400
}

# Settings -> 全屏 tab (4th of six tabs).
Click-Css 342 24
Start-Sleep -Milliseconds 600
Click-Css 243 62
Start-Sleep -Milliseconds 600
Save-Shot 'f2-settings.png'

function Send-Key([byte]$vk) {
  [F2Check]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [F2Check]::keybd_event($vk, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 220
}

if (-not $OnlySettings) {
  Click-Css 210 191
  Paste-Text '520班分贝仪'
  Click-Css 210 251
  Paste-Text '让朗读声响起来'

  # 字体 -> 楷体 (系统默认 + 3 次下移)，字号拖到约 35px，颜色选红色。
  Click-Css 117 312
  Start-Sleep -Milliseconds 500
  Send-Key 0x28
  Send-Key 0x28
  Send-Key 0x28
  Send-Key 0x0D
  Start-Sleep -Milliseconds 400
  Click-Css 300 308
  Start-Sleep -Milliseconds 400
  Click-Css 65 366
  Start-Sleep -Milliseconds 400
  Save-Shot 'f2-settings-filled.png'

  # Back, then F11 into fullscreen.
  Click-Css 30 24
  Start-Sleep -Milliseconds 700
  [void][F2Check]::SetForegroundWindow($main)
  [F2Check]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [F2Check]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Seconds 3

  $full = Find-Window $process.Id 'dBound Fullscreen'
  if ($full -ne [IntPtr]::Zero) {
    Save-WindowRect $full 'f2-fullscreen-styled.png'
    [void][F2Check]::SetForegroundWindow($full)
    Start-Sleep -Milliseconds 300
    [F2Check]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [F2Check]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 800
  } else {
    Write-Host 'FULLSCREEN WINDOW NOT FOUND'
  }
}

if (-not $process.HasExited) { $process.Kill() }
