# Installer verification: serial gate, custom install path, installed file layout.
param(
  [string]$Installer = 'D:\Project\Tauri\dBound\src-tauri\target\release\bundle\nsis\dBound_1.0.1_x64-setup.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class InstCheck {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][InstCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
if (-not (Test-Path $Installer)) { throw "installer not found: $Installer" }

function Save-Rect([int]$x, [int]$y, [int]$w, [int]$h, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

$dest = Join-Path $env:TEMP 'dbound-install-test'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
reg delete 'HKCU\Software\dBound' /f 2>$null | Out-Null

Write-Host '--- 1. silent install with wrong serial (must fail) ---'
$bad = Start-Process -FilePath $Installer -ArgumentList '/S', '/SERIAL=000000', "/D=$dest" -Wait -PassThru
Write-Host "exit code: $($bad.ExitCode)"
Write-Host "install dir exists: $(Test-Path $dest)"

Write-Host '--- 2. silent install with the correct serial ---'
$ok = Start-Process -FilePath $Installer -ArgumentList '/S', '/SERIAL=142857', "/D=$dest" -Wait -PassThru
Write-Host "exit code: $($ok.ExitCode)"
Write-Host "install dir exists: $(Test-Path $dest)"

Write-Host '--- installed layout ---'
if (Test-Path $dest) {
  Get-ChildItem $dest -Recurse | Sort-Object FullName | ForEach-Object {
    $rel = $_.FullName.Substring($dest.Length + 1)
    if ($_.PSIsContainer) { "[dir]  $rel" } else { "       $rel  ($($_.Length) bytes)" }
  }
}

Write-Host '--- registry ---'
reg query 'HKCU\Software\dBound' /v License 2>&1 | ForEach-Object { $_ }

Write-Host '--- 3. launch installed app and capture the window ---'
$app = Start-Process -FilePath (Join-Path $dest 'dBound.exe') -PassThru
Start-Sleep -Seconds 10
$script:appWin = [IntPtr]::Zero
$cb = [InstCheck+EnumProc]{
  param($hWnd, $lParam)
  if (-not [InstCheck]::IsWindowVisible($hWnd)) { return $true }
  $owner = 0
  [void][InstCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
  if ($owner -ne $app.Id) { return $true }
  $sb = New-Object System.Text.StringBuilder 256
  [void][InstCheck]::GetWindowText($hWnd, $sb, 256)
  if ($sb.ToString() -eq 'dBound') { $script:appWin = $hWnd; return $false }
  return $true
}
[void][InstCheck]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:appWin -ne [IntPtr]::Zero) {
  $rect = New-Object InstCheck+RECT
  [void][InstCheck]::GetWindowRect($script:appWin, [ref]$rect)
  [void][InstCheck]::SetForegroundWindow($script:appWin)
  Start-Sleep -Milliseconds 500
  Save-Rect $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top) 'installed-app.png'
} else {
  Write-Host 'installed app window not found'
}
if (-not $app.HasExited) { $app.Kill() }

Write-Host '--- 4. silent uninstall ---'
$uninstaller = Join-Path $dest 'uninstall.exe'
if (Test-Path $uninstaller) {
  $un = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
  Write-Host "uninstall exit code: $($un.ExitCode)"
  Start-Sleep -Seconds 2
  Write-Host "install dir remains: $(Test-Path (Join-Path $dest 'dBound.exe'))"
}
reg query 'HKCU\Software\dBound' /v License 2>&1 | ForEach-Object { $_ }
