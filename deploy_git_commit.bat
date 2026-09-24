@echo off
title Awrad ^& Enjaz - Git Commit Helper
echo ========================================================
echo Preparing Git Repository for 24/7 Cloud Deployment...
echo ========================================================

cd /d "%~dp0"

if not exist ".git" (
    echo Initializing Git repository...
    git init
    git branch -M main
)

echo Staging files (ignoring temporary and cache files)...
git add .

echo Creating commit...
git commit -m "Awrad and Enjaz 24/7 Cloud Deployment with PWA and Supabase Sync"

echo.
echo ========================================================
echo Git commit completed successfully!
echo To link and push to your GitHub repo, run:
echo   git remote add origin https://github.com/USERNAME/REPO.git
echo   git push -u origin main
echo ========================================================
pause
