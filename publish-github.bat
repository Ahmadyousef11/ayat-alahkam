@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

set REPO=https://github.com/Ahmadyousef11/ayat-alahkam.git

echo ============================================================
echo   Publishing to GitHub Pages
echo   %REPO%
echo ============================================================
echo.

where git >nul 2>&1 || (echo Git not found. Install from https://git-scm.com & pause & exit /b 1)

if not exist ".git" (
  git init -q
  git branch -M main
  git remote add origin %REPO%
) else (
  git remote set-url origin %REPO% 2>nul || git remote add origin %REPO%
)

git config core.autocrlf false
git config http.postBuffer 524288000
git config http.lowSpeedLimit 1000
git config http.lowSpeedTime 300

echo [1/11] Site files (40 MB) ...
git add -A -- . ":(exclude)audio"
git commit -q -m "site: pages, slides, subtitles, pdf" 2>nul
git push -u origin main || goto failed
echo       done.
echo.

for %%N in (1 2 3 4 5 6 7 8 9) do (
  echo [Lecture %%N] uploading audio ...
  git add audio/lec%%N.mp3 audio/lec%%N.opus.ogg
  git commit -q -m "audio: lecture %%N" 2>nul
  git push origin main || goto failed
  echo       lecture %%N done.
)

echo.
echo ============================================================
echo   Upload complete.
echo   Now enable Pages:  Settings ^> Pages ^> Branch: main / root
echo   Site will be:  https://ahmadyousef11.github.io/ayat-alahkam/
echo ============================================================
goto end

:failed
echo.
echo   A step failed. Just run this file again -
echo   it resumes from where it stopped, nothing is lost.

:end
echo.
pause
