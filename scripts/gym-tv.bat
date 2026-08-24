@echo off
REM ─────────────────────────────────────────────────────────────────────────
REM  Tulsa Training — Cross Country : launch the gym TV display
REM
REM  Copy this file onto the gym computer (desktop is fine) and double-click
REM  it. It opens the challenge full screen in kiosk mode, with no address
REM  bar, no tabs and no way to wander off to another site.
REM
REM  To quit: Alt+F4.
REM
REM  Do NOT log in as a trainer on this machine. Kiosk mode is for the TV,
REM  and a trainer session would park an entry form and a Reset button on
REM  the wall for a month. Members log from their phones via the QR codes.
REM ─────────────────────────────────────────────────────────────────────────

set SITE=https://tt-cross-country.vercel.app/tv

REM Chrome first, then Edge, then whatever the machine's default browser is.
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set CHROME86="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set EDGE64="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist %CHROME% (
  echo Launching in Chrome kiosk mode...
  start "" %CHROME% --kiosk --disable-session-crashed-bubble --noerrdialogs %SITE%
  goto done
)
if exist %CHROME86% (
  echo Launching in Chrome kiosk mode...
  start "" %CHROME86% --kiosk --disable-session-crashed-bubble --noerrdialogs %SITE%
  goto done
)
if exist %EDGE64% (
  echo Launching in Edge kiosk mode...
  start "" %EDGE64% --kiosk %SITE% --edge-kiosk-type=fullscreen --no-first-run
  goto done
)
if exist %EDGE% (
  echo Launching in Edge kiosk mode...
  start "" %EDGE% --kiosk %SITE% --edge-kiosk-type=fullscreen --no-first-run
  goto done
)

echo Could not find Chrome or Edge in the usual places.
echo Opening in the default browser instead - press F11 for full screen,
echo then use the TV mode button on the page.
start "" %SITE%

:done
echo.
echo If the screen goes blank later, Windows is sleeping it:
echo   Settings ^> System ^> Power ^> Screen and sleep ^> Screen: Never
echo.
timeout /t 8 >nul
