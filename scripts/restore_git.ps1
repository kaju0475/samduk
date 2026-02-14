$gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/MinGit-2.43.0-64-bit.zip"
$destPath = "$PSScriptRoot\..\.agent\git"
$zipPath = "$destPath\git.zip"

Write-Host "Creating directory: $destPath"
New-Item -ItemType Directory -Force -Path $destPath | Out-Null

Write-Host "Downloading MinGit from $gitUrl..."
Invoke-WebRequest -Uri $gitUrl -OutFile $zipPath

Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $destPath -Force

Write-Host "Cleaning up zip..."
Remove-Item -Path $zipPath -Force

Write-Host "Git installed to $destPath"
Write-Host "Please add '$destPath\cmd' to your PATH."

# Test
& "$destPath\cmd\git.exe" --version
