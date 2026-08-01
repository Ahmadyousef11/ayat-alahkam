@echo off
setlocal
cd /d "%~dp0"

set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY where py >nul 2>&1 && set "PY=py"
if not defined PY goto nopy

%PY% serve.py %*
goto done

:nopy
echo.
echo   Python was not found on this computer.
echo   Install it from https://www.python.org/downloads/
echo   and enable "Add python.exe to PATH" during setup.
echo.

:done
echo.
pause
