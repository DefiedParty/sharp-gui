@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM Sharp GUI - Windows 一键安装脚本
REM 自动拉取 Apple ml-sharp 并部署 GUI
REM
REM 依赖自动安装策略 (三层 fallback):
REM   1. winget install (Win10/11 自带包管理器)
REM   2. PowerShell 下载安装包 + 静默安装 (国内镜像优先)
REM   3. 显示手动安装指引
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Sharp GUI - Windows 安装脚本
echo   https://github.com/apple/ml-sharp
echo ========================================
echo.

set SHARP_REPO=https://github.com/apple/ml-sharp.git
set SHARP_DIR=ml-sharp
set SCRIPT_DIR=%~dp0

REM --- 版本配置 (更新依赖版本时只需修改这里) ---
set PYTHON_INSTALL_VERSION=3.12.8
set GIT_INSTALL_VERSION=2.47.1

REM ============================================================
REM  辅助函数: 刷新当前会话的 PATH (从注册表读取最新值)
REM  安装软件后无需重启终端
REM ============================================================
:refresh_path
    set "SYS_PATH="
    set "USR_PATH="
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%b"
    if defined SYS_PATH if defined USR_PATH (
        set "PATH=!SYS_PATH!;!USR_PATH!"
    ) else if defined SYS_PATH (
        set "PATH=!SYS_PATH!"
    )
    goto :eof

REM ============================================================
REM  辅助函数: 通过 PowerShell 下载文件
REM  参数: %1=URL %2=保存路径
REM ============================================================
:download_file
    echo 正在下载: %~1
    echo 保存到:   %~2
    powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%~1' -OutFile '%~2' -UseBasicParsing; exit 0 } catch { Write-Host \"下载失败: $_\"; exit 1 }"
    goto :eof

REM ============================================================
REM  检测 winget 是否可用
REM ============================================================
set HAS_WINGET=false
where winget >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set HAS_WINGET=true
)

REM ============================================================
REM  [1/8] 检测 Python
REM ============================================================
echo [1/8] 检查 Python 环境...

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [警告] 未找到 Python！
    echo.

    REM --- 第一层: 尝试 winget ---
    if "!HAS_WINGET!"=="true" (
        echo ================================================================
        echo   可以自动安装 Python %PYTHON_INSTALL_VERSION% (通过 winget)
        echo ================================================================
        echo.
        set /p INSTALL_PYTHON="是否自动安装? [Y/n] "
        if /i "!INSTALL_PYTHON!"=="n" (
            goto :ps_python
        )

        echo.
        echo 正在通过 winget 安装 Python...
        echo (如果弹出 UAC 权限确认，请点击"是")
        echo.
        winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
        if !ERRORLEVEL! equ 0 (
            echo.
            echo [OK] Python 安装完成，正在刷新环境变量...
            call :refresh_path
            where python >nul 2>&1
            if !ERRORLEVEL! equ 0 (
                echo [OK] Python 已就绪！
                goto :python_found
            )
        )
        echo [警告] winget 安装未成功，尝试备用方案...
        echo.
    )

    REM --- 第二层: PowerShell 下载安装包 ---
    :ps_python
    echo ================================================================
    echo   尝试自动下载并安装 Python %PYTHON_INSTALL_VERSION%
    echo   (使用国内镜像加速)
    echo ================================================================
    echo.
    set /p PS_INSTALL_PYTHON="是否自动下载安装 Python? [Y/n] "
    if /i "!PS_INSTALL_PYTHON!"=="n" (
        goto :manual_python
    )

    set "PYTHON_INSTALLER=%TEMP%\python-installer.exe"

    REM 优先使用国内镜像 (npmmirror)
    echo.
    echo [1/2] 正在下载 Python 安装包 (国内镜像)...
    call :download_file "https://registry.npmmirror.com/-/binary/python/%PYTHON_INSTALL_VERSION%/python-%PYTHON_INSTALL_VERSION%-amd64.exe" "!PYTHON_INSTALLER!"
    if !ERRORLEVEL! neq 0 (
        echo [警告] 国内镜像下载失败，尝试官方源...
        call :download_file "https://www.python.org/ftp/python/%PYTHON_INSTALL_VERSION%/python-%PYTHON_INSTALL_VERSION%-amd64.exe" "!PYTHON_INSTALLER!"
        if !ERRORLEVEL! neq 0 (
            echo [错误] 下载失败，请手动安装
            goto :manual_python
        )
    )

    echo.
    echo [2/2] 正在安装 Python (静默模式)...
    echo (如果弹出 UAC 权限确认，请点击"是")
    "!PYTHON_INSTALLER!" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_venv=1
    if !ERRORLEVEL! neq 0 (
        echo [警告] 静默安装失败，尝试交互式安装...
        echo 请在弹出的安装界面中勾选 "Add Python to PATH"！
        "!PYTHON_INSTALLER!"
    )

    REM 清理安装包
    del "!PYTHON_INSTALLER!" 2>nul

    echo.
    echo 正在刷新环境变量...
    call :refresh_path

    REM Python 默认安装路径可能不在刷新后的 PATH 中，主动尝试
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PATH=!PATH!;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
    )
    if exist "C:\Python312\python.exe" (
        set "PATH=!PATH!;C:\Python312;C:\Python312\Scripts"
    )
    if exist "%ProgramFiles%\Python312\python.exe" (
        set "PATH=!PATH!;%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts"
    )

    where python >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [错误] 安装完成但仍然检测不到 Python
        echo         请关闭此窗口，重新打开命令提示符再运行 install.bat
        pause
        exit /b 1
    )
    echo [OK] Python 安装成功！
    goto :python_found
)

