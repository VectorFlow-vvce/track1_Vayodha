# 🏗️ Live Drone Camera Architecture

## System Overview

The Live Drone Camera feature consists of three main layers:
1. **Frontend (React)** - User interface and video display
2. **Backend (Flask)** - Video streaming and AI inference
3. **Hardware** - Webcam and GPU

## Component Architecture

### Frontend Layer (Port 3000)
- **App.tsx** - Main application with control panel
- **DroneCameraModal.tsx** - Camera modal component
- Handles user interactions and displays video stream

### Backend Layer (Port 5000)
- **camera_server.py** - Flask server
- **CameraThread** - Background thread for capture/inference
- **RF-DETR Model** - AI detection model
- **OpenCV** - Video capture
- **Supervision** - Annotation library

### Hardware Layer
- **Webcam** - Video input device
- **GPU** - CUDA/MPS/CPU for inference

## Data Flow

### Camera Start Sequence
1. User clicks "Live Drone Camera" button
2. DroneCameraModal opens
3. POST request to /api/camera/start
4. Flask loads RF-DETR model
5. Opens webcam with OpenCV
6. Starts background thread
7. Returns success to frontend
8. Frontend displays video feed

### Video Streaming Loop
1. CameraThread captures frame from webcam
2. Converts BGR to RGB
3. Runs RF-DETR inference
4. Annotates with bounding boxes and masks
5. Adds overlay text (FPS, stats)
6. Stores in thread-safe buffer
7. Updates detection stats
8. /video_feed endpoint reads buffer
9. Encodes as JPEG
10. Streams as MJPEG to frontend
11. Browser displays in <img> tag

### Stats Polling
- Frontend polls /api/camera/status every 500ms
- Backend returns current FPS, detections, inference time
- Frontend updates overlay display

### Camera Stop Sequence
1. User closes modal
2. POST request to /api/camera/stop
3. CameraThread sets running = False
4. Releases webcam
5. Thread exits gracefully
6. Returns success to frontend

## Threading Model

### Main Thread
- Flask HTTP server
- Handles API requests
- Serves MJPEG stream
- Manages camera thread lifecycle

### CameraThread (Daemon)
- Captures frames continuously
- Runs AI inference
- Annotates frames
- Updates shared state (thread-safe with locks)

### Thread Safety
- `frame_lock` protects `current_frame` and `detection_stats`
- Read operations acquire lock before reading
- Write operations acquire lock before writing

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/camera/start | POST | Start camera and detection |
| /api/camera/stop | POST | Stop camera |
| /api/camera/status | GET | Get current stats |
| /video_feed | GET | MJPEG video stream |
| /api/health | GET | Health check |

## Performance Optimizations

### Backend
- Threading for non-blocking camera operations
- Frame buffering for latest frame availability
- GPU acceleration (CUDA/MPS/CPU auto-detection)
- Frame rate limiting to prevent CPU/GPU overload
- JPEG compression (quality=85) for bandwidth

### Frontend
- Lazy loading (modal only renders when open)
- Polling interval (500ms for stats, not every frame)
- Auto cleanup (camera stops when modal closes)
- Error recovery with retry mechanism

### Network
- MJPEG streaming for low latency
- Local server (no internet required)
- CORS enabled for cross-origin requests
- Keep-alive for persistent connections

## Error Handling

### Backend
- Try/catch blocks around camera operations
- Graceful error responses with JSON
- Resource cleanup on errors

### Frontend
- Try/catch around fetch requests
- Error state management
- User-friendly error messages
- Retry functionality

## Security Considerations

### Current (Development)
- Runs on localhost only
- No authentication
- CORS enabled for development
- No data storage/logging

### Production Recommendations
- Add JWT authentication
- Use HTTPS/SSL
- Restrict CORS origins
- Implement rate limiting
- Add access logs
- Encrypt video streams

## Deployment

### Development
```bash
# Terminal 1: Backend
python camera_server.py

# Terminal 2: Frontend
npm run dev
```

### Production
```bash
# Backend with Gunicorn
gunicorn -w 1 -b 0.0.0.0:5000 camera_server:app

# Frontend build
npm run build
npm run preview
```

---

**Architecture designed for AgriSense** 🌾🚁🤖
