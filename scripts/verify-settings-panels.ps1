# Capture the four settings panels changed by the latest fixes.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)
$ErrorActionPreference = 'Stop'
reg add 'HKCU\Software\dBound' /v License /t REG_SZ /d 1 /f | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class PanelCheck {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int data, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][PanelCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$script:main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $process.Refresh()
  if ($process.HasExited) { break }
  $cb = [PanelCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [PanelCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][PanelCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $process.Id) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][PanelCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq 'dBound') { $script:main = $hWnd; return $false }
    return $true
  }
  [void][PanelCheck]::EnumWindows($cb, [IntPtr]::Zero)
  if ($script:main -ne [IntPtr]::Zero) { break }
}
if ($script:main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }
[void][PanelCheck]::SetForegroundWindow($script:main)
Start-Sleep -Seconds 3

$client = New-Object PanelCheck+RECT
[void][PanelCheck]::GetClientRect($script:main, [ref]$client)
$origin = New-Object PanelCheck+POINT
[void][PanelCheck]::ClientToScreen($script:main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][PanelCheck]::SetForegroundWindow($script:main)
  [void][PanelCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 150
  [PanelCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [PanelCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

function Scroll([int]$delta) {
  [void][PanelCheck]::SetCursorPos([int]($origin.X + 210 * $scale), [int]($origin.Y + 420 * $scale))
  Start-Sleep -Milliseconds 150
  [PanelCheck]::mouse_event(0x0800, 0, 0, -$delta, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

function Save-Window([string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

Click-Css 342 24
Start-Sleep -Milliseconds 700

# 模式 tab: idle colour control (scroll to the 数字显示 card)
Click-Css 40 62
Start-Sleep -Milliseconds 500
Scroll 700
Save-Window 'fix-mode-idle-color.png'

# 全屏 tab: status typography / colour / idle copy
Click-Css 210 62
Start-Sleep -Milliseconds 500
Scroll 200
Save-Window 'fix-status-a.png'
Scroll 120
Save-Window 'fix-status-b.png'

# 系统 tab: per-mode evidence switches + resolution
Click-Css 323 62
Start-Sleep -Milliseconds 500
Scroll 260
Save-Window 'fix-evidence-a.png'
Scroll 120
Save-Window 'fix-evidence-b.png'

# 设备 tab: camera selection card
Click-Css 266 62
Start-Sleep -Milliseconds 600
Save-Window 'fix-camera-device.png'

Start-Sleep -Milliseconds 300
if (-not $process.HasExited) { $process.Kill() }
