# Minimal probe: click play once, then observe for 8 seconds.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Probe {
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
[void][Probe]::SetProcessDPIAware()
$process = Start-Process -FilePath $Exe -PassThru
Start-Sleep -Seconds 3
$script:main = [IntPtr]::Zero
$cb = [Probe+EnumProc]{
  param($hWnd, $lParam)
  if (-not [Probe]::IsWindowVisible($hWnd)) { return $true }
  $owner = 0
  [void][Probe]::GetWindowThreadProcessId($hWnd, [ref]$owner)
  if ($owner -ne $process.Id) { return $true }
  $sb = New-Object System.Text.StringBuilder 256
  [void][Probe]::GetWindowText($hWnd, $sb, 256)
  if ($sb.ToString() -eq 'dBound') { $script:main = $hWnd; return $false }
  return $true
}
[void][Probe]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:main -eq [IntPtr]::Zero) { Write-Host 'no window'; $process.Kill(); exit 1 }
[void][Probe]::SetForegroundWindow($script:main)
$client = New-Object Probe+RECT
[void][Probe]::GetClientRect($script:main, [ref]$client)
$origin = New-Object Probe+POINT
[void][Probe]::ClientToScreen($script:main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0

[void][Probe]::SetCursorPos([int]($origin.X + 39 * $scale), [int]($origin.Y + 605 * $scale))
Start-Sleep -Milliseconds 400
[Probe]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 90
[Probe]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Write-Host 'clicked play'

Start-Sleep -Seconds 8
$rect = New-Object Probe+RECT
[void][Probe]::GetClientRect($script:main, [ref]$rect)
$bmp = New-Object System.Drawing.Bitmap ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top)))
$bmp.Save('D:\Project\Tauri\dBound\output\screenshots\probe.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
if (-not $process.HasExited) { $process.Kill() }

$log = Get-ChildItem (Join-Path $env:APPDATA 'com.dbound.desktop\logs') -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content $log.FullName -Tail 8
