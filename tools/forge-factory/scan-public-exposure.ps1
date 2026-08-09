param(
    [string]$RulesPath = "tools/forge-factory/forge-factory-rules.json",
    [string]$ReportPath = "artifacts/forge-factory-governance-report.json"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path

function Resolve-RepositoryPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $repoRoot $Path
}

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

function Get-RelativeRepositoryPath {
    param([string]$Path)

    $relativePath = [System.IO.Path]::GetRelativePath($repoRoot, $Path)
    return Normalize-RepositoryPath $relativePath
}

$resolvedRulesPath = Resolve-RepositoryPath $RulesPath
if (!(Test-Path -LiteralPath $resolvedRulesPath -PathType Leaf)) {
    throw "Rules file not found: $RulesPath"
}

$rules = Get-Content -LiteralPath $resolvedRulesPath -Raw | ConvertFrom-Json
$supportedExtensions = @(".html", ".md", ".js", ".css", ".json")
$filesToScan = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$violations = [System.Collections.Generic.List[object]]::new()

foreach ($configuredPath in $rules.publicPaths) {
    $resolvedPublicPath = Resolve-RepositoryPath $configuredPath
    if (!(Test-Path -LiteralPath $resolvedPublicPath)) {
        Write-Warning "Configured public path not found: $configuredPath"
        continue
    }

    $item = Get-Item -LiteralPath $resolvedPublicPath
    $candidateFiles = if ($item.PSIsContainer) {
        Get-ChildItem -LiteralPath $resolvedPublicPath -Recurse -File
    }
    else {
        @($item)
    }

    foreach ($file in $candidateFiles) {
        if ($supportedExtensions -notcontains $file.Extension.ToLowerInvariant()) {
            continue
        }

        $relativePath = Get-RelativeRepositoryPath $file.FullName
        $isProtected = $false
        foreach ($protectedPath in $rules.protectedAllowedPaths) {
            $normalizedProtectedPath = Normalize-RepositoryPath $protectedPath
            if ($relativePath.StartsWith($normalizedProtectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                $isProtected = $true
                break
            }
        }

        if (!$isProtected) {
            $filesToScan.Add($file)
        }
    }
}

foreach ($file in $filesToScan | Sort-Object FullName -Unique) {
    $relativePath = Get-RelativeRepositoryPath $file.FullName
    $lineNumber = 0

    foreach ($line in Get-Content -LiteralPath $file.FullName) {
        $lineNumber++
        foreach ($phrase in $rules.forbiddenPublicPhrases) {
            if ($line.IndexOf($phrase, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $violations.Add([PSCustomObject]@{
                    file = $relativePath
                    line = $lineNumber
                    phrase = $phrase
                    text = $line.Trim()
                })
            }
        }
    }
}

$scannedFiles = @($filesToScan | Sort-Object FullName -Unique | ForEach-Object { Get-RelativeRepositoryPath $_.FullName })
$status = if ($violations.Count -gt 0) { "failed" } else { "passed" }
$report = [PSCustomObject]@{
    ruleSet = $rules.name
    ruleVersion = $rules.version
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    status = $status
    scannedFileCount = $scannedFiles.Count
    scannedFiles = $scannedFiles
    violationCount = $violations.Count
    violations = $violations
}

$resolvedReportPath = Resolve-RepositoryPath $ReportPath
$reportDirectory = Split-Path -Parent $resolvedReportPath
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedReportPath -Encoding utf8

$summaryLines = @(
    "# Forge Factory Governance",
    "",
    "- Status: **$($status.ToUpperInvariant())**",
    "- Files scanned: $($report.scannedFileCount)",
    "- Violations: $($report.violationCount)",
    "- Report: ``$ReportPath``"
)

if ($env:GITHUB_STEP_SUMMARY) {
    $summaryLines | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}

if ($violations.Count -gt 0) {
    Write-Host "FORGE FACTORY GOVERNANCE FAILED"
    $violations | Format-Table file, line, phrase, text -AutoSize
    exit 1
}

Write-Host "FORGE FACTORY GOVERNANCE PASSED"
Write-Host "Scanned $($report.scannedFileCount) public file(s). Report: $ReportPath"
