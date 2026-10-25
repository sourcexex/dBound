# Capture the interactive NSIS installer pages (welcome + serial gate).
param(
  [string]$Installer = 'D:\Project\Tauri\dBound\src-tauri\target\release\bundle\nsis\dBound_1.0.1_x64-setup.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class NsisCheck {
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
[void][NsisCheck]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Find-NsisWindow([int]$procId) {
  $script:found = [IntPtr]::Zero
  $script:bestArea = 0
  $cb = [NsisCheck+EnumProc]{
    param($hWnd, $lParam)
    if (-not [NsisCheck]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][NsisCheck]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $rect = New-Object NsisCheck+RECT
    [void][NsisCheck]::GetWindowRect($hWnd, [ref]$rect)
    $area = ($rect.Right - $rect.Left) * ($rect.Bottom - $rect.Top)
    if ($area -gt $script:bestArea) {
      $script:bestArea = $area
      $script:found = $hWnd
    }
    return $true
  }
  [void][NsisCheck]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

function Save-Window([IntPtr]$hwnd, [string]$name) {
  $rect = New-Object NsisCheck+RECT
  [void][NsisCheck]::GetWindowRect($hwnd, [ref]$rect)
  $bmp = New-Object System.Drawing.Bitmap ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top)))
  $bmp.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "saved $name"
}

$process = Start-Process -FilePath $Installer -PassThru
$win = [IntPtr]::Zero
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  $process.Refresh()
  if ($process.HasExited) { break }
  $win = Find-NsisWindow $process.Id
  if ($win -ne [IntPtr]::Zero) { break }
}
if ($win -eq [IntPtr]::Zero) { Write-Host 'installer window not found'; exit 1 }
[void][NsisCheck]::SetForegroundWindow($win)
Start-Sleep -Seconds 2
Save-Window $win 'installer-welcome.png'

# Next page: serial gate
[void][NsisCheck]::SetForegroundWindow($win)
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 1
Save-Window $win 'installer-serial.png'

# Abort without installing
if (-not $process.HasExited) { $process.Kill() }
Write-Host 'done'
