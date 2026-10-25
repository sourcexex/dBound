# Behaviour checks for the 4 reported issues: click-to-start + settings drag.
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
public class FixCheck {
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
[void][FixCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$script:main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $process.Refresh()
  if ($process.HasExited) { break }
  $cb = [FixCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [FixCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][FixCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $process.Id) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][FixCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq 'dBound') { $script:main = $hWnd; return $false }
    return $true
  }
  [void][FixCheck]::EnumWindows($cb, [IntPtr]::Zero)
  if ($script:main -ne [IntPtr]::Zero) { break }
}
if ($script:main -eq [IntPtr]::Zero) { Write-Host 'MAIN NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }
[void][FixCheck]::SetForegroundWindow($script:main)
Start-Sleep -Seconds 3

$client = New-Object FixCheck+RECT
[void][FixCheck]::GetClientRect($script:main, [ref]$client)
$origin = New-Object FixCheck+POINT
[void][FixCheck]::ClientToScreen($script:main, [ref]$origin)
$scale = ($client.Right - $client.Left) / 420.0
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

function Click-Css([double]$cssX, [double]$cssY) {
  [void][FixCheck]::SetForegroundWindow($script:main)
  [void][FixCheck]::SetCursorPos([int]($origin.X + $cssX * $scale), [int]($origin.Y + $cssY * $scale))
  Start-Sleep -Milliseconds 180
  [FixCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [FixCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
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

# 1. Pause the auto-started capture -> the "点击开始测量" hint appears.
Click-Css 39 605
Start-Sleep -Seconds 2
Save-Window 'fix-main-idle.png'

# 2. Click the hint text to start measuring again.
Click-Css 210 351
Start-Sleep -Seconds 2
Save-Window 'fix-main-started.png'

# 3. Settings: drag the header and verify the window moves.
Click-Css 342 24
Start-Sleep -Milliseconds 800
Save-Window 'fix-settings.png'

$before = New-Object FixCheck+RECT
[void][FixCheck]::GetWindowRect($script:main, [ref]$before)
[void][FixCheck]::SetForegroundWindow($script:main)
[void][FixCheck]::SetCursorPos([int]($origin.X + 200 * $scale), [int]($origin.Y + 24 * $scale))
Start-Sleep -Milliseconds 200
[FixCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 150
for ($step = 1; $step -le 10; $step++) {
  [void][FixCheck]::SetCursorPos([int]($origin.X + (200 + $step * 8) * $scale), [int]($origin.Y + (24 + $step * 5) * $scale))
  Start-Sleep -Milliseconds 30
}
[FixCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 800
$after = New-Object FixCheck+RECT
[void][FixCheck]::GetWindowRect($script:main, [ref]$after)
Write-Host ("window moved: dx={0} dy={1}" -f ($after.Left - $before.Left), ($after.Top - $before.Top))
Save-Window 'fix-settings-dragged.png'

Start-Sleep -Milliseconds 300
if (-not $process.HasExited) { $process.Kill() }

$log = Get-ChildItem (Join-Path $env:APPDATA 'com.dbound.desktop\logs') -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host '--- last system events ---'
$py = 'C:\Users\86025\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
$s = @"
from pathlib import Path
import json
p = Path(r'$($log.FullName)')
for line in p.read_text(encoding='utf-8').splitlines()[-80:]:
    try:
        item = json.loads(line)
    except Exception:
        continue
    if item.get('kind') == 'system':
        print(item['text'])
"@
$tmp = Join-Path $env:TEMP 'fix_log.py'
Set-Content -Path $tmp -Value $s -Encoding UTF8
& $py $tmp
