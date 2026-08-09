param(
    [string]$RulesPath = "tools/forge-factory/forge-factory-rules.json",
    [string]$ReportPath = "artifacts/forge-factory-governance-report.json"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path

function Normalize-RepositoryPath {
    param([string]$Path)

    return $Path.Replace(
        [System.IO.Path]::DirectorySeparatorChar,
        [char]"/"
    ).Replace(
        [System.IO.Path]::AltDirectorySeparatorChar,
        [char]"/"
    ).TrimStart([char]"/")
}

$rules = Get-Content -LiteralPath (Join-Path $repoRoot $RulesPath) -Raw | ConvertFrom-Json
$report = Get-Content -LiteralPath (Join-Path $repoRoot $ReportPath) -Raw | ConvertFrom-Json
$adminPath = Join-Path $repoRoot "public/admin/index.html"

if (!(Test-Path -LiteralPath $adminPath -PathType Leaf)) {
    throw "Regression fixture missing: public/admin/index.html"
}

$adminContent = Get-Content -LiteralPath $adminPath -Raw
$fixturePhrase = $rules.forbiddenPublicPhrases |
    Where-Object { $adminContent.IndexOf($_, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } |
    Select-Object -First 1

if (!$fixturePhrase) {
    throw "Regression fixture must contain a configured forbidden phrase."
}

$scannedFiles = @($report.scannedFiles | ForEach-Object { Normalize-RepositoryPath $_ })
if ($scannedFiles -notcontains "index.html") {
    throw "Public root index.html was not scanned."
}

$protectedFilesScanned = @(
    foreach ($file in $scannedFiles) {
        foreach ($protectedPath in $rules.protectedAllowedPaths) {
            $normalizedProtectedPath = Normalize-RepositoryPath $protectedPath
            if ($file.StartsWith($normalizedProtectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                $file
                break
            }
        }
    }
)

if ($protectedFilesScanned.Count -gt 0) {
    throw "Protected files were scanned: $($protectedFilesScanned -join ', ')"
}

if ($report.status -ne "passed" -or $report.violationCount -ne 0) {
    throw "Governance report did not pass cleanly."
}

Write-Host "FORGE FACTORY PATH REGRESSION PASSED"
Write-Host "Verified Windows-safe protected-path handling and public-root scanning."
