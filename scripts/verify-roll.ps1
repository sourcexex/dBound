# Capture a burst of frames to show the rolling digits in motion.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [int]$Frames = 6,
  [int]$IntervalMs = 130
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class RollCheck {
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
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][RollCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [RollCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [RollCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][RollCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][RollCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][RollCheck]::EnumWindows($cb, [IntPtr]::Zero)
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
[void][RollCheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object RollCheck+RECT
[void][RollCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object RollCheck+POINT
[void][RollCheck]::ClientToScreen($main, [ref]$origin)
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

for ($i = 0; $i -lt $Frames; $i++) {
  Save-Rect $origin.X $origin.Y $w $h ("roll-main-{0}.png" -f $i)
  Start-Sleep -Milliseconds $IntervalMs
}

# Fullscreen burst
[void][RollCheck]::SetForegroundWindow($main)
[RollCheck]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[RollCheck]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Seconds 3

$full = Find-Window $process.Id 'dBound Fullscreen'
if ($full -ne [IntPtr]::Zero) {
  $rect = New-Object RollCheck+RECT
  [void][RollCheck]::GetWindowRect($full, [ref]$rect)
  for ($i = 0; $i -lt $Frames; $i++) {
    Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) ("roll-full-{0}.png" -f $i)
    Start-Sleep -Milliseconds $IntervalMs
  }
  [void][RollCheck]::SetForegroundWindow($full)
  Start-Sleep -Milliseconds 300
  [RollCheck]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [RollCheck]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
}

Write-Host "captured $Frames frames each"
Start-Sleep -Milliseconds 500
if (-not $process.HasExited) { $process.Kill() }
