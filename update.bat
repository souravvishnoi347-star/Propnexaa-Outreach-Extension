@echo off
echo ========================================================
echo   Propnexaa Outbound Copilot - 1-Click Update Script
echo ========================================================
echo.

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed on this machine.
    echo Please download Git from https://git-scm.com or download the latest zip from GitHub.
    pause
    exit /b
)

echo Pulling latest updates from GitHub...
git pull origin main

echo.
echo ========================================================
echo   Update complete!
echo   Now open chrome://extensions and click the refresh icon (O)
echo ========================================================
echo.
pause
