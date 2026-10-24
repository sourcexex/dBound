# P2 acceptance: edit a threshold, confirm the main page follows, restart and confirm persistence.
param(
  [string]$Exe = 'D:\Project\Tauri\dBound\src-tauri\target\debug\dbound.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class P2Check {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@

[void][P2Check]::SetProcessDPIAware()
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$script:handle = [IntPtr]::Zero
$script:origin = New-Object P2Check+POINT
$script:size = New-Object P2Check+RECT
$script:scale = 1.5
$script:process = $null

function Start-App {
  $script:process = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    $script:process.Refresh()
    if ($script:process.HasExited) { break }
    if ($script:process.MainWindowHandle -ne [IntPtr]::Zero) { $script:handle = $script:process.MainWindowHandle; break }
  }
  if ($script:handle -eq [IntPtr]::Zero) { throw 'window not found' }
  [void][P2Check]::SetForegroundWindow($script:handle)
  Start-Sleep -Seconds 5

  $client = New-Object P2Check+RECT
  [void][P2Check]::GetClientRect($script:handle, [ref]$client)
  $script:origin = New-Object P2Check+POINT
  [void][P2Check]::ClientToScreen($script:handle, [ref]$script:origin)
  $script:size = $client
  $script:scale = ($client.Right - $client.Left) / 420.0
}

function Stop-App {
  if ($script:process -and -not $script:process.HasExited) { $script:process.Kill(); Start-Sleep -Milliseconds 500 }
}

function Save-Shot([string]$name) {
  $w = $script:size.Right - $script:size.Left
  $h = $script:size.Bottom - $script:size.Top
  $bitmap = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($script:origin.X, $script:origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $bitmap.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Host "saved $name"
}

function Click-At([double]$cssX, [double]$cssY) {
  $x = [int]($script:origin.X + $cssX * $script:scale)
  $y = [int]($script:origin.Y + $cssY * $script:scale)
  [void][P2Check]::SetForegroundWindow($script:handle)
  [void][P2Check]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 200
  [P2Check]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [P2Check]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 600
}

Start-App

# Open settings -> levels -> expand the first level -> drag its threshold to ~90 dB.
Click-At 342 24
Click-At 132 62
Click-At 150 253
Save-Shot 'p2-before-edit.png'
Click-At 300 339
Save-Shot 'p2-after-edit.png'

# Back to the main page: 72 dB no longer clears the raised threshold.
Click-At 30 24
Save-Shot 'p2-main-after-edit.png'
Stop-App

# Restart and confirm the edited threshold survived.
Start-App
Click-At 342 24
Click-At 132 62
Save-Shot 'p2-persisted.png'
Stop-App
