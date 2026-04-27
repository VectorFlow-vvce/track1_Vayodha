"""
AgriSense Live Drone Camera Server
Streams webcam feed with RF-DETR real-time object detection.

Fixes applied vs original:
  1. Inference runs in its own thread — camera loop NEVER waits for the model.
  2. Frame assigned directly inside lock (no extra .copy() while holding lock).
  3. JPEG quality lowered (75) and generator rate-capped at STREAM_FPS.
  4. Capture resolution reduced to 640×480 (RF-DETR resizes internally anyway).
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

# ── Device ────────────────────────────────────────────────────────────────────
if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

# ── Config ────────────────────────────────────────────────────────────────────
THRESHOLD   = 0.5
STREAM_FPS  = 30          # max fps sent to browser
JPEG_QUALITY = 75         # lower = smaller payload, still fine for live feed
CAPTURE_W   = 640         # RF-DETR resizes internally; no need for 1280×720
CAPTURE_H   = 480

# ── Flask ─────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ── Shared state ──────────────────────────────────────────────────────────────
camera_active  = False
current_frame  = None          # annotated BGR frame ready to stream
frame_lock     = threading.Lock()
detection_stats = {"fps": 0, "detections": 0, "inference_ms": 0}


# ─────────────────────────────────────────────────────────────────────────────
# Inference thread — pulls latest raw frame, runs model, writes results back
# ─────────────────────────────────────────────────────────────────────────────
class InferenceThread(threading.Thread):
    def __init__(self, model):
        super().__init__(daemon=True)
        self.model          = model
        self._latest_bgr    = None          # written by CameraThread
        self._raw_lock      = threading.Lock()
        self._stop          = threading.Event()

        # Results — read by CameraThread for annotation
        self.detections     = sv.Detections.empty()
        self.labels: list[str] = []
        self.inference_fps  = 0.0
        self._res_lock      = threading.Lock()

    def push(self, frame_bgr: np.ndarray):
        """Camera thread hands off the latest frame (non-blocking)."""
        with self._raw_lock:
            self._latest_bgr = frame_bgr   # just overwrite — always freshest

    def get(self):
        """Camera thread reads latest detections + labels (non-blocking)."""
        with self._res_lock:
            return self.detections, self.labels, self.inference_fps

    def stop(self):
        self._stop.set()

    def run(self):
        fps_buf: list[float] = []
        while not self._stop.is_set():
            with self._raw_lock:
                frame = self._latest_bgr
                self._latest_bgr = None     # consume

            if frame is None:
                time.sleep(0.002)
                continue

            t0  = time.perf_counter()
            pil = PILImage.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            det = self.model.predict(pil, threshold=THRESHOLD)
            elapsed = time.perf_counter() - t0

            names  = det.data.get("class_name", [str(c) for c in det.class_id])
            labels = [f"{n} {c:.2f}" for n, c in zip(names, det.confidence)]

            fps_buf.append(1.0 / elapsed if elapsed > 0 else 0)
            if len(fps_buf) > 10:
                fps_buf.pop(0)

            with self._res_lock:
                self.detections    = det
                self.labels        = labels
                self.inference_fps = sum(fps_buf) / len(fps_buf)


# ─────────────────────────────────────────────────────────────────────────────
# Camera thread — reads frames, annotates with last-known detections, streams
# ─────────────────────────────────────────────────────────────────────────────
class CameraThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.running        = False
        self.cap            = None
        self._inf_thread: InferenceThread | None = None
        self.mask_ann       = sv.MaskAnnotator(opacity=0.5)
        self.label_ann      = sv.LabelAnnotator(text_scale=0.55,
                                                text_thickness=1,
                                                text_padding=4)

    def start_camera(self) -> bool:
        global camera_active
        if self.running:
            return True

        print(f"[Camera] Loading RF-DETR Seg Nano on {DEVICE.upper()}...")
        model = RFDETRSegNano(device=DEVICE)
        print(f"[Camera] Model ready on {DEVICE.upper()}")

        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            print("[Camera] ERROR: Cannot open webcam")
            return False

        # Fix 4: lower resolution — model resizes anyway
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  CAPTURE_W)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_H)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

        # Fix 1: start dedicated inference thread
        self._inf_thread = InferenceThread(model)
        self._inf_thread.start()

        self.running  = True
        camera_active = True
        self.start()
        print("[Camera] Started")
        return True

    def stop_camera(self):
        global camera_active
        self.running  = False
        camera_active = False
        if self._inf_thread:
            self._inf_thread.stop()
        if self.cap:
            self.cap.release()
            self.cap = None
        print("[Camera] Stopped")

    def run(self):
        global current_frame, detection_stats

        display_fps_buf: list[float] = []
        t_prev = time.perf_counter()

        while self.running:
            ret, frame_bgr = self.cap.read()
            if not ret:
                time.sleep(0.005)
                continue

            # Fix 1: hand off to inference thread — never blocks here
            self._inf_thread.push(frame_bgr)

            # Get last-known detections (always instant)
            det, labels, inf_fps = self._inf_thread.get()

            # Annotate
            annotated = self.mask_ann.annotate(scene=frame_bgr.copy(), detections=det)
            if len(det) > 0 and labels:
                annotated = self.label_ann.annotate(scene=annotated, detections=det, labels=labels)

            # Display FPS
            now = time.perf_counter()
            display_fps_buf.append(1.0 / (now - t_prev) if (now - t_prev) > 0 else 0)
            if len(display_fps_buf) > 30:
                display_fps_buf.pop(0)
            disp_fps = sum(display_fps_buf) / len(display_fps_buf)
            t_prev = now

            cv2.putText(
                annotated,
                f"AgriSense | Display:{disp_fps:.0f}fps  Infer:{inf_fps:.1f}fps  {DEVICE.upper()}  Det:{len(det)}",
                (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA,
            )
            cv2.putText(
                annotated, "AgriSense Live Feed",
                (10, annotated.shape[0] - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (80, 220, 100), 2, cv2.LINE_AA,
            )

            # Fix 2: no .copy() inside lock — assign directly
            with frame_lock:
                current_frame = annotated
                detection_stats = {
                    "fps":           round(disp_fps, 1),
                    "detections":    len(det),
                    "inference_ms":  round(1000 / inf_fps, 1) if inf_fps > 0 else 0,
                }


# ── Global camera thread ──────────────────────────────────────────────────────
camera_thread = CameraThread()


# ── MJPEG generator ───────────────────────────────────────────────────────────
def generate_frames():
    """Yield MJPEG frames to the browser, rate-capped at STREAM_FPS."""
    frame_interval = 1.0 / STREAM_FPS

    while camera_active:
        t0 = time.perf_counter()

        # Fix 2: grab reference — no copy inside lock
        with frame_lock:
            frame = current_frame

        if frame is None:
            time.sleep(0.005)
            continue

        # Fix 3: quality 75 instead of 90
        ret, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ret:
            continue

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n'
        )

        # Fix 3: cap streaming rate so generator doesn't spin needlessly
        elapsed = time.perf_counter() - t0
        sleep_for = frame_interval - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/api/camera/start', methods=['POST'])
def start_camera():
    success = camera_thread.start_camera()
    return jsonify({"success": success,
                    "message": "Camera started" if success else "Failed to start camera"})


@app.route('/api/camera/stop', methods=['POST'])
def stop_camera():
    camera_thread.stop_camera()
    return jsonify({"success": True, "message": "Camera stopped"})


@app.route('/api/camera/status', methods=['GET'])
def camera_status():
    return jsonify({"active": camera_active, "stats": detection_stats})


@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "device": DEVICE, "camera_active": camera_active})


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("  AgriSense Live Drone Camera Server")
    print(f"  Device : {DEVICE.upper()}")
    print(f"  Capture: {CAPTURE_W}×{CAPTURE_H}  Stream FPS cap: {STREAM_FPS}")
    print("=" * 60)
    print("\nEndpoints:")
    print("  POST /api/camera/start  — start camera")
    print("  POST /api/camera/stop   — stop camera")
    print("  GET  /api/camera/status — stats")
    print("  GET  /video_feed        — MJPEG stream")
    print("  GET  /api/health        — health check")
    print("\nListening on http://0.0.0.0:5001\n")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
