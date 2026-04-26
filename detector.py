import os
import sys
import numpy as np
import cv2
import supervision as sv
from PIL import Image as PILImage

try:
    from rfdetr import RFDETRSegNano
except ImportError as e:
    print(f"Error: Required library not found ({e}). Make sure to run this with the virtual environment's python.")
    sys.exit(1)


def run_segmentation(image_path):
    if not image_path or not os.path.exists(image_path):
        print(f"Error: Image not found at '{image_path}'")
        return

    # 1. Load model
    print("Loading RF-DETR Segmentation Nano model...")
    model = RFDETRSegNano()

    # 2. Load image — rfdetr expects a PIL image (RGB)
    print(f"Running inference on {image_path}...")
    image_bgr = cv2.imread(image_path)
    if image_bgr is None:
        print(f"Error: Could not read image at {image_path}")
        return
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_image = PILImage.fromarray(image_rgb)

    # 3. Run inference — returns a single sv.Detections for a single image
    detections = model.predict(pil_image)

    if len(detections) == 0:
        print("No detections found.")
        return

    print(f"Found {len(detections)} detections.")
    class_names = detections.data.get('class_name', [str(c) for c in detections.class_id])
    for name, conf, box in zip(class_names, detections.confidence, detections.xyxy):
        print(f"  {name}: {conf:.2f}  box={box.astype(int).tolist()}")

    # 4. Annotate with segmentation masks + labels
    mask_annotator = sv.MaskAnnotator()
    label_annotator = sv.LabelAnnotator()

    annotated = mask_annotator.annotate(scene=image_bgr.copy(), detections=detections)
    labels = [f"{n} {c:.2f}" for n, c in zip(class_names, detections.confidence)]
    annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)

    # 5. Save result
    output_path = "output_detected.png"
    cv2.imwrite(output_path, annotated)
    print(f"\nSaved annotated image → {output_path}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_segmentation(sys.argv[1])
    else:
        print("Usage: ./venv/bin/python3 detector.py <image_path>")
