$gitPath = "$PSScriptRoot\..\.agent\git\cmd"
$env:PATH = "$gitPath;" + $env:PATH

Write-Host "Using Git from: $(Get-Command git | Select-Object -ExpandProperty Source)"
git --version

# Safe init
if (-not (Test-Path .git)) {
    git init
}

# Remote configuration
git remote remove origin 2>$null
git remote add origin https://github.com/kaju0475/samduk.git

# Stage and Commit
git add .
git commit -m "hotfix: fully restored git deployment via AI recovery"

# Push
Write-Host "Pushing to remote..."
git push -u origin master --force
