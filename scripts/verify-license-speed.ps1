# Verify the faster license path and the activation gate.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class LicCheck {
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
[void][LicCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Main([int]$procId) {
  $script:found = [IntPtr]::Zero
  $cb = [LicCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [LicCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][LicCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][LicCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq 'dBound') { $script:found = $hWnd; return $false }
    return $true
  }
  [void][LicCheck]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Save-Window($main, $origin, $w, $h, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

# --- 1. Activated install: main UI should appear immediately ---
reg add 'HKCU\Software\dBound' /v License /t REG_SZ /d 1 /f | Out-Null
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$main = [IntPtr]::Zero
while ($sw.ElapsedMilliseconds -lt 15000) {
  Start-Sleep -Milliseconds 40
  $main = Find-Main $process.Id
  if ($main -ne [IntPtr]::Zero) { break }
}
$visibleMs = $sw.ElapsedMilliseconds
Write-Host "window visible after ${visibleMs} ms"
[void][LicCheck]::SetForegroundWindow($main)
Start-Sleep -Milliseconds 700
$client = New-Object LicCheck+RECT
[void][LicCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object LicCheck+POINT
[void][LicCheck]::ClientToScreen($main, [ref]$origin)
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top
Save-Window $main $origin $w $h 'license-fast-main.png'
if (-not $process.HasExited) { $process.Kill() }
Start-Sleep -Milliseconds 600

# --- 2. Copied folder (no marker): activation gate must appear ---
reg delete 'HKCU\Software\dBound' /v License /f 2>$null | Out-Null
$process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
$main = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 120
  $main = Find-Main $process.Id
  if ($main -ne [IntPtr]::Zero) { break }
}
[void][LicCheck]::SetForegroundWindow($main)
Start-Sleep -Milliseconds 1500
$client = New-Object LicCheck+RECT
[void][LicCheck]::GetClientRect($main, [ref]$client)
$origin = New-Object LicCheck+POINT
[void][LicCheck]::ClientToScreen($main, [ref]$origin)
$w = $client.Right - $client.Left
$h = $client.Bottom - $client.Top
Save-Window $main $origin $w $h 'license-gate.png'

# Type the serial and confirm activation.
[void][LicCheck]::SetForegroundWindow($main)
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('142857')
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 2
Save-Window $main $origin $w $h 'license-activated.png'
if (-not $process.HasExited) { $process.Kill() }

Write-Host '--- registry ---'
reg query 'HKCU\Software\dBound' /v License 2>&1 | Select-String 'License'
