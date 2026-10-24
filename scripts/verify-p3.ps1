# P3 acceptance: mini capsule opens, keeps updating while the main window is hidden,
# clicking it restores the main window, and closing the main window keeps the app alive.
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
public class P3Check {
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
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@

[void][P3Check]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-ProcessWindow([int]$procId, [string]$title) {
  $found = [IntPtr]::Zero
  $callback = [P3Check+EnumProc]{
    param($hWnd, $lParam)
    if (-not [P3Check]::IsWindowVisible($hWnd)) { return $true }
    $ownerPid = 0
    [void][P3Check]::GetWindowThreadProcessId($hWnd, [ref]$ownerPid)
    if ($ownerPid -ne $procId) { return $true }
    $buffer = New-Object System.Text.StringBuilder 256
    [void][P3Check]::GetWindowText($hWnd, $buffer, 256)
    if ($buffer.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  $script:found = [IntPtr]::Zero
  [void][P3Check]::EnumWindows($callback, [IntPtr]::Zero)
  return $script:found
}

function Save-Window([IntPtr]$hWnd, [string]$name) {
  $rect = New-Object P3Check+RECT
  [void][P3Check]::GetWindowRect($hWnd, [ref]$rect)
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  $bitmap = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bitmap.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Host "saved $name (${w}x${h})"
}

function Click-Screen([int]$x, [int]$y) {
  [void][P3Check]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 180
  [P3Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [P3Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $process.Refresh()
  if ($process.HasExited) { break }
  $main = Find-ProcessWindow $process.Id 'dBound'
  if ($main -ne [IntPtr]::Zero) { break }
}
if ($main -eq [IntPtr]::Zero) { Write-Host 'MAIN WINDOW NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }

[void][P3Check]::SetForegroundWindow($main)
Start-Sleep -Seconds 5
Save-Window $main 'p3-main-with-mini-button.png'

$client = New-Object P3Check+RECT
[void][P3Check]::GetClientRect($main, [ref]$client)
$origin = New-Object P3Check+POINT
[void][P3Check]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0

# Mini button sits left of the settings gear in the title bar.
Click-Screen ([int]($origin.X + 314 * $scale)) ([int]($origin.Y + 24 * $scale))
Start-Sleep -Seconds 3

$mini = Find-ProcessWindow $process.Id 'dBound Mini'
if ($mini -eq [IntPtr]::Zero) {
  Write-Host 'MINI WINDOW NOT FOUND'
  Save-Window $main 'p3-failure-main.png'
  if (-not $process.HasExited) { $process.Kill() }
  exit 1
}

Save-Window $mini 'p3-mini-a.png'
Start-Sleep -Seconds 3
Save-Window $mini 'p3-mini-b.png'
$hashA = (Get-FileHash (Join-Path $OutDir 'p3-mini-a.png')).Hash
$hashB = (Get-FileHash (Join-Path $OutDir 'p3-mini-b.png')).Hash
Write-Host "mini keeps updating while main is hidden: $($hashA -ne $hashB)"

# Click the capsule to bring the main window back.
$miniRect = New-Object P3Check+RECT
[void][P3Check]::GetWindowRect($mini, [ref]$miniRect)
Click-Screen ([int](($miniRect.Left + $miniRect.Right) / 2)) ([int](($miniRect.Top + $miniRect.Bottom) / 2))
Start-Sleep -Seconds 2

$mainAgain = Find-ProcessWindow $process.Id 'dBound'
if ($mainAgain -ne [IntPtr]::Zero) {
  Save-Window $mainAgain 'p3-main-restored.png'
  $client2 = New-Object P3Check+RECT
  [void][P3Check]::GetClientRect($mainAgain, [ref]$client2)
  $origin2 = New-Object P3Check+POINT
  [void][P3Check]::ClientToScreen($mainAgain, [ref]$origin2)
  $scale2 = ($client2.Right - $client2.Left) / 420.0

  # Close button: the app should stay alive in the tray, with the window hidden.
  Click-Screen ([int]($origin2.X + 398 * $scale2)) ([int]($origin2.Y + 24 * $scale2))
  Start-Sleep -Seconds 2
  $process.Refresh()
  Write-Host "process alive after close: $(-not $process.HasExited)"
  $stillVisible = Find-ProcessWindow $process.Id 'dBound'
  Write-Host "main window hidden after close: $($stillVisible -eq [IntPtr]::Zero)"
} else {
  Write-Host 'MAIN DID NOT RESTORE'
}

if (-not $process.HasExited) { $process.Kill() }
