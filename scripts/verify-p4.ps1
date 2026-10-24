# P4 acceptance: logs are written to disk and readable inside the app.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [int]$WarmupSeconds = 12
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class P4Check {
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
[void][P4Check]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [P4Check+EnumProc]{
    param($hWnd, $lParam)
    if (-not [P4Check]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][P4Check]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][P4Check]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][P4Check]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
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

[void][P4Check]::SetForegroundWindow($main)
Start-Sleep -Seconds $WarmupSeconds

$client = New-Object P4Check+RECT
[void][P4Check]::GetClientRect($main, [ref]$client)
$origin = New-Object P4Check+POINT
[void][P4Check]::ClientToScreen($main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Save-Shot([string]$name) {
  $bitmap = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bitmap.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
  Write-Host "saved $name"
}

function Click-Css([double]$cssX, [double]$cssY) {
  [void][P4Check]::SetForegroundWindow($main)
  [void][P4Check]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 200
  [P4Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [P4Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 600
}

# Log button sits left of the mini button in the title bar.
Click-Css 286 24
Start-Sleep -Seconds 2
Save-Shot 'p4-logs-alerts.png'

Click-Css 138 99
Start-Sleep -Milliseconds 800
Save-Shot 'p4-logs-samples.png'

Click-Css 226 99
Start-Sleep -Milliseconds 800
Save-Shot 'p4-logs-system.png'

# Export: opens the native save dialog; accept the default file name with Enter.
Add-Type -AssemblyName System.Windows.Forms
Click-Css 331 25
Start-Sleep -Seconds 2
try {
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
} catch {
  Write-Host "SendKeys failed: $($_.Exception.Message)"
}
Start-Sleep -Seconds 2
$exported = Get-ChildItem -Path $env:USERPROFILE -Recurse -Filter 'dbound-*.csv' -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } |
  Select-Object -First 3
if ($exported) {
  $exported | ForEach-Object { Write-Host "exported: $($_.FullName) ($($_.Length) bytes)" }
} else {
  Write-Host 'no exported csv found in the home directory'
}

Write-Host '--- log files ---'
$logRoot = Join-Path $env:APPDATA 'com.dbound.app\logs'
if (Test-Path $logRoot) {
  Get-ChildItem $logRoot | ForEach-Object {
    $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
    Write-Host "$($_.Name)  $($_.Length) bytes  $lines lines"
  }
  $today = Get-ChildItem $logRoot | Sort-Object Name -Descending | Select-Object -First 1
  if ($today) {
    Write-Host '--- first lines ---'
    Get-Content $today.FullName | Select-Object -First 5
    Write-Host '--- last lines ---'
    Get-Content $today.FullName | Select-Object -Last 3
  }
} else {
  Write-Host "no log directory at $logRoot"
}

if (-not $process.HasExited) { $process.Kill() }
