# Installer layout check: silent install needs no activation code.
param(
  [string]$Installer = 'D:\Project\Tauri\dBound\release\dBound_1.0.1_x64-setup.exe',
  [string]$OutDir = 'D:\Project\Tauri\dBound\output\screenshots'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$dest = Join-Path $env:TEMP 'dbound-install-layout'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
cmd /c 'reg delete "HKCU\Software\dBound" /f >nul 2>&1'

Write-Host '--- silent install (no activation code) ---'
$install = Start-Process -FilePath $Installer -ArgumentList '/S', "/D=$dest" -Wait -PassThru
Write-Host "exit code: $($install.ExitCode)"
Write-Host "install dir exists: $(Test-Path $dest)"

Write-Host '--- installed layout ---'
Get-ChildItem $dest -Recurse -File | Sort-Object FullName | ForEach-Object {
  $_.FullName.Substring($dest.Length + 1) + "  $($_.Length) bytes"
}

Write-Host '--- installer must not write an activation marker / license.dat ---'
cmd /c 'reg query "HKCU\Software\dBound" /v License >nul 2>&1'
Write-Host "marker present: $($LASTEXITCODE -eq 0)"
Write-Host "license.dat present: $(Test-Path (Join-Path $dest 'license.dat'))"

Write-Host '--- silent uninstall ---'
$un = Start-Process -FilePath (Join-Path $dest 'uninstall.exe') -ArgumentList '/S' -Wait -PassThru
Write-Host "uninstall exit code: $($un.ExitCode)"
Start-Sleep -Seconds 2
Write-Host "install dir remains: $(Test-Path (Join-Path $dest 'dbound.exe'))"
