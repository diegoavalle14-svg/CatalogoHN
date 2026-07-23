param(
  [string]$ApiUrl = "https://api-preview.catalogohn.com/api",
  [string]$TenantSlug = "kolben"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Search-Pattern {
  param(
    [string]$Pattern,
    [string[]]$Paths
  )

  if (Get-Command rg -ErrorAction SilentlyContinue) {
    & rg -n $Pattern @Paths
    return $LASTEXITCODE
  }

  $files = foreach ($path in $Paths) {
    if (Test-Path $path -PathType Container) {
      Get-ChildItem -Path $path -Recurse -File
    } elseif (Test-Path $path -PathType Leaf) {
      Get-Item -Path $path
    }
  }

  if (-not $files) {
    return 1
  }

  $matches = $files | Select-String -Pattern $Pattern -ErrorAction SilentlyContinue
  if ($matches) {
    $matches | ForEach-Object {
      Write-Output "$($_.Path):$($_.LineNumber):$($_.Line)"
    }
    return 0
  }

  return 1
}

Write-Host "Checking backend route syntax..."
$backendChecks = @(
  "backend/src/app.js",
  "backend/src/routes/admin.js",
  "backend/src/routes/catalog.js",
  "backend/src/routes/orders.js",
  "backend/src/routes/auth.js",
  "backend/src/routes/superadmin.js",
  "backend/src/routes/publicApi.js",
  "backend/src/middleware/auth.js",
  "backend/src/middleware/apiKeyAuth.js",
  "backend/src/middleware/rateLimit.js",
  "backend/src/services/apiKeys.js",
  "backend/src/services/apiAudit.js",
  "backend/src/services/validators.js",
  "backend/src/services/webhooks.js"
)

foreach ($file in $backendChecks) {
  node --check (Join-Path $root $file)
}

Write-Host "Checking preview source safety..."
$sourcePaths = @(
  "$root/frontend/src",
  "$root/README.md",
  "$root/DEPLOYMENT.md",
  "$root/docs/DIGITALOCEAN_DROPLET.md",
  "$root/docs/archive/AWS_PREVIEW.md",
  "$root/docs/archive/AWS_PREVIEW_UPDATE.md"
)
$sourceSearchExit = Search-Pattern -Pattern "local-demo|VITE_DEMO_MODE=true" -Paths $sourcePaths
if ($sourceSearchExit -eq 0) {
  throw "Preview safety check found demo references in preview-sensitive files."
}

Write-Host "Building frontend with preview env..."
Push-Location (Join-Path $root "frontend")
try {
  $env:VITE_API_URL = $ApiUrl
  $env:VITE_TENANT_SLUG = $TenantSlug
  $env:VITE_DEMO_MODE = "false"
  npm.cmd run build
  $bundleSearchExit = Search-Pattern -Pattern "local-demo|VITE_DEMO_MODE=true" -Paths @("dist")
  if ($bundleSearchExit -eq 0) {
    throw "Preview build contains demo references."
  }
}
finally {
  Pop-Location
}

Write-Host "Preview hardening checks passed."
