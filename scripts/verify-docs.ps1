# Documentation gate for dBound.
# Checks: docs index coverage, relative links/images, forbidden release|output links,
# image inventory references, and warns about hardcoded app versions in living docs.
# Usage: pwsh -NoProfile -File scripts/verify-docs.ps1
param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$File, [int]$Line, [string]$Message) {
  $where = if ($Line -gt 0) { "$File`:$Line" } else { $File }
  $failures.Add("FAIL $where`: $Message")
}

$docsDir = Join-Path $Root 'docs'
$docsIndexPath = Join-Path $docsDir 'README.md'
$rootReadmePath = Join-Path $Root 'README.md'
$agentsPath = Join-Path $Root 'AGENTS.md'

foreach ($required in @($docsDir, $docsIndexPath, $rootReadmePath, $agentsPath)) {
  if (-not (Test-Path -LiteralPath $required)) {
    $failures.Add("FAIL $required`: required documentation file is missing")
  }
}
if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Host $_ }
  exit 1
}

# Markdown files in scope: root README, AGENTS, and everything under docs/.
$mdFiles = @(Get-Item -LiteralPath $rootReadmePath, $agentsPath)
$mdFiles += @(Get-ChildItem -LiteralPath $docsDir -Recurse -Filter *.md -File | Sort-Object FullName)
$docsIndex = Get-Content -LiteralPath $docsIndexPath -Raw -Encoding UTF8
$mdText = @{}
foreach ($md in $mdFiles) {
  $mdText[$md.FullName] = Get-Content -LiteralPath $md.FullName -Raw -Encoding UTF8
}

# 1. Every docs Markdown file must be registered in docs/README.md.
foreach ($md in $mdFiles) {
  if ($md.FullName -eq $docsIndexPath) { continue }
  if ($md.FullName -notlike "$docsDir*") { continue }
  $rel = $md.FullName.Substring($docsDir.Length + 1) -replace '\\', '/'
  if ($docsIndex -notmatch [regex]::Escape($rel)) {
    Add-Failure 'docs/README.md' 0 "index does not mention docs/$rel"
  }
}

# 2/3. Markdown links: targets must exist; release/ and output/ links are forbidden.
$linkPattern = [regex]'!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)'
foreach ($md in $mdFiles) {
  $base = [System.IO.Path]::GetDirectoryName($md.FullName)
  $lines = Get-Content -LiteralPath $md.FullName -Encoding UTF8
  for ($i = 0; $i -lt $lines.Count; $i++) {
    foreach ($match in $linkPattern.Matches($lines[$i])) {
      $target = $match.Groups[1].Value
      if ($target -match '^(https?:|mailto:|#|data:|tel:)') { continue }
      $relTarget = ($target -split '#')[0]
      if ([string]::IsNullOrWhiteSpace($relTarget)) { continue }
      if ($match.Value -match '\]\((?:\.\./)*(release|output)/') {
        Add-Failure $md.Name ($i + 1) "link to gitignored path is forbidden: $target"
        continue
      }
      if ($relTarget -match '^[A-Za-z]:|^\\\\') {
        $resolved = $relTarget
      } else {
        $resolved = Join-Path $base $relTarget
      }
      if (-not (Test-Path -LiteralPath $resolved)) {
        Add-Failure $md.Name ($i + 1) "link target does not exist: $target"
      }
    }
  }
}

# 4. Image paths written as inline code (e.g. screenshot tables) must exist locally.
$imagePattern = [regex]'(?<![\w/.-])(?:\.\./)?docs-images/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|gif)'
foreach ($md in $mdFiles) {
  $base = [System.IO.Path]::GetDirectoryName($md.FullName)
  $lines = Get-Content -LiteralPath $md.FullName -Encoding UTF8
  for ($i = 0; $i -lt $lines.Count; $i++) {
    foreach ($match in $imagePattern.Matches($lines[$i])) {
      $candidate = $match.Value
      if ($candidate -match '^docs/') {
        $resolved = Join-Path $Root $candidate
      } else {
        $resolved = Join-Path $base $candidate
        if (-not (Test-Path -LiteralPath $resolved)) {
          $resolved = Join-Path $Root $candidate
        }
      }
      if (-not (Test-Path -LiteralPath $resolved)) {
        Add-Failure $md.Name ($i + 1) "referenced image does not exist: $candidate"
      }
    }
  }
}

# 5. Every file under docs-images must be mentioned by name in some Markdown file (local asset dir).
$imagesDir = Join-Path $Root 'docs-images'
if (Test-Path -LiteralPath $imagesDir) {
  $allText = ($mdText.Values -join "`n")
  foreach ($image in Get-ChildItem -LiteralPath $imagesDir -Recurse -File) {
    if ($image.Extension -notmatch '^\.(png|jpe?g|webp|gif)$') { continue }
    if ($allText -notmatch [regex]::Escape($image.Name)) {
      Add-Failure "docs-images/$($image.Name)" 0 'image is not referenced or registered in docs/README.md'
    }
  }
}

# 6. Warn about oversized active screenshots (>500 KB); archive is exempt.
$sizeLimitBytes = 500 * 1024
$archiveSegment = "$([System.IO.Path]::DirectorySeparatorChar)archive$([System.IO.Path]::DirectorySeparatorChar)"
if (Test-Path -LiteralPath $imagesDir) {
  foreach ($image in Get-ChildItem -LiteralPath $imagesDir -Recurse -File) {
    if ($image.FullName.Contains($archiveSegment)) { continue }
    if ($image.Extension -notmatch '^\.(png|jpe?g|webp|gif)$') { continue }
    if ($image.Length -gt $sizeLimitBytes) {
      $warnings.Add("WARN docs-images/$($image.Name): $([math]::Round($image.Length / 1KB)) KB (>500 KB; compression plan D-06)")
    }
  }
}

# 7. Warn about hardcoded app versions in living docs (history files are exempt).
$versionPattern = [regex]'(?<![\d.])\d+\.\d+\.\d+(?![\d.])|Beta\d+'
foreach ($path in @($rootReadmePath, $docsIndexPath, (Join-Path $docsDir 'PRD.md'))) {
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $lines = Get-Content -LiteralPath $path -Encoding UTF8
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($versionPattern.IsMatch($lines[$i])) {
      $warnings.Add("WARN $([System.IO.Path]::GetFileName($path)):$($i + 1): possible hardcoded app version (use tauri.conf.json as the source of truth)")
    }
  }
}

$warnings | ForEach-Object { Write-Host $_ }
if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Host $_ }
  Write-Host ("DOCS FAILED: {0} error(s), {1} warning(s)" -f $failures.Count, $warnings.Count)
  exit 1
}

Write-Host ("DOCS PASS: 0 error(s), {0} warning(s); checked {1} Markdown file(s)" -f $warnings.Count, $mdFiles.Count)
exit 0
