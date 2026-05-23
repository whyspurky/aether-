@echo off
chcp 65001 >nul
echo ========================================
echo   Aether Dev Mode
echo ========================================
echo.
call npm run tauri dev
pause