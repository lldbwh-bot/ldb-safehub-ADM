$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$indexPath = Join-Path $projectRoot 'index.html'
$packagePath = Join-Path $projectRoot 'package.json'
$metadataPath = Join-Path $projectRoot 'metadata.json'
$readmePath = Join-Path $projectRoot 'README.md'
$envExamplePath = Join-Path $projectRoot '.env.example'

$index = Get-Content -Raw -LiteralPath $indexPath
$redirectMarker = "window.location.replace('http://127.0.0.1:3000/')"
$redirectPosition = $index.IndexOf($redirectMarker, [System.StringComparison]::Ordinal)
$modulePosition = $index.IndexOf('src="/src/main.tsx"', [System.StringComparison]::Ordinal)

if ($redirectPosition -lt 0) {
  throw 'index.html does not redirect file:// launches to the local LDB SafeHub server.'
}

if ($modulePosition -lt 0 -or $redirectPosition -gt $modulePosition) {
  throw 'The file:// redirect must execute before the Vite module entry.'
}

if ($index -match 'Google AI Studio') {
  throw 'index.html still contains Google AI Studio branding.'
}

$package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
if ($package.name -ne 'ldb-safehub') {
  throw "Unexpected package name: $($package.name)"
}

if ($package.dependencies.PSObject.Properties.Name -contains '@google/genai') {
  throw 'package.json still depends on the unused @google/genai package.'
}

$metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
if (@($metadata.majorCapabilities) -contains 'MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API') {
  throw 'metadata.json still declares the Gemini API capability.'
}

foreach ($path in @($readmePath, $envExamplePath)) {
  if ((Get-Content -Raw -LiteralPath $path) -match 'AI Studio|GEMINI_API_KEY|Gemini API') {
    throw "AI Studio packaging remains in $path"
  }
}

Write-Output 'Standalone entry smoke test passed.'
