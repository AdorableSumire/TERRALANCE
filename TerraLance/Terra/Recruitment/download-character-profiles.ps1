param(
    [switch]$Overwrite
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $scriptDir 'akhr-image-manifest.json'
$profileDir = Join-Path $scriptDir 'Character Profile'
$tempDir = Join-Path $scriptDir '.image-temp'
$reportPath = Join-Path $scriptDir 'character-profile-download-report.json'

if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

New-Item -ItemType Directory -Force $profileDir | Out-Null
New-Item -ItemType Directory -Force $tempDir | Out-Null

Add-Type -AssemblyName System.Drawing

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]
$downloaded = 0
$skipped = 0
$failed = 0

foreach ($entry in $manifest) {
    $baseName = Split-Path -Leaf $entry.imageLocalBase
    $destPath = Join-Path $profileDir ($baseName + '.png')

    if ([string]::IsNullOrWhiteSpace($entry.imageRemote)) {
        $results.Add([PSCustomObject]@{
            name = $entry.name
            status = 'missing-remote'
            file = $destPath
        }) | Out-Null
        $failed += 1
        continue
    }

    if ((Test-Path $destPath) -and -not $Overwrite) {
        $results.Add([PSCustomObject]@{
            name = $entry.name
            status = 'skipped-existing'
            file = $destPath
        }) | Out-Null
        $skipped += 1
        continue
    }

    try {
        $uri = [Uri]$entry.imageRemote
        $ext = [IO.Path]::GetExtension($uri.AbsolutePath)
        if ([string]::IsNullOrWhiteSpace($ext)) {
            $ext = '.img'
        }

        $tempPath = Join-Path $tempDir ($baseName + $ext)
        Invoke-WebRequest -Uri $entry.imageRemote -OutFile $tempPath

        $image = [System.Drawing.Image]::FromFile($tempPath)
        try {
            $image.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $image.Dispose()
        }

        Remove-Item $tempPath -Force -ErrorAction SilentlyContinue

        $results.Add([PSCustomObject]@{
            name = $entry.name
            status = 'downloaded'
            file = $destPath
        }) | Out-Null
        $downloaded += 1
    }
    catch {
        $results.Add([PSCustomObject]@{
            name = $entry.name
            status = 'failed'
            file = $destPath
            message = $_.Exception.Message
        }) | Out-Null
        $failed += 1
    }
}

$report = [PSCustomObject]@{
    downloaded = $downloaded
    skipped = $skipped
    failed = $failed
    generatedAt = (Get-Date).ToString('s')
    items = $results
}

$report | ConvertTo-Json -Depth 5 | Set-Content $reportPath
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "Downloaded: $downloaded"
Write-Output "Skipped: $skipped"
Write-Output "Failed: $failed"
Write-Output "Report: $reportPath"
