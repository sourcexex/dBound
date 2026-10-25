# Capture fullscreen after several emoji rewards so the bundled Fluent assets show.
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
public class EmojiCapture {
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
[void][EmojiCapture]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [EmojiCapture+EnumProc]{
    param($hWnd, $lParam)
    if (-not [EmojiCapture]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][EmojiCapture]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][EmojiCapture]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][EmojiCapture]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  $main = Find-Window $process.Id 'dBound'
  if ($main -ne [IntPtr]::Zero) { break }
}
if ($main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; exit 1 }
[void][EmojiCapture]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$full = [IntPtr]::Zero
for ($attempt = 0; $attempt -lt 4 -and $full -eq [IntPtr]::Zero; $attempt++) {
  [void][EmojiCapture]::SetForegroundWindow($main)
  Start-Sleep -Milliseconds 700
  [EmojiCapture]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
  [EmojiCapture]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Seconds 3
  $full = Find-Window $process.Id 'dBound Fullscreen'
}
Start-Sleep -Seconds 22

$rect = New-Object EmojiCapture+RECT
[void][EmojiCapture]::GetWindowRect($full, [ref]$rect)
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
$bmp.Save((Join-Path $OutDir 'perf-emoji-fullscreen.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "saved perf-emoji-fullscreen.png (${w}x${h})"

if (-not $process.HasExited) { $process.Kill() }
