@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo ============================================================
echo   Publishing your changes to the live site
echo   https://ahmadyousef11.github.io/ayat-alahkam/
echo ============================================================
echo.

git add -A
git diff --cached --quiet && (echo   Nothing changed since last publish. & echo. & pause & exit /b 0)

echo Changed files:
git diff --cached --name-only
echo.

for /f "tokens=1-4 delims=/: " %%a in ("%date% %time%") do set STAMP=%%a-%%b-%%c
git commit -q -m "update %STAMP%"

set /a TRY=0
:retry
set /a TRY+=1
echo Uploading (attempt %TRY%) ...
git push origin main
if not errorlevel 1 goto ok
if %TRY% GEQ 20 goto giveup
echo   connection dropped - retrying in 5 seconds ...
timeout /t 5 /nobreak >nul
goto retry

:ok
echo.
echo ============================================================
echo   Done. The live site updates within about a minute.
echo   Press Ctrl+Shift+R in the browser to see it.
echo ============================================================
pause
exit /b 0

:giveup
echo.
echo   Could not upload after 20 tries. Check the internet
echo   connection and run this file again - nothing is lost.
pause
exit /b 1
