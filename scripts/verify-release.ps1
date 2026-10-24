# P5: verify the release binary, soak it for a couple of minutes and watch memory.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\release\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots',
  [int]$SoakSeconds = 120
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class RelCheck {
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
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][RelCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [RelCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [RelCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][RelCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][RelCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][RelCheck]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $process.Refresh()
  if ($process.HasExited) { break }
  $main = Find-Window $process.Id 'dBound'
  if ($main -ne [IntPtr]::Zero) { break }
}
if ($main -eq [IntPtr]::Zero) { Write-Host 'RELEASE WINDOW NOT FOUND'; if (-not $process.HasExited) { $process.Kill() }; exit 1 }

[void][RelCheck]::SetForegroundWindow($main)
Start-Sleep -Seconds 5

$client = New-Object RelCheck+RECT
[void][RelCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object RelCheck+POINT
[void][RelCheck]::ClientToScreen($main, [ref]$origin)
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top

$bitmap = New-Object System.Drawing.Bitmap $w, $h
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
$bitmap.Save((Join-Path $OutDir 'p5-release-main.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
Write-Host 'saved p5-release-main.png'

$process.Refresh()
$startMemory = $process.WorkingSet64 / 1MB
$startCpu = $process.TotalProcessorTime.TotalSeconds
Write-Host ("start: mem {0:N1} MB, cpu {1:N1} s" -f $startMemory, $startCpu)

Start-Sleep -Seconds $SoakSeconds
$process.Refresh()
$endMemory = $process.WorkingSet64 / 1MB
$endCpu = $process.TotalProcessorTime.TotalSeconds
Write-Host ("after {0}s: mem {1:N1} MB, cpu {2:N1} s (delta {3:N1} MB / {4:N1} s)" -f `
    $SoakSeconds, $endMemory, $endCpu, ($endMemory - $startMemory), ($endCpu - $startCpu))
Write-Host ("cpu utilisation: {0:N2} %" -f (($endCpu - $startCpu) / $SoakSeconds / [Environment]::ProcessorCount * 100))

$logRoot = Join-Path $env:APPDATA 'com.dbound.desktop\logs'
if (Test-Path $logRoot) {
  Get-ChildItem $logRoot | ForEach-Object {
    Write-Host "log: $($_.Name) $($_.Length) bytes"
  }
} else {
  Write-Host "no log dir at $logRoot"
}

if (-not $process.HasExited) { $process.Kill() }
