@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

REM Sharp GUI Auto-Update Script
REM Usage:
REM   update.bat            Update to latest stable release
REM   update.bat --pre      Include pre-releases
REM   update.bat --check    Check only, don't download

set "SCRIPT_DIR=%~dp0"

REM Try venv Python first, then system Python
if exist "%SCRIPT_DIR%venv\Scripts\python.exe" (
    "%SCRIPT_DIR%venv\Scripts\python.exe" "%SCRIPT_DIR%tools\update.py" %*
) else (
    where python >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        python "%SCRIPT_DIR%tools\update.py" %*
    ) else (
        echo [错误] 未找到 Python，请先运行 install.bat 安装
        pause
        exit /b 1
    )
)

pause
