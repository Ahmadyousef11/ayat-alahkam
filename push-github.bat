@echo off
setlocal
cd /d "%~dp0"
set /a TRY=0

echo ============================================================
echo   Uploading remaining data to GitHub
echo   It retries by itself if the connection drops.
echo ============================================================
echo.

:retry
set /a TRY+=1
echo Attempt %TRY% ...
git push origin main
if not errorlevel 1 goto ok
if %TRY% GEQ 20 goto giveup
echo   connection dropped - retrying in 5 seconds ...
timeout /t 5 /nobreak >nul
goto retry

:ok
echo.
echo ============================================================
echo   Upload complete.
echo   Site:  https://ahmadyousef11.github.io/ayat-alahkam/
echo ============================================================
pause
exit /b 0

:giveup
echo.
echo   Tried 20 times without success. Check the internet
echo   connection, then run this file again.
pause
exit /b 1
