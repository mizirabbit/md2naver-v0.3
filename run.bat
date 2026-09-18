@echo off
cd /d "%~dp0"
echo.
echo MD2Naver Paste UI v0.3 starting: http://localhost:8766
echo Close this window to stop the server.
echo.
start "" "http://localhost:8766/?version=paste-v0.3"
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8766
) else (
  python -m http.server 8766
)
