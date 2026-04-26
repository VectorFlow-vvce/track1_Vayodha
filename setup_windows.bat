@echo off
setlocal EnableDelayedExpansion

echo ================================================
echo  RF-DETR Webcam Detector - Windows Setup
echo  Requires: Python 3.10+, NVIDIA GPU (CUDA)
echo ================================================
echo.

:: ── Check Python ─────────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found.
    echo Download from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo [OK] Python %PYVER% found.

:: ── Create virtual environment ────────────────────────────────────────────────
echo.
echo [1/4] Creating virtual environment...
if exist venv (
    echo      venv already exists, skipping.
) else (
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
    echo      Done.
)

:: ── Activate venv ─────────────────────────────────────────────────────────────
call venv\Scripts\activate.bat

:: ── Install PyTorch with CUDA 12.1 (RTX 2050 compatible) ─────────────────────
echo.
echo [2/4] Installing PyTorch with CUDA 12.1 support...
echo      (This may take a few minutes - ~2GB download)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install PyTorch.
    pause
    exit /b 1
)
echo      Done.

:: ── Install rfdetr and dependencies ──────────────────────────────────────────
echo.
echo [3/4] Installing rfdetr, opencv, supervision...
pip install rfdetr opencv-python supervision pillow --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install rfdetr.
    pause
    exit /b 1
)
echo      Done.

:: ── Verify CUDA is visible ────────────────────────────────────────────────────
echo.
echo [4/4] Verifying CUDA...
python -c "import torch; gpu=torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NOT FOUND'; print(f'     GPU: {gpu}')"

echo.
echo ================================================
echo  Setup complete!
echo.
echo  To run the webcam detector:
echo    run_detector.bat
echo.
echo  Or manually:
echo    venv\Scripts\activate
echo    python webcam_detector.py
echo ================================================
pause
