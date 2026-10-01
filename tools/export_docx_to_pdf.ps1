param(
  [Parameter(Mandatory=$true)][string[]]$InputPaths,
  [Parameter(Mandatory=$true)][string]$OutputDir
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
  foreach ($inputPath in $InputPaths) {
    $resolved = Resolve-Path -LiteralPath $inputPath
    $name = [System.IO.Path]::GetFileNameWithoutExtension($resolved.Path)
    $outputPath = Join-Path $OutputDir ($name + ".pdf")
    $doc = $word.Documents.Open($resolved.Path, $false, $true)
    try {
      $doc.ExportAsFixedFormat($outputPath, 17)
      Write-Output $outputPath
    }
    finally {
      $doc.Close($false)
    }
  }
}
finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
