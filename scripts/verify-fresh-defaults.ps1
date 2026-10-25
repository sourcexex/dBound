# Verify the baked factory defaults by launching with a throwaway WebView profile.
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
public class FreshCheck {
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
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][FreshCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$profileRoot = Join-Path $env:LOCALAPPDATA 'com.dbound.desktop'
$profile = Join-Path $profileRoot 'EBWebView'
$backup = Join-Path $profileRoot 'EBWebView.bak'
Get-Process dbound -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Kill() } catch {} }
Start-Sleep -Milliseconds 700

if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
if (Test-Path $profile) { Rename-Item $profile $backup }
Write-Host "fresh profile ready (backup: $backup)"

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$script:main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  $cb = [FreshCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [FreshCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][FreshCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $process.Id) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][FreshCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq 'dBound') { $script:main = $hWnd; return $false }
    return $true
  }
  [void][FreshCheck]::EnumWindows($cb, [IntPtr]::Zero)
  if ($script:main -ne [IntPtr]::Zero) { break }
}
if ($script:main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; exit 1 }
[void][FreshCheck]::SetForegroundWindow($script:main)
Start-Sleep -Seconds 3

$client = New-Object FreshCheck+RECT
[void][FreshCheck]::GetClientRect($script:main, [ref]$client)
$origin = New-Object FreshCheck+POINT
[void][FreshCheck]::ClientToScreen($script:main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][FreshCheck]::SetForegroundWindow($script:main)
  [void][FreshCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 150
  [FreshCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [FreshCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
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

Save-Window 'fresh-defaults-main.png'

Click-Css 342 24
Start-Sleep -Milliseconds 700
Click-Css 210 62
Start-Sleep -Milliseconds 700
Save-Window 'fresh-defaults-fullscreen-tab.png'
Click-Css 97 62
Start-Sleep -Milliseconds 700
Save-Window 'fresh-defaults-levels.png'

if (-not $process.HasExited) { $process.Kill() }
Start-Sleep -Seconds 1

# Restore the original profile.
if (Test-Path $profile) { Remove-Item $profile -Recurse -Force }
if (Test-Path $backup) { Rename-Item $backup $profile }
Write-Host "profile restored: $(Test-Path $profile)"
