# 🚀 Quick Start: Live Drone Camera

## 3-Step Setup

### 1️⃣ Install Dependencies
```bash
source venv/bin/activate
pip install flask flask-cors
```

### 2️⃣ Start Camera Server
```bash
./start_camera_server.sh
```
Or manually:
```bash
python camera_server.py
```

### 3️⃣ Start React App (in another terminal)
```bash
npm run dev
```

## 🎮 How to Use

1. Open http://localhost:3000
2. Click **"Start Satellite Scan"**
3. When drones are scanning, click **"Live Drone Camera"**
4. Your webcam opens with real-time AI detection! 🎥

## ✅ What You'll See

- Live webcam feed
- Real-time object detection boxes
- Segmentation masks
- FPS counter
- Detection count
- Inference time

## 🎯 Button Availability

**Enabled during:**
- Satellite Pass
- Deploying Drones
- Scanning Fields
- Analyzing Data

**Disabled during:**
- Idle
- Report Ready

## 🐛 Troubleshooting

**Camera won't start?**
- Make sure `camera_server.py` is running
- Check: `curl http://localhost:5000/api/health`

**No webcam access?**
- Grant camera permissions to Terminal
- macOS: System Settings → Privacy & Security → Camera

**Port 5000 in use?**
```bash
lsof -ti:5000 | xargs kill -9
```

## 📸 Demo Flow

```
Start Demo → Satellite Scan → Deploy Drones → 
[Click "Live Drone Camera"] → See Real-time Detection! 🎉
```

That's it! Enjoy your AI-powered drone camera! 🚁
