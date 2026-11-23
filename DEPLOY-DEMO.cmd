@echo off
REM Deploy to demo.kriviinfotech.com (FTP, its own database) - see deploy\ftp-deploy.mjs
REM Add --full after a change in apps\api\package.json dependencies.
node "%~dp0deploy\ftp-deploy.mjs" demo %*
echo.
pause
