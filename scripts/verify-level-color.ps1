# Capture a hit level to confirm the name/note follow the level colour.
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
public class ColorCheck {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][ColorCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [ColorCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [ColorCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][ColorCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][ColorCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][ColorCheck]::EnumWindows($cb, [IntPtr]::Zero)
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
  Start-Sleep -Milliseconds 300
  $main = Find-Window $process.Id 'dBound'
  if ($main -ne [IntPtr]::Zero) { break }
}
if ($main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }
[void][ColorCheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$rect = New-Object ColorCheck+RECT
[void][ColorCheck]::GetWindowRect($main, [ref]$rect)
Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) 'level-color-main.png'

# Fullscreen
[void][ColorCheck]::SetForegroundWindow($main)
[ColorCheck]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[ColorCheck]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Seconds 3
$full = Find-Window $process.Id 'dBound Fullscreen'
if ($full -ne [IntPtr]::Zero) {
  $frect = New-Object ColorCheck+RECT
  [void][ColorCheck]::GetWindowRect($full, [ref]$frect)
  Save-Rect $frect.Left $frect.Top ($frect.Right - $frect.Left) ($frect.Bottom - $frect.Top) 'level-color-fullscreen.png'
  [void][ColorCheck]::SetForegroundWindow($full)
  Start-Sleep -Milliseconds 300
  [ColorCheck]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [ColorCheck]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
}
Start-Sleep -Milliseconds 400
if (-not $process.HasExited) { $process.Kill() }
