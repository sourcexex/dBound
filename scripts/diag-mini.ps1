# Diagnostic: open the mini window, dump page-load events.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Diag {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][Diag]::SetProcessDPIAware()

function Find-Window([int]$procId, [string]$title) {
  $script:found = [IntPtr]::Zero
  $cb = [Diag+EnumProc]{
    param($hWnd, $lParam)
    if (-not [Diag]::IsWindowVisible($hWnd)) { return $true }
    $owner = 0
    [void][Diag]::GetWindowThreadProcessId($hWnd, [ref]$owner)
    if ($owner -ne $procId) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][Diag]::GetWindowText($hWnd, $sb, 256)
    if ($sb.ToString() -eq $title) { $script:found = $hWnd; return $false }
    return $true
  }
  [void][Diag]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

$out = Join-Path $env:TEMP 'dbound-diag-out.log'
$err = Join-Path $env:TEMP 'dbound-diag-err.log'
Remove-Item $out, $err -ErrorAction SilentlyContinue

$process = Start-Process -FilePath 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe' -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
Start-Sleep -Seconds 6

$main = Find-Window $process.Id 'dBound'
Write-Host "main handle: $main"
if ($main -eq [IntPtr]::Zero) { $process.Kill(); throw 'main not found' }

$rect = New-Object Diag+RECT
[void][Diag]::GetWindowRect($main, [ref]$rect)
Write-Host "main rect: $($rect.Left),$($rect.Top) - $($rect.Right),$($rect.Bottom)"

[void][Diag]::SetForegroundWindow($main)
$scale = 1.5
$x = [int]($rect.Left + 11 + 314 * $scale)
$y = [int]($rect.Top + 11 + 24 * $scale)
Write-Host "click mini at $x,$y"
[void][Diag]::SetCursorPos($x, $y)
Start-Sleep -Milliseconds 250
[Diag]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[Diag]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Seconds 6

$mini = Find-Window $process.Id 'dBound Mini'
Write-Host "mini handle: $mini"
if ($mini -ne [IntPtr]::Zero) {
  $miniRect = New-Object Diag+RECT
  [void][Diag]::GetWindowRect($mini, [ref]$miniRect)
  Write-Host "mini rect: $($miniRect.Left),$($miniRect.Top) - $($miniRect.Right),$($miniRect.Bottom)"
  $w = $miniRect.Right - $miniRect.Left
  $h = $miniRect.Bottom - $miniRect.Top
  $bitmap = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($miniRect.Left, $miniRect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bitmap.Save('D:\Project\Tauri\dBound\output\screenshots\diag-mini.png', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
  Write-Host 'saved diag-mini.png'
}

Start-Sleep -Seconds 1
Write-Host '--- stdout ---'
Get-Content $out -ErrorAction SilentlyContinue
Write-Host '--- stderr ---'
Get-Content $err -ErrorAction SilentlyContinue
if (-not $process.HasExited) { $process.Kill() }
