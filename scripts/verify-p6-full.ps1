# P6 acceptance: fullscreen window opens, keeps updating, and ESC returns to the main window.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class P6Check {
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
[void][P6Check]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [P6Check+EnumProc]{
    param($hWnd, $lParam)
    if (-not [P6Check]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][P6Check]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][P6Check]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][P6Check]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Save-Window([IntPtr]$hWnd, [string]$name) {
  $rect = New-Object P6Check+RECT
  [void][P6Check]::GetWindowRect($hWnd, [ref]$rect)
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  $bitmap = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bitmap.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
  Write-Host "saved $name (${w}x${h})"
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
[void][P6Check]::SetForegroundWindow($main)
Start-Sleep -Seconds 6

$client = New-Object P6Check+RECT
[void][P6Check]::GetClientRect($main, [ref]$client)
$origin = New-Object P6Check+POINT
[void][P6Check]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0

Save-Window $main 'p6-main-with-full-button.png'

# Title bar order: logs, fullscreen, mini, settings, minimise, close.
$xFull = [int]($origin.X + 286 * $scale)
$yTitle = [int]($origin.Y + 24 * $scale)
[void][P6Check]::SetCursorPos($xFull, $yTitle)
Start-Sleep -Milliseconds 200
[P6Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 70
[P6Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Seconds 3

$full = Find-Window $process.Id 'dBound Fullscreen'
if ($full -eq [IntPtr]::Zero) {
  Write-Host 'FULLSCREEN WINDOW NOT FOUND'
  Save-Window $main 'p6-failure.png'
  if (-not $process.HasExited) { $process.Kill() }
  exit 1
}

Save-Window $full 'p6-full-a.png'
Start-Sleep -Seconds 3
Save-Window $full 'p6-full-b.png'
$hashA = (Get-FileHash (Join-Path $OutDir 'p6-full-a.png')).Hash
$hashB = (Get-FileHash (Join-Path $OutDir 'p6-full-b.png')).Hash
Write-Host "fullscreen keeps updating: $($hashA -ne $hashB)"

# ESC should bring the main window back.
[void][P6Check]::SetForegroundWindow($full)
Start-Sleep -Milliseconds 300
[P6Check]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[P6Check]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Seconds 2

$mainAgain = Find-Window $process.Id 'dBound'
$stillFull = Find-Window $process.Id 'dBound Fullscreen'
Write-Host "main restored after ESC: $($mainAgain -ne [IntPtr]::Zero)"
Write-Host "fullscreen hidden after ESC: $($stillFull -eq [IntPtr]::Zero)"
if ($mainAgain -ne [IntPtr]::Zero) { Save-Window $mainAgain 'p6-main-restored.png' }

# F11 in the main window should open the fullscreen view again.
if ($mainAgain -ne [IntPtr]::Zero) {
  [void][P6Check]::SetForegroundWindow($mainAgain)
  Start-Sleep -Milliseconds 300
  [P6Check]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [P6Check]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Seconds 2
  $fullFromKey = Find-Window $process.Id 'dBound Fullscreen'
  Write-Host "F11 opens fullscreen: $($fullFromKey -ne [IntPtr]::Zero)"
  if ($fullFromKey -ne [IntPtr]::Zero) {
    [void][P6Check]::SetForegroundWindow($fullFromKey)
    Start-Sleep -Milliseconds 300
    [P6Check]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [P6Check]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Seconds 1
  }
}

if (-not $process.HasExited) { $process.Kill() }
