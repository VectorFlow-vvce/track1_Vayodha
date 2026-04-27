# AgriSense — AI-Powered Precision Agriculture Platform

> Real-time crop monitoring, edge AI object detection, and instant disease diagnosis for modern farms.

---

## Overview

AgriSense is a full-stack precision agriculture platform that combines **edge AI vision**, **real-time drone telemetry**, and **Gemini-powered disease diagnosis** into a single unified dashboard.

Built for **Ecatech Hackathon — Track 1 (Vayodha)** by **Team VectorFlow**.

### Key Features

| Feature | Description |
|---|---|
| 🗺️ **Live Field Map** | Interactive Leaflet map with per-field health overlays and status indicators |
| 🤖 **Edge AI Detection** | RF-DETR Seg Nano running locally via webcam for real-time instance segmentation |
| 🌿 **AI Disease Diagnosis** | Upload a crop image → Gemini Vision identifies disease, severity, and treatment |
| 📡 **Real-time Telemetry** | WebSocket (Socket.io) sync between HQ dashboard and farmer mobile portal |
| 📱 **Farmer App** | Mobile-first farmer interface with drone scan requests and Bhoomi AI voice assistant |
| 🎥 **Camera Server** | Threaded MJPEG stream server with live RF-DETR annotations over HTTP |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│               HQ Dashboard (React)               │
│  Map · Disease Detection · Live Camera Feed      │
└──────────────┬──────────────────────────────────┘
               │ WebSocket (Socket.io)
┌──────────────▼──────────────────────────────────┐
│              Node.js Backend (server.js)          │
│         Field state · Scan orchestration         │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────────────────┐
│ Farmer App  │  │   Python AI Layer            │
│ (React PWA) │  │  webcam_detector.py          │
│ /farmer/:id │  │  camera_server.py (Flask)    │
└─────────────┘  │  detector.py (batch)         │
                 │  RF-DETR Seg Nano + MPS/CUDA │
                 └─────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.10–3.12 (3.11 recommended for AI stack)
- A webcam (for live detection features)
- A **Gemini API key** → [Get one free at aistudio.google.com](https://aistudio.google.com)

---

### 1. Clone the repository

```bash
git clone https://github.com/VectorFlow-vvce/track1_Vayodha.git
cd track1_Vayodha
```

---

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY="your_key_here"
VITE_GEMINI_API_KEY="your_key_here"
```

---

### 3. Install frontend dependencies and run

```bash
npm install
npm run dev
```

The dashboard will be available at **http://localhost:5173**

---

### 4. Start the Node.js backend

In a separate terminal:

```bash
node server.js
```

The WebSocket server runs on **port 3001**.

---

### 5. Set up the Python AI environment

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install rfdetr opencv-python supervision pillow flask flask-cors
```

---

### 6. Run the AI components

**Webcam real-time detection (standalone window):**
```bash
./venv/bin/python3 webcam_detector.py
# Press Q to quit
```

**Camera server (MJPEG stream for the dashboard):**
```bash
./venv/bin/python3 camera_server.py
# Stream at http://localhost:5001/video_feed
# Start via POST http://localhost:5001/api/camera/start
```

**Batch image detection:**
```bash
./venv/bin/python3 detector.py path/to/image.jpg
# Output saved to output_detected.png
```

---

## Windows Setup (NVIDIA GPU)

For best performance on a Windows machine with an NVIDIA GPU (e.g. RTX 2050):

1. Clone the repo
2. Double-click **`setup_windows.bat`** — installs PyTorch with CUDA 12.1, rfdetr, and all dependencies
3. Double-click **`run_detector.bat`** — launches the webcam detector on your GPU

> The CUDA version of RF-DETR runs ~5× faster than CPU and ~2–3× faster than Apple MPS.

---

## Project Structure

```
track1_Vayodha/
├── src/
│   ├── components/
│   │   ├── Map.tsx                  # Interactive Leaflet field map
│   │   ├── FarmerApp.tsx            # Mobile farmer portal
│   │   ├── DiseaseDetectionModal.tsx # Gemini AI disease diagnosis
│   │   ├── FieldDetailsModal.tsx    # Per-field detail panel
│   │   ├── Metrics.tsx              # Dashboard KPI metrics
│   │   └── ReportModal.tsx          # Scan report viewer
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── server.js                        # Node.js + Socket.io backend
├── webcam_detector.py               # Real-time webcam segmentation
├── camera_server.py                 # Flask MJPEG camera stream server
├── detector.py                      # Batch image detection script
├── setup_windows.bat                # One-click Windows GPU setup
├── run_detector.bat                 # Windows launcher
├── requirements.txt
├── package.json
└── .env.example
```

---

## AI Models Used

| Model | Purpose | Speed |
|---|---|---|
| **RF-DETR Seg Nano** | Real-time webcam/drone object segmentation | ~4–6 fps (MPS), ~20+ fps (CUDA) |
| **Google Gemini 2.0 Flash** | Plant disease identification from images | ~2–3s per image |
| **Gemini 2.0 Flash Lite** | Fallback model when Flash quota is exhausted | ~2–3s per image |

---

## Team

**VectorFlow** — Ecatech Hackathon 2026, Track 1 (Vayodha / AgriTech)

---

## License

MIT
