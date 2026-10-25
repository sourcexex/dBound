# First-run activation flow: install → activate → reopen → simulated copy → uninstall.
param(
    [string]$Installer = '',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
if (-not $Installer) {
  $Installer = (Get-ChildItem (Join-Path $root 'release') -Filter 'dBound_*_x64-setup.exe' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}
if (-not $Installer -or -not (Test-Path $Installer)) { throw 'installer not found in release/' }
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FirstRun {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][FirstRun]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [FirstRun+EnumProc]{
    param($hWnd, $lParam)
    if (-not [FirstRun]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][FirstRun]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][FirstRun]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][FirstRun]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Start-InstalledApp([string]$exe) {
  $process = Start-Process -FilePath $exe -PassThru -WindowStyle Normal
  $main = [IntPtr]::Zero
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    $main = Find-Window $process.Id 'dBound'
    if ($main -ne [IntPtr]::Zero) { break }
  }
  if ($main -eq [IntPtr]::Zero) { throw 'main window not found' }
  [void][FirstRun]::SetForegroundWindow($main)
  Start-Sleep -Seconds 2
  return @{ Process = $process; Main = $main }
}

function Save-AppWindow($app, [string]$name) {
  $client = New-Object FirstRun+RECT
  [void][FirstRun]::GetClientRect($app.Main, [ref]$client)
  $origin = New-Object FirstRun+POINT
  [void][FirstRun]::ClientToScreen($app.Main, [ref]$origin)
  $w = $client.Right - $client.Left
  $h = $client.Bottom - $client.Top
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

function Registry-Marker {
  cmd /c 'reg query "HKCU\Software\dBound" /v License >nul 2>&1'
  return $LASTEXITCODE -eq 0
}

$dest = Join-Path $env:TEMP 'dbound-first-run'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Get-Process | Where-Object { $_.ProcessName -like '*dBound*' } | ForEach-Object { try { $_.Kill() } catch {} }
cmd /c 'reg delete "HKCU\Software\dBound" /f >nul 2>&1' | Out-Null

Write-Host '--- 1. silent install without any activation code ---'
$install = Start-Process -FilePath $Installer -ArgumentList '/S', "/D=$dest" -Wait -PassThru
Write-Host "install exit: $($install.ExitCode)  dir: $(Test-Path $dest)"
Write-Host "license.dat present: $(Test-Path (Join-Path $dest 'license.dat'))  registry marker: $(Registry-Marker)"

$exe = Join-Path $dest 'dbound.exe'

Write-Host '--- 2. first launch must show the activation gate ---'
$app = Start-InstalledApp $exe
Save-AppWindow $app 'first-run-activation.png'
[void][FirstRun]::SetForegroundWindow($app.Main)
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('142857')
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 2
Save-AppWindow $app 'first-run-activated.png'
Write-Host "registry marker after activation: $(Registry-Marker)"
if (-not $app.Process.HasExited) { $app.Process.Kill() }
Start-Sleep -Seconds 1

Write-Host '--- 3. reopening on the same machine must skip activation ---'
$app2 = Start-InstalledApp $exe
Save-AppWindow $app2 'first-run-reopen.png'
if (-not $app2.Process.HasExited) { $app2.Process.Kill() }
Start-Sleep -Seconds 1

Write-Host '--- 4. simulated copy to another PC (marker removed) ---'
cmd /c 'reg delete "HKCU\Software\dBound" /f >nul 2>&1' | Out-Null
$app3 = Start-InstalledApp $exe
Save-AppWindow $app3 'first-run-copied.png'
if (-not $app3.Process.HasExited) { $app3.Process.Kill() }
Start-Sleep -Seconds 1

Write-Host '--- 5. activate again, then uninstall must clean the marker ---'
$app4 = Start-InstalledApp $exe
[void][FirstRun]::SetForegroundWindow($app4.Main)
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('142857')
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 2
Write-Host "marker before uninstall: $(Registry-Marker)"
if (-not $app4.Process.HasExited) { $app4.Process.Kill() }
Start-Sleep -Seconds 1
Start-Process -FilePath (Join-Path $dest 'uninstall.exe') -ArgumentList '/S' -Wait | Out-Null
Start-Sleep -Seconds 2
Write-Host "install dir remains: $(Test-Path (Join-Path $dest 'dbound.exe'))  marker after uninstall: $(Registry-Marker)"
