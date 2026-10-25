# About tab + activation gate screenshots.
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
public class UiCheck {
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
[void][UiCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-Main([int]$procId) {
  $script:found = [IntPtr]::Zero
  $cb = [UiCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [UiCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][UiCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][UiCheck]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq 'dBound') { $script:found = $hWnd; return $false }
    return $true
  }
  [void][UiCheck]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Start-App {
  $process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
  $main = [IntPtr]::Zero
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    $process.Refresh()
    if ($process.HasExited) { break }
    $main = Find-Main $process.Id
    if ($main -ne [IntPtr]::Zero) { break }
  }
  if ($main -eq [IntPtr]::Zero) { throw 'main window not found' }
  [void][UiCheck]::SetForegroundWindow($main)
  Start-Sleep -Seconds 3
  return @{ Process = $process; Main = $main }
}

function Get-Geometry($app) {
  $client = New-Object UiCheck+RECT
  [void][UiCheck]::GetClientRect($app.Main, [ref]$client)
  $origin = New-Object UiCheck+POINT
  [void][UiCheck]::ClientToScreen($app.Main, [ref]$origin)
  return @{
    Origin = $origin
    Width = $client.Right - $client.Left
    Height = $client.Bottom - $client.Top
    Scale = ($client.Right - $client.Left) / 420.0
  }
}

function Click-Css($app, $geo, [double]$cssX, [double]$cssY) {
  [void][UiCheck]::SetForegroundWindow($app.Main)
  [void][UiCheck]::SetCursorPos([int]($geo.Origin.X + $cssX * $geo.Scale), [int]($geo.Origin.Y + $cssY * $geo.Scale))
  Start-Sleep -Milliseconds 200
  [UiCheck]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [UiCheck]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 550
}

function Save-Window($app, $geo, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $geo.Width, $geo.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($geo.Origin.X, $geo.Origin.Y, 0, 0, (New-Object System.Drawing.Size $geo.Width, $geo.Height))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

# --- 1. About tab with an activated install ---
reg add 'HKCU\Software\dBound' /v License /t REG_SZ /d 1 /f | Out-Null
$app = Start-App
$geo = Get-Geometry $app
Click-Css $app $geo 342 24
Start-Sleep -Milliseconds 600
Click-Css $app $geo 379 62
Start-Sleep -Milliseconds 700
Save-Window $app $geo 'about-tab.png'
if (-not $app.Process.HasExited) { $app.Process.Kill() }
Start-Sleep -Milliseconds 600

# --- 2. Activation gate when the registry marker is missing ---
reg delete 'HKCU\Software\dBound' /v License /f 2>$null | Out-Null
$app = Start-App
$geo = Get-Geometry $app
Save-Window $app $geo 'activation.png'

[void][UiCheck]::SetForegroundWindow($app.Main)
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait('999999')
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 900
Save-Window $app $geo 'activation-error.png'

[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('142857')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 2
Save-Window $app $geo 'activated-main.png'
if (-not $app.Process.HasExited) { $app.Process.Kill() }

Write-Host '--- registry after activation ---'
reg query 'HKCU\Software\dBound' /v License
