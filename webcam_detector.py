import sys
import time
import threading
import numpy as np
import cv2
import torch
import supervision as sv
from PIL import Image as PILImage

try:
    from rfdetr import RFDETRSegSmall
except ImportError as e:
    print(f"Error: {e}. Run with the venv python.")
    sys.exit(1)

# ── Device ────────────────────────────────────────────────────────────────────
if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

# ── Config ────────────────────────────────────────────────────────────────────
THRESHOLD    = 0.5
WINDOW_NAME  = "RF-DETR Seg Nano — Webcam  [Q to quit]"
# ─────────────────────────────────────────────────────────────────────────────


class InferenceThread(threading.Thread):
    """Runs model.predict() in a background thread.
    Main thread reads the latest annotated frame without blocking."""

    def __init__(self, model):
        super().__init__(daemon=True)
        self.model = model

        # Shared state — written by main thread, read by this thread
        self._latest_frame: np.ndarray | None = None
        self._frame_lock = threading.Lock()
        self._stop_event = threading.Event()

        # Shared state — written by this thread, read by main thread
        self.last_detections = sv.Detections.empty()
        self.last_labels: list[str] = []
        self.inference_fps: float = 0.0
        self._result_lock = threading.Lock()

    def push_frame(self, frame_rgb: np.ndarray):
        """Called by main thread to hand off the latest frame."""
        with self._frame_lock:
            self._latest_frame = frame_rgb

    def get_results(self):
        """Called by main thread to read the latest detections + labels."""
        with self._result_lock:
            return self.last_detections, self.last_labels, self.inference_fps

    def stop(self):
        self._stop_event.set()

    def run(self):
        fps_history: list[float] = []
        while not self._stop_event.is_set():
            with self._frame_lock:
                frame = self._latest_frame
                self._latest_frame = None  # consume it

            if frame is None:
                time.sleep(0.001)  # nothing to process, yield
                continue

            t0 = time.perf_counter()
            pil = PILImage.fromarray(frame)
            detections = self.model.predict(pil, threshold=THRESHOLD)
            elapsed = time.perf_counter() - t0

            class_names = detections.data.get(
                "class_name", [str(c) for c in detections.class_id]
            )
            labels = [
                f"{n}  {c:.2f}"
                for n, c in zip(class_names, detections.confidence)
            ]

            fps_history.append(1.0 / elapsed if elapsed > 0 else 0)
            if len(fps_history) > 10:
                fps_history.pop(0)
            inf_fps = sum(fps_history) / len(fps_history)

            with self._result_lock:
                self.last_detections = detections
                self.last_labels = labels
                self.inference_fps = inf_fps


def main():
    print(f"Loading RF-DETR Seg Small on {DEVICE.upper()}...")
    model = RFDETRSegSmall(device=DEVICE)
    print(f"Model ready on {DEVICE.upper()}.\n")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Cannot open webcam. Grant camera access to Terminal in System Settings.")
        sys.exit(1)

    # Start background inference thread
    worker = InferenceThread(model)
    worker.start()

    mask_annotator  = sv.MaskAnnotator(opacity=0.5)
    label_annotator = sv.LabelAnnotator(text_scale=0.5, text_thickness=1, text_padding=4)

    display_fps_history: list[float] = []
    t_prev = time.perf_counter()
    print("Press  Q  to quit.")

    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break

        # Always push latest frame to inference thread (it will consume the newest)
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        worker.push_frame(frame_rgb)

        # Get last known detections (never blocks)
        detections, labels, inf_fps = worker.get_results()

        # Annotate display frame
        annotated = mask_annotator.annotate(scene=frame_bgr.copy(), detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)

        # Display FPS (real render rate)
        now = time.perf_counter()
        display_fps_history.append(1.0 / (now - t_prev) if (now - t_prev) > 0 else 0)
        if len(display_fps_history) > 30:
            display_fps_history.pop(0)
        display_fps = sum(display_fps_history) / len(display_fps_history)
        t_prev = now

        cv2.putText(
            annotated,
            f"Display: {display_fps:.0f} fps  |  Inference: {inf_fps:.1f} fps  |  {DEVICE.upper()}  |  Detections: {len(detections)}",
            (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA,
        )

        cv2.imshow(WINDOW_NAME, annotated)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    worker.stop()
    cap.release()
    cv2.destroyAllWindows()
    print("Done.")


if __name__ == "__main__":
    main()
