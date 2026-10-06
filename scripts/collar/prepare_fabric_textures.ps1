param([Parameter(Mandatory=$true)][string]$SourceDirectory, [switch]$Download)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem
$destination = Join-Path $PSScriptRoot '..\..\src\assets\fabrics'
$manifest = Get-Content (Join-Path $destination 'sources.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force $SourceDirectory | Out-Null

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class FabricScanOverlay {
    public static void Prepare(string input, string output) {
        const int size = 256, radius = 10;
        using (var source = Image.FromFile(input))
        using (var scaled = new Bitmap(size, size))
        using (var result = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
            using (var graphics = Graphics.FromImage(scaled)) {
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                using (var attributes = new ImageAttributes()) {
                    attributes.SetWrapMode(WrapMode.Tile);
                    graphics.DrawImage(source, new Rectangle(0, 0, size, size), 0, 0, source.Width, source.Height, GraphicsUnit.Pixel, attributes);
                }
            }
            var luminance = new double[size * size];
            var horizontal = new double[size * size];
            var detail = new double[size * size];
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
                var pixel = scaled.GetPixel(x, y);
                luminance[y * size + x] = .2126 * pixel.R + .7152 * pixel.G + .0722 * pixel.B;
            }
            // Periodic high-pass removes photographed lighting/dye, not yarn structure.
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
                double sum = 0;
                for (int dx = -radius; dx <= radius; dx++) sum += luminance[y * size + (x + dx + size) % size];
                horizontal[y * size + x] = sum / (2 * radius + 1);
            }
            double squares = 0;
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
                double sum = 0;
                for (int dy = -radius; dy <= radius; dy++) sum += horizontal[((y + dy + size) % size) * size + x];
                double value = luminance[y * size + x] - sum / (2 * radius + 1);
                detail[y * size + x] = value;
                squares += value * value;
            }
            double deviation = Math.Max(1, Math.Sqrt(squares / detail.Length));
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
                double value = detail[y * size + x] / deviation;
                int alpha = (int)Math.Round(Math.Min(64, Math.Abs(value) * 20));
                int colour = value < 0 ? 0 : 255;
                result.SetPixel(x, y, Color.FromArgb(alpha, colour, colour, colour));
            }
            result.Save(output, ImageFormat.Png);
        }
    }
}
'@

$scanPresets = @($manifest.presets | Where-Object { $_.sourceStatus -eq 'verified' -and $_.sourceType -eq 'scan-cc0' })
$existingChecksums = Get-Content (Join-Path $destination 'checksums.json') -Raw | ConvertFrom-Json
$checksums = @($existingChecksums | Where-Object { $_.fabricPresetId -notin $scanPresets.fabricPresetId })
foreach ($preset in $scanPresets) {
    $source = $preset.source
    if ($source.license -ne 'CC0-1.0' -or !$source.constructionEvidence) { throw "Unverified provenance: $($preset.fabricPresetId)" }
    $inputFile = Join-Path $SourceDirectory $source.originalFilename
    if (!(Test-Path $inputFile)) {
        if (!$Download) { throw "Missing $inputFile. Use -Download to obtain the CC0 source." }
        if ($source.download -match '\.zip$') {
            $archivePath = Join-Path $SourceDirectory ($source.assetId + '.zip')
            try {
                Invoke-WebRequest $source.download -OutFile $archivePath -UseBasicParsing
                $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
                try {
                    $entry = $archive.Entries | Where-Object { $_.Name -eq $source.originalFilename } | Select-Object -First 1
                    if (!$entry) { throw "Colour map missing from $archivePath" }
                    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $inputFile, $true)
                } finally { $archive.Dispose() }
            } finally { if (Test-Path $archivePath) { Remove-Item $archivePath } }
        } else { Invoke-WebRequest $source.download -OutFile $inputFile -UseBasicParsing }
    }
    $sourceHash = (Get-FileHash $inputFile -Algorithm SHA256).Hash.ToLower()
    if ($sourceHash -ne $source.sourceSha256) { throw "Source checksum mismatch: $($preset.fabricPresetId)" }
    $originalFile = Join-Path $destination $source.originalFile
    New-Item -ItemType Directory -Force (Split-Path $originalFile) | Out-Null
    if ([IO.Path]::GetFullPath($inputFile) -ne [IO.Path]::GetFullPath($originalFile)) { Copy-Item $inputFile $originalFile }
    $outputFile = Join-Path $destination $source.normalizedFile
    [FabricScanOverlay]::Prepare($inputFile, $outputFile)
    $checksums += [ordered]@{ fabricPresetId = $preset.fabricPresetId; sourceSha256 = $sourceHash; outputSha256 = (Get-FileHash $outputFile -Algorithm SHA256).Hash.ToLower() }
    Write-Output "$($preset.fabricPresetId): $((Get-Item $outputFile).Length) bytes"
}
ConvertTo-Json -InputObject @($checksums) | Set-Content (Join-Path $destination 'checksums.json') -Encoding UTF8
