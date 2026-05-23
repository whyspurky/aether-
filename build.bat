@echo off
chcp 65001 >nul
taskkill /f /im aether-tauri.exe >nul 2>&1
call npm run tauri build
start "" "src-tauri\target\release\aether-tauri.exe"
pause