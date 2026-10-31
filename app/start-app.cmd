@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install Node.js 20 or newer from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies, this happens only once...
  call npm install
  if errorlevel 1 ( echo Install failed. & pause & exit /b 1 )
)
if not exist dist (
  echo Building the app...
  call npm run build
  if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
)
echo.
echo Starting Sakin at http://127.0.0.1:4173  (close this window to stop)
start "" http://localhost:4173
call npm run preview
pause
