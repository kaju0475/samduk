@echo off
echo GIT REMOTE AUDIT > remote_audit.txt
echo [1] LS-REMOTE >> remote_audit.txt
git ls-remote origin >> remote_audit.txt 2>&1
echo [2] REMOTE SHOW ORIGIN >> remote_audit.txt
git remote show origin >> remote_audit.txt 2>&1
echo [3] LOCAL HEADS >> remote_audit.txt
git branch -a -vv >> remote_audit.txt 2>&1
echo [4] VERCEL SYNC CHECK >> remote_audit.txt
echo Current Local Branch: >> remote_audit.txt
git rev-parse --abbrev-ref HEAD >> remote_audit.txt 2>&1
echo Current Hash: >> remote_audit.txt
git rev-parse HEAD >> remote_audit.txt 2>&1
echo DONE >> remote_audit.txt
