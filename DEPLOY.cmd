@echo off
REM One-step deploy to keshav.kriviinfotech.com - see deploy\deploy.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\deploy.ps1" %*
echo.
pause
