# Feature 3 demo: emoji reward row in fullscreen + its settings card.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [int]$WaitSeconds = 20
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ECheck {
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
[void][ECheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [ECheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [ECheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][ECheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][ECheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][ECheck]::EnumWindows($cb, [IntPtr]::Zero)
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
[void][ECheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object ECheck+RECT
[void][ECheck]::GetClientRect($main, [ref]$client)
$origin = New-Object ECheck+POINT
[void][ECheck]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][ECheck]::SetForegroundWindow($main)
  [void][ECheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [ECheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [ECheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

# Settings -> 全屏 tab -> scroll to the emoji card
Click-Css 342 24
Start-Sleep -Milliseconds 600
Click-Css 243 62
Start-Sleep -Milliseconds 600
[void][ECheck]::SetCursorPos([int]($origin.X + 210 * $scale), [int]($origin.Y + 420 * $scale))
Start-Sleep -Milliseconds 200
[ECheck]::mouse_event(0x0800, 0, 0, -450, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 600
Save-Rect $origin.X $origin.Y $w $h 'f3-emoji-settings.png'

# Back to main, enter fullscreen, let the emoji accumulate
Click-Css 30 24
Start-Sleep -Milliseconds 800
[void][ECheck]::SetForegroundWindow($main)
[ECheck]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[ECheck]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Seconds 3

$full = Find-Window $process.Id 'dBound Fullscreen'
if ($full -eq [IntPtr]::Zero) { Write-Host 'FULLSCREEN NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }

$rect = New-Object ECheck+RECT
[void][ECheck]::GetWindowRect($full, [ref]$rect)
Start-Sleep -Seconds 8
Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) 'f3-emoji-early.png'
Start-Sleep -Seconds $WaitSeconds
Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) 'f3-emoji-fullscreen.png'

[void][ECheck]::SetForegroundWindow($full)
Start-Sleep -Milliseconds 300
[ECheck]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[ECheck]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 600
if (-not $process.HasExited) { $process.Kill() }
Write-Host 'done'
