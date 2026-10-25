# Camera snapshot demo: enable snapshot, trigger a reverse-mode alert, verify JPG + WAV.
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
public class SnapCheck {
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
[void][SnapCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$script:main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $process.Refresh()
  if ($process.HasExited) { break }
  $cb = [SnapCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [SnapCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][SnapCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $process.Id) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][SnapCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq 'dBound') { $script:main = $hWnd; return $false }
    return $true
  }
  [void][SnapCheck]::EnumWindows($cb, [IntPtr]::Zero)
  if ($script:main -ne [IntPtr]::Zero) { break }
}
if ($script:main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }
[void][SnapCheck]::SetForegroundWindow($script:main)
Start-Sleep -Milliseconds 600

$client = New-Object SnapCheck+RECT
[void][SnapCheck]::GetClientRect($script:main, [ref]$client)
$origin = New-Object SnapCheck+POINT
[void][SnapCheck]::ClientToScreen($script:main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][SnapCheck]::SetForegroundWindow($script:main)
  [void][SnapCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [SnapCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [SnapCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

function Get-PixelCss([double]$cssX, [double]$cssY) {
  $bmp = New-Object System.Drawing.Bitmap 1, 1
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale), 0, 0, (New-Object System.Drawing.Size 1, 1))
  $color = $bmp.GetPixel(0, 0)
  $g.Dispose(); $bmp.Dispose()
  return $color
}

function Save-Window([string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

# Let the alert/recording left over from the persisted mode finish first.
Start-Sleep -Seconds 20
Click-Css 121 70
Start-Sleep -Seconds 2

# Settings -> 系统 -> evidence card -> enable snapshot.
Click-Css 342 24
Start-Sleep -Milliseconds 700
Click-Css 323 62
Start-Sleep -Milliseconds 700
[void][SnapCheck]::SetCursorPos([int]($origin.X + 210 * $scale), [int]($origin.Y + 420 * $scale))
Start-Sleep -Milliseconds 200
[SnapCheck]::mouse_event(0x0800, 0, 0, -330, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 700
$pixel = Get-PixelCss 364 475
$brightness = ($pixel.R + $pixel.G + $pixel.B) / 3
if ($brightness -lt 140) {
  Click-Css 364 475
  Write-Host 'enabled snapshot toggle'
} else {
  Write-Host 'snapshot toggle already on'
}
Start-Sleep -Seconds 3
Save-Window 'snapshot-settings-on.png'

# Drop files from earlier sessions so the demo shows exactly one event.
$dir = Join-Path $env:APPDATA 'com.dbound.desktop\recordings'
Get-ChildItem $dir -Filter '*.jpg' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem $dir -Filter '*.wav' -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-15) } | Remove-Item -Force

# Back to the meter and let the quiet room trigger the reverse alert.
Click-Css 30 24
Start-Sleep -Milliseconds 800
Click-Css 289 70
Start-Sleep -Seconds 4
Save-Window 'snapshot-triggered.png'
Start-Sleep -Seconds 2
Save-Window 'snapshot-photo-toast.png'
Start-Sleep -Seconds 11
Save-Window 'snapshot-saved.png'

Start-Sleep -Milliseconds 400
if (-not $process.HasExited) { $process.Kill() }

$dir = Join-Path $env:APPDATA 'com.dbound.desktop\recordings'
Write-Host "recordings dir: $dir"
if (Test-Path $dir) {
  Get-ChildItem $dir -File | Where-Object { $_.Extension -eq '.jpg' -or $_.Extension -eq '.wav' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 6 |
    ForEach-Object { "{0}  {1:N0} bytes  {2:HH:mm:ss}" -f $_.Name, $_.Length, $_.LastWriteTime }
}
$log = Get-ChildItem (Join-Path $env:APPDATA 'com.dbound.desktop\logs') -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "--- log tail ---"
Get-Content $log.FullName -Tail 8