:python_found
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] 找到 Python: %PYTHON_VERSION%

REM 检查 Python 版本 >= 3.10
for /f "tokens=1,2 delims=." %%a in ("%PYTHON_VERSION%") do (
    set PYTHON_MAJOR=%%a
    set PYTHON_MINOR=%%b
)
if %PYTHON_MAJOR% LSS 3 (
    echo [错误] 需要 Python 3.10+，当前版本 %PYTHON_VERSION%
    pause
    exit /b 1
)
if %PYTHON_MAJOR% EQU 3 if %PYTHON_MINOR% LSS 10 (
    echo [错误] 需要 Python 3.10+，当前版本 %PYTHON_VERSION%
    pause
    exit /b 1
)

REM 检查 venv 模块
python -m venv --help >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] Python venv 模块不可用！
    echo 请重新安装 Python 并确保勾选 pip 和 venv 选项
    pause
    exit /b 1
)

goto :check_git

REM --- 第三层: 手动安装 Python 的提示 ---
:manual_python
    echo.
    echo ================================================================
    echo          请手动安装 Python 3.10+ (Install Python)
    echo ================================================================
    echo.
    echo   1. 从官网下载: https://www.python.org/downloads/
    echo.
    echo   2. 安装时务必勾选 "Add Python to PATH"！
    echo      (IMPORTANT: Check "Add Python to PATH")
    echo.
    echo   3. 安装完成后，关闭此窗口并重新运行 install.bat
    echo.
    echo ================================================================
    pause
    exit /b 1

