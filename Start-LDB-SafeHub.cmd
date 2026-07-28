@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-LDB-SafeHub.ps1"
if errorlevel 1 (
  echo.
  echo Unable to start LDB SafeHub. Review preview.err.log for details.
  pause
  exit /b 1
)
endlocal
