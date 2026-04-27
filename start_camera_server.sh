#!/bin/bash

echo "================================================"
echo "  AgriSense Live Drone Camera Server"
echo "================================================"
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run setup first:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements_camera.txt"
    exit 1
fi

# Activate venv
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
echo "📦 Checking dependencies..."
python -c "import flask, cv2, rfdetr" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Missing dependencies!"
    echo "Installing required packages..."
    pip install -r requirements_camera.txt
fi

echo ""
echo "🚀 Starting camera server..."
echo "   Server will run on http://localhost:5000"
echo "   Press Ctrl+C to stop"
echo ""

python camera_server.py
