import os
import sys
from PIL import Image
try:
    from rfdetr import RFDETRNano
    from rfdetr.assets.coco_classes import COCO_CLASSES
except ImportError:
    print("Error: rfdetr not found. Make sure to run this with the virtual environment's python.")
    sys.exit(1)

def run_detection(image_path=None):
    # Initialize the model (Nano is the smallest)
    print("Loading RF-DETR Nano model...")
    model = RFDETRNano()

    if image_path and os.path.exists(image_path):
        print(f"Running inference on {image_path}...")
        image = Image.open(image_path)
        detections = model.predict(image)
        
        print(f"Found {len(detections)} detections.")
        for detection in detections:
            class_name = COCO_CLASSES[detection.class_id]
            print(f"Class: {class_name}, Confidence: {detection.confidence:.2f}, Box: {detection.xyxy}")
    else:
        print("No image provided or image not found. Model loaded successfully.")

if __name__ == "__main__":
    # If an argument is provided, use it as the image path
    path = sys.argv[1] if len(sys.argv) > 1 else None
    run_detection(path)
