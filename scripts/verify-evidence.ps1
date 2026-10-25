# Evidence recording demo: real microphone, reverse mode alert triggers a 5s+10s WAV.
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
public class EvCheck {
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
[void][EvCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [EvCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [EvCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][EvCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][EvCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][EvCheck]::EnumWindows($cb, [IntPtr]::Zero)
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
[void][EvCheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 3

$client = New-Object EvCheck+RECT
[void][EvCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object EvCheck+POINT
[void][EvCheck]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][EvCheck]::SetForegroundWindow($main)
  [void][EvCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [EvCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [EvCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

# Pause the auto-started capture, clear the alert state in forward mode, then
# start again so the 5 s ring buffer can fill before the quiet room triggers.
Start-Sleep -Milliseconds 1200
Click-Css 39 605
Start-Sleep -Milliseconds 500
Click-Css 121 70
Start-Sleep -Milliseconds 600
Click-Css 39 605
Start-Sleep -Seconds 7
Click-Css 289 70
Start-Sleep -Seconds 3
Save-Rect $origin.X $origin.Y $w $h 'evidence-armed.png'

# Wait for the alert -> 5s pre-roll + 10s post-roll -> saved file + toast.
Start-Sleep -Seconds 10
Save-Rect $origin.X $origin.Y $w $h 'evidence-toast.png'
Start-Sleep -Seconds 4
Save-Rect $origin.X $origin.Y $w $h 'evidence-saved.png'

# Settings -> 系统 -> scroll to the evidence card
Click-Css 342 24
Start-Sleep -Milliseconds 700
Click-Css 375 62
Start-Sleep -Milliseconds 700
[void][EvCheck]::SetCursorPos([int]($origin.X + 210 * $scale), [int]($origin.Y + 420 * $scale))
Start-Sleep -Milliseconds 200
[EvCheck]::mouse_event(0x0800, 0, 0, -330, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 700
Save-Rect $origin.X $origin.Y $w $h 'evidence-settings.png'

Start-Sleep -Milliseconds 400
if (-not $process.HasExited) { $process.Kill() }

$dir = Join-Path $env:APPDATA 'com.dbound.desktop\recordings'
Write-Host "recordings dir: $dir"
if (Test-Path $dir) {
  Get-ChildItem $dir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5 |
    ForEach-Object { "{0}  {1:N0} bytes" -f $_.Name, $_.Length }
} else {
  Write-Host 'recordings dir missing'
}
