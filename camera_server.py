"""
AgriSense Live Drone Camera Server
Streams webcam feed with RF-DETR real-time object detection
"""
import sys
import time
import threading
import numpy as np
import cv2
import torch
import supervision as sv
from PIL import Image as PILImage
from flask import Flask, Response, jsonify
from flask_cors import CORS

try:
    from rfdetr import RFDETRSegNano
except ImportError as e:
    print(f"Error: {e}. Make sure rfdetr is installed in your venv.")
    sys.exit(1)

# ── Configuration ─────────────────────────────────────────────────────────────
if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

THRESHOLD = 0.5
FPS_TARGET = 30

# ── Flask App ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ── Global State ──────────────────────────────────────────────────────────────
camera_active = False
current_frame = None
frame_lock = threading.Lock()
detection_stats = {
    "fps": 0,
    "detections": 0,
    "inference_time": 0
}


class CameraThread(threading.Thread):
    """Background thread for camera capture and detection"""
    
    def __init__(self):
        super().__init__(daemon=True)
        self.model = None
        self.cap = None
        self.running = False
        self.mask_annotator = sv.MaskAnnotator(opacity=0.5)
        self.label_annotator = sv.LabelAnnotator(text_scale=0.6, text_thickness=1, text_padding=5)
        
    def start_camera(self):
        """Initialize camera and model"""
        global camera_active
        
        if self.running:
            return True
            
        print(f"[Camera Server] Loading RF-DETR model on {DEVICE}...")
        self.model = RFDETRSegNano(device=DEVICE)
        print(f"[Camera Server] Model loaded successfully")
        
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            print("[Camera Server] ERROR: Cannot open webcam")
            return False
            
        # Set camera properties for better performance
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        
        self.running = True
        camera_active = True
        self.start()
        print("[Camera Server] Camera started successfully")
        return True
        
    def stop_camera(self):
        """Stop camera and release resources"""
        global camera_active
        self.running = False
        camera_active = False
        
        if self.cap:
            self.cap.release()
            self.cap = None
        
        print("[Camera Server] Camera stopped")
        
    def run(self):
        """Main camera loop with detection"""
        global current_frame, detection_stats
        
        fps_history = []
        frame_count = 0
        
        while self.running:
            ret, frame_bgr = self.cap.read()
            if not ret:
                print("[Camera Server] Failed to read frame")
                time.sleep(0.1)
                continue
                
            frame_count += 1
            t_start = time.perf_counter()
            
            # Run detection every frame for smooth experience
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_image = PILImage.fromarray(frame_rgb)
            
            # Inference
            detections = self.model.predict(pil_image, threshold=THRESHOLD)
            
            # Annotate
            annotated = self.mask_annotator.annotate(scene=frame_bgr.copy(), detections=detections)
            
            if len(detections) > 0:
                class_names = detections.data.get("class_name", [str(c) for c in detections.class_id])
                labels = [f"{n} {c:.2f}" for n, c in zip(class_names, detections.confidence)]
                annotated = self.label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
            
            # Calculate FPS
            elapsed = time.perf_counter() - t_start
            fps_history.append(1.0 / elapsed if elapsed > 0 else 0)
            if len(fps_history) > 30:
                fps_history.pop(0)
            avg_fps = sum(fps_history) / len(fps_history)
            
            # Add overlay info
            info_text = f"Drone Camera | {avg_fps:.0f} FPS | {DEVICE.upper()} | Detections: {len(detections)}"
            cv2.putText(
                annotated,
                info_text,
                (15, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )
            
            # Add AgriSense branding
            cv2.putText(
                annotated,
                "AgriSense Live Feed",
                (15, annotated.shape[0] - 15),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (100, 255, 100),
                2,
                cv2.LINE_AA
            )
            
            # Update global state
            with frame_lock:
                current_frame = annotated.copy()
                detection_stats = {
                    "fps": round(avg_fps, 1),
                    "detections": len(detections),
                    "inference_time": round(elapsed * 1000, 1)  # ms
                }
            
            # Frame rate limiting
            time.sleep(max(0, (1.0 / FPS_TARGET) - elapsed))


# ── Global camera thread instance ─────────────────────────────────────────────
camera_thread = CameraThread()


# ── Flask Routes ──────────────────────────────────────────────────────────────
@app.route('/api/camera/start', methods=['POST'])
def start_camera():
    """Start the camera feed"""
    success = camera_thread.start_camera()
    return jsonify({
        "success": success,
        "message": "Camera started" if success else "Failed to start camera"
    })


@app.route('/api/camera/stop', methods=['POST'])
def stop_camera():
    """Stop the camera feed"""
    camera_thread.stop_camera()
    return jsonify({
        "success": True,
        "message": "Camera stopped"
    })


@app.route('/api/camera/status', methods=['GET'])
def camera_status():
    """Get camera status and stats"""
    return jsonify({
        "active": camera_active,
        "stats": detection_stats
    })


def generate_frames():
    """Generator function for video streaming"""
    global current_frame
    
    while camera_active:
        with frame_lock:
            if current_frame is None:
                time.sleep(0.01)
                continue
            frame = current_frame.copy()
        
        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        
        # Yield frame in multipart format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.01)  # Small delay to prevent overwhelming the client


@app.route('/video_feed')
def video_feed():
    """Video streaming route"""
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "device": DEVICE,
        "camera_active": camera_active
    })


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("  AgriSense Live Drone Camera Server")
    print(f"  Device: {DEVICE.upper()}")
    print("=" * 60)
    print("\n[Server] Starting Flask server on http://0.0.0.0:5001")
    print("[Server] Endpoints:")
    print("  - POST /api/camera/start  : Start camera")
    print("  - POST /api/camera/stop   : Stop camera")
    print("  - GET  /api/camera/status : Get status")
    print("  - GET  /video_feed        : Video stream")
    print("  - GET  /api/health        : Health check")
    print("\n[Server] Ready to receive requests...\n")
    
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
