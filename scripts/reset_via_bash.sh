#!/bin/bash
# SAMDUK GIT FACTORY RESET (BASH VERSION)

echo "============================"
echo "  SAMDUK GIT REPAIR (BASH)"
echo "============================"

# 1. Kill Zombie Git Processes
echo "[1/5] Killing Git processes..."
MSYS_NO_PATHCONV=1 taskkill //F //IM git.exe //T > /dev/null 2>&1 || true

# 2. Delete .git
echo "[2/5] Removing .git folder..."
rm -rf .git

# 3. Re-init
echo "[3/5] Re-initializing..."
git init
git config user.email "bot@samduk.com"
git config user.name "Samduk Bot"
git config credential.helper ""

git add .
git commit -m "feat: complete system refresh (via Bash)"

# 4. Push
echo "[4/5] Pushing to GitHub..."
# Token is embedded for safety bypassing prompts
REMOTE="https://YOUR_GITHUB_TOKEN@github.com/kaju0475/samduk.git"
git remote add origin "$REMOTE"
git push -u origin main --force

echo "============================"
echo "  SUCCESS! System Repaired."
echo "============================"
read -p "Press Enter to close..."
