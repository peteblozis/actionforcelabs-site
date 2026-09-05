param(
  [string]$TesterPath = "tester/freezerflow-lifefit/index.html"
)
$ErrorActionPreference="Stop"
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$path=Join-Path $repoRoot $TesterPath
if(!(Test-Path -LiteralPath $path -PathType Leaf)){throw "Missing FreezerFlow tester page"}
$content=Get-Content -LiteralPath $path -Raw
$logicPath=Join-Path (Split-Path -Parent $path) "logic.js"
if(!(Test-Path -LiteralPath $logicPath -PathType Leaf)){throw "Missing FreezerFlow decision logic"}
$logicContent=Get-Content -LiteralPath $logicPath -Raw
$combined=$content+[Environment]::NewLine+$logicContent

$required=@(
  "LifeFit Cooking Profile",
  "Best Next Meal",
  "Use Priority",
  "Opened / partial",
  "Leftover / already cooked",
  "serving",
  "Quick Meal Library",
  "Large / spacious view",
  "165°F",
  "145°F",
  "logic.js"
)
foreach($term in $required){
  if($combined.IndexOf($term,[System.StringComparison]::OrdinalIgnoreCase)-lt 0){
    throw "Missing required FreezerFlow contract term: $term"
  }
}

$forbidden=@(
  "peteblozis@gmail.com",
  "AFib",
  "TAVR",
  "Dr. Colligan",
  "SageForge Core",
  "#SFC",
  "#ACTS",
  "ForgeShield",
  "MACIE"
)
foreach($term in $forbidden){
  if($combined.IndexOf($term,[System.StringComparison]::OrdinalIgnoreCase)-ge 0){
    throw "Private or internal term exposed in FreezerFlow tester source: $term"
  }
}

Write-Host "FREEZERFLOW STATIC PRODUCT-SPINE TEST PASSED"