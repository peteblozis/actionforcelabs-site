$ErrorActionPreference = "Stop"

$rulesPath = "tools/forge-factory/forge-factory-rules.json"

if (!(Test-Path $rulesPath)) {
    Write-Error "Rules file not found: $rulesPath"
}

$rules = Get-Content $rulesPath -Raw | ConvertFrom-Json
$violations = @()

foreach ($path in $rules.publicPaths) {
    if (Test-Path $path) {
        $files = Get-ChildItem $path -Recurse -File -Include *.html,*.md,*.js,*.css,*.json -ErrorAction SilentlyContinue

        if ((Get-Item $path).PSIsContainer -eq $false) {
            $files = @(Get-Item $path)
        }

        foreach ($file in $files) {
            $lineNumber = 0
            foreach ($line in Get-Content $file.FullName) {
                $lineNumber++

                foreach ($phrase in $rules.forbiddenPublicPhrases) {
                    if ($line -like "*$phrase*") {
                        $violations += [PSCustomObject]@{
                            File = $file.FullName
                            Line = $lineNumber
                            Phrase = $phrase
                            Text = $line.Trim()
                        }
                    }
                }
            }
        }
    }
}

if ($violations.Count -gt 0) {
    Write-Host "FORGE FACTORY GOVERNANCE FAILED"
    $violations | Format-Table -AutoSize
    exit 1
}

Write-Host "FORGE FACTORY GOVERNANCE PASSED"
exit 0
