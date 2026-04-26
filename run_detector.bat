@echo off
call venv\Scripts\activate.bat
echo Starting RF-DETR webcam detector on CUDA...
python webcam_detector.py
pause