REM ============================================================
REM  [2/8] 检测 Git
REM ============================================================
:check_git
echo.
echo [2/8] 检查 Git...

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [警告] 未找到 Git！
    echo.

    REM --- 第一层: 尝试 winget ---
    if "!HAS_WINGET!"=="true" (
        echo ================================================================
        echo   可以自动安装 Git (通过 winget)
        echo ================================================================
        echo.
        set /p INSTALL_GIT="是否自动安装? [Y/n] "
        if /i "!INSTALL_GIT!"=="n" (
            goto :ps_git
        )

        echo.
        echo 正在通过 winget 安装 Git...
        echo (如果弹出 UAC 权限确认，请点击"是")
        echo.
        winget install Git.Git --accept-source-agreements --accept-package-agreements
        if !ERRORLEVEL! equ 0 (
            echo.
            echo [OK] Git 安装完成，正在刷新环境变量...
            call :refresh_path
            if exist "C:\Program Files\Git\cmd" (
                set "PATH=!PATH!;C:\Program Files\Git\cmd"
            )
            where git >nul 2>&1
            if !ERRORLEVEL! equ 0 (
                echo [OK] Git 已就绪！
                goto :git_found
            )
        )
        echo [警告] winget 安装未成功，尝试备用方案...
        echo.
    )

    REM --- 第二层: PowerShell 下载安装包 ---
    :ps_git
    echo ================================================================
    echo   尝试自动下载并安装 Git %GIT_INSTALL_VERSION%
    echo   (使用国内镜像加速)
    echo ================================================================
    echo.
    set /p PS_INSTALL_GIT="是否自动下载安装 Git? [Y/n] "
    if /i "!PS_INSTALL_GIT!"=="n" (
        goto :manual_git
    )

    set "GIT_INSTALLER=%TEMP%\git-installer.exe"

    REM 优先使用国内镜像 (npmmirror)
    echo.
    echo [1/2] 正在下载 Git 安装包 (国内镜像)...
    call :download_file "https://registry.npmmirror.com/-/binary/git-for-windows/v%GIT_INSTALL_VERSION%.windows.1/Git-%GIT_INSTALL_VERSION%-64-bit.exe" "!GIT_INSTALLER!"
    if !ERRORLEVEL! neq 0 (
        echo [警告] 国内镜像下载失败，尝试官方源...
        call :download_file "https://github.com/git-for-windows/git/releases/download/v%GIT_INSTALL_VERSION%.windows.1/Git-%GIT_INSTALL_VERSION%-64-bit.exe" "!GIT_INSTALLER!"
        if !ERRORLEVEL! neq 0 (
            echo [错误] 下载失败，请手动安装
            goto :manual_git
        )
    )

    echo.
    echo [2/2] 正在安装 Git (静默模式)...
    echo (如果弹出 UAC 权限确认，请点击"是")
    "!GIT_INSTALLER!" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"
    if !ERRORLEVEL! neq 0 (
        echo [警告] 静默安装失败，尝试交互式安装...
        echo 请在弹出的安装界面中使用默认设置即可
        "!GIT_INSTALLER!"
    )

    REM 清理安装包
    del "!GIT_INSTALLER!" 2>nul

    echo.
    echo 正在刷新环境变量...
    call :refresh_path

    REM Git 默认安装路径
    if exist "C:\Program Files\Git\cmd" (
        set "PATH=!PATH!;C:\Program Files\Git\cmd"
    )

    where git >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [错误] 安装完成但仍然检测不到 Git
        echo         请关闭此窗口，重新打开命令提示符再运行 install.bat
        pause
        exit /b 1
    )
    echo [OK] Git 安装成功！
    goto :git_found
)

:git_found
echo [OK] Git 已安装

REM 补充 Git for Windows 自带的工具路径 (OpenSSL 等)
if exist "C:\Program Files\Git\usr\bin" (
    set "PATH=!PATH!;C:\Program Files\Git\usr\bin"
)

goto :check_cuda

REM --- 第三层: 手动安装 Git 的提示 ---
:manual_git
    echo.
    echo ================================================================
    echo            请手动安装 Git (Install Git)
    echo ================================================================
    echo.
    echo   从官网下载: https://git-scm.com/download/win
    echo.
    echo   安装时使用默认设置即可
    echo.
    echo ================================================================
    pause
    exit /b 1

REM ============================================================
REM  [3/8] 检查 CUDA
REM ============================================================
:check_cuda
echo.
echo [3/8] 检查 CUDA 环境...

where nvcc >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=5" %%i in ('nvcc --version ^| findstr release') do set CUDA_VERSION=%%i
    echo [OK] 找到 CUDA: !CUDA_VERSION!
    set HAS_CUDA=true
) else (
    where nvidia-smi >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [警告] 找到 NVIDIA 驱动，但未安装 CUDA toolkit
        echo         视频渲染不可用，推理可正常工作
    ) else (
        echo [警告] 未检测到 NVIDIA GPU，将使用 CPU 模式
        echo         这没问题！3D 生成在 CPU 上也能正常运行
    )
    set HAS_CUDA=false
)

REM ============================================================
REM  [4/8] 检测 Node.js
REM ============================================================
echo.
echo [4/8] 检查 Node.js 环境...

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] 找到 Node.js: %%i
    set HAS_NODE=true
) else (
    echo [警告] 未找到 Node.js，跳过前端安装
    echo.
    echo   如需使用 React 版本，请安装 Node.js 18+:
    echo     https://nodejs.org/
    echo.
    echo   注意：预构建包已包含编译好的前端，无需安装 Node.js
    set HAS_NODE=false
)

REM ============================================================
REM  [5/8] 拉取/更新 ml-sharp
REM ============================================================
echo.
echo [5/8] 获取 Apple ml-sharp...

