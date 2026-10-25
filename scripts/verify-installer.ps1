# Installer layout check: silent install needs no activation code.
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

Write-Host '--- external resources ---'
$emojiCount = (Get-ChildItem (Join-Path $dest 'resources\emoji') -File -ErrorAction SilentlyContinue | Measure-Object).Count
$rewardCount = (Get-ChildItem (Join-Path $dest 'resources\emoji-reward') -File -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "resources/emoji: $emojiCount files  resources/emoji-reward: $rewardCount files"
if ($emojiCount -lt 1500) { throw 'resources/emoji is missing or incomplete' }
if ($rewardCount -lt 40) { throw 'resources/emoji-reward is missing or incomplete' }

Write-Host '--- installer must not write an activation marker / license.dat ---'
cmd /c 'reg query "HKCU\Software\dBound" /v License >nul 2>&1'
Write-Host "marker present: $($LASTEXITCODE -eq 0)"
Write-Host "license.dat present: $(Test-Path (Join-Path $dest 'license.dat'))"

Write-Host '--- silent uninstall ---'
$un = Start-Process -FilePath (Join-Path $dest 'uninstall.exe') -ArgumentList '/S' -Wait -PassThru
Write-Host "uninstall exit code: $($un.ExitCode)"
Start-Sleep -Seconds 2
Write-Host "install dir remains: $(Test-Path (Join-Path $dest 'dbound.exe'))"
