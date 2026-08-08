# Forge Factory Governance

Forge Factory v1 prevents designated private or internal wording from being published through public site paths.

## What runs

The `Forge Factory Governance` GitHub Actions workflow runs on every pull request and can also be started manually. It:

1. Reads `forge-factory-rules.json`.
2. Scans the configured public paths and supported text files.
3. Skips approved protected paths.
4. Produces `artifacts/forge-factory-governance-report.json`.
5. Fails when a forbidden phrase is found in a public file.
6. Uploads the JSON report as a workflow artifact, even when the scan fails.

## Run locally

From the repository root, run:

```powershell
./tools/forge-factory/scan-public-exposure.ps1
```

The command returns exit code `0` when the scan passes and `1` when it detects a violation. The console and JSON report identify the file, line number, phrase, and matching text.

## Rules

Edit `forge-factory-rules.json` to change public paths, protected paths, or forbidden phrases. Public paths and protected paths are repository-relative. Keep protected paths as narrow as possible.

Production deployment should not be approved until the governance workflow passes.