if exist "%SCRIPT_DIR%%SHARP_DIR%" (
    echo [警告] ml-sharp 目录已存在
    set /p UPDATE="是否更新到最新版本? [Y/n] "
    if /i not "!UPDATE!"=="n" (
        cd /d "%SCRIPT_DIR%%SHARP_DIR%"
        git pull origin main 2>nul || git pull origin master 2>nul
        cd /d "%SCRIPT_DIR%"
        echo [OK] ml-sharp 已更新
    )
) else (
    echo 正在克隆 %SHARP_REPO% ...
    git clone --depth 1 "%SHARP_REPO%" "%SHARP_DIR%"
    echo [OK] ml-sharp 克隆完成
)

REM ============================================================
REM  [6/8] 创建虚拟环境
REM ============================================================
echo.
echo [6/8] 创建虚拟环境...

set VENV_DIR=%SCRIPT_DIR%venv

if exist "%VENV_DIR%" (
    echo [警告] 虚拟环境已存在
    set /p RECREATE="是否删除并重新创建? [y/N] "
    if /i "!RECREATE!"=="y" (
        rmdir /s /q "%VENV_DIR%"
    ) else (
        echo [OK] 使用现有虚拟环境
        goto install_deps
    )
)

python -m venv "%VENV_DIR%"
echo [OK] 虚拟环境创建完成

:install_deps
REM ============================================================
REM  [7/8] 安装依赖
REM ============================================================
echo.
echo [7/8] 安装 Python 依赖...

call "%VENV_DIR%\Scripts\activate.bat"

pip install --upgrade pip

echo 安装 Sharp 核心 (这可能需要几分钟)...
cd /d "%SCRIPT_DIR%%SHARP_DIR%"
pip install -r requirements.txt
cd /d "%SCRIPT_DIR%"

echo 安装 GUI 依赖...
pip install flask

echo [OK] Python 依赖安装完成

REM ============================================================
REM  [8/8] 安装前端依赖
REM ============================================================
if "%HAS_NODE%"=="true" (
    echo.
    echo [8/8] 安装前端依赖...
    if exist "%SCRIPT_DIR%frontend" (
        cd /d "%SCRIPT_DIR%frontend"
        npm install
        cd /d "%SCRIPT_DIR%"
        echo [OK] 前端依赖安装完成
    ) else (
        echo [跳过] frontend 目录不存在
    )
) else (
    echo [跳过] 前端安装 (Node.js 不可用)
)

REM 创建目录
if not exist "%SCRIPT_DIR%inputs" mkdir "%SCRIPT_DIR%inputs"
if not exist "%SCRIPT_DIR%outputs" mkdir "%SCRIPT_DIR%outputs"

REM ============================================================
REM  生成 HTTPS 证书 (可选)
REM ============================================================
echo.
echo 生成 HTTPS 证书 (可选)...

where openssl >nul 2>&1
if %ERRORLEVEL% equ 0 (
    python "%SCRIPT_DIR%generate_cert.py"
    if %ERRORLEVEL% equ 0 (
        echo [OK] HTTPS 证书已生成
    ) else (
        echo [警告] 证书生成失败，但不影响基本功能
        echo         HTTPS 不可用，陀螺仪功能仅限本机访问
        echo         可稍后手动运行: python generate_cert.py
    )
) else (
    echo [警告] 未找到 OpenSSL，跳过证书生成
    echo.
    echo   提示: Git for Windows 自带 OpenSSL
    echo   如已安装 Git，请关闭此窗口重新运行 install.bat
    echo.
    echo   HTTPS 不可用，陀螺仪功能仅限本机访问
)

REM ============================================================
REM  测试安装
REM ============================================================
echo.
echo 测试安装...

sharp --help >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] Sharp CLI 安装失败
    pause
    exit /b 1
)
echo [OK] Sharp CLI 可用

python -c "import torch; print(f'PyTorch: {torch.__version__}')"
python -c "import flask; print(f'Flask: {flask.__version__}')"

echo [OK] 安装测试通过

REM ============================================================
REM  完成
REM ============================================================
echo.
echo ============================================
echo   Sharp GUI 安装完成!
echo ============================================
echo.
echo 使用方法 (Usage):
echo.
echo   1. 启动 GUI (Start GUI):
echo      run.bat
echo.
echo   2. 命令行推理 (CLI Inference):
echo      venv\Scripts\activate.bat
echo      sharp predict -i input.jpg -o outputs\
echo.
echo 首次运行会自动下载模型 (~500MB)
echo.

pause
