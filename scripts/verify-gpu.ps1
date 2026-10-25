# Sample GPU engine utilisation for the dBound WebView2 processes.
param(
    [string]$Exe = '',
  [int]$Seconds = 8
)
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
if (-not $Exe) {
  $Exe = Join-Path $root 'src-tauri\target\release\dbound.exe'
}
if (-not $Exe -or -not (Test-Path $Exe)) { throw 'portable exe not found in release/' }
reg add 'HKCU\Software\dBound' /v License /t REG_SZ /d 1 /f | Out-Null
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class GpuCheck {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static IntPtr Find(uint procId, string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint owner; GetWindowThreadProcessId(h, out owner);
      if (owner == procId) {
        var sb = new StringBuilder(256); GetWindowText(h, sb, 256);
        if (sb.ToString() == title) { found = h; return false; }
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

function Get-AppGpu {
  $pids = @()
  Get-Process | Where-Object { $_.ProcessName -like '*dBound*' -or $_.ProcessName -eq 'msedgewebview2' } |
    ForEach-Object { $pids += $_.Id }
  $samples = Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 1 -MaxSamples $Seconds
  $sums = @()
  foreach ($sample in $samples) {
    $total = 0.0
    foreach ($counter in $sample.CounterSamples) {
      if ($counter.InstanceName -match 'pid_(\d+)_') {
        if ($pids -contains [int]$Matches[1]) { $total += $counter.CookedValue }
      }
    }
    $sums += $total
  }
  $average = ($sums | Measure-Object -Average).Average
  $maximum = ($sums | Measure-Object -Maximum).Maximum
  "{0}: avg {1:N1}%  max {2:N1}%" -f $script:label, $average, $maximum
}

$app = Start-Process -FilePath $Exe -PassThru -WindowStyle Normal
Start-Sleep -Seconds 6
$main = [GpuCheck]::Find([uint32]$app.Id, 'dBound')
if ($main -eq [IntPtr]::Zero) {
  Write-Host 'MAIN NOT FOUND'
  if (-not $app.HasExited) { $app.Kill() }
  exit 1
}

$script:label = 'window (main view)'
Get-AppGpu

$full = [IntPtr]::Zero
for ($attempt = 0; $attempt -lt 4 -and $full -eq [IntPtr]::Zero; $attempt++) {
  [void][GpuCheck]::SetForegroundWindow($main)
  Start-Sleep -Milliseconds 700
  [GpuCheck]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
  [GpuCheck]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Seconds 3
  $full = [GpuCheck]::Find([uint32]$app.Id, 'dBound Fullscreen')
}
Start-Sleep -Seconds 2
$script:label = 'fullscreen'
Get-AppGpu

Get-Process | Where-Object { $_.ProcessName -like '*dBound*' -or $_.ProcessName -eq 'msedgewebview2' } |
  ForEach-Object { try { $_.Kill() } catch {} }
