"""
Runs every labeled image in backend/db/Data-Trainning through MediaPipe's
FaceLandmarker and reduces each face down to the exact same three ratios
frontend/src/lib/faceShape.ts computes on-device from the ML Kit contour
(lengthToWidthRatio, foreheadVsCheek, jawVsCheek), using MediaPipe's
FACEMESH_FACE_OVAL loop (36 points) as a stand-in for ML Kit's 36-point
FACE contour — same point count, same "silhouette traced top-to-bottom"
shape, so the width-band math transfers directly.

Output: backend/db/Data-Trainning/features.csv, one row per successfully
detected face. Rows that fail detection (no face found) are skipped and
counted in the summary printed at the end.

Usage: backend/venv/Scripts/python.exe backend/tools/face_shape_extract_features.py
"""

import csv
from pathlib import Path

from mediapipe.tasks.python import vision, BaseOptions
from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode
import mediapipe as mp
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "db" / "Data-Trainning" / "men"
MODEL_PATH = ROOT / "ml_models" / "face_landmarker.task"
OUT_CSV = DATASET_DIR.parent / "features.csv"

# Dataset class name -> app's FaceShape label (frontend/src/lib/faceShape.ts).
# The dataset has no "heart" class, so that shape can't be recalibrated here.
CLASS_TO_SHAPE = {
    "ovale": "oval",
    "rectangular": "oblong",
    "round": "round",
    "square": "square",
}

# MediaPipe's canonical FACEMESH_FACE_OVAL loop (36 unique vertices, ordered),
# starting at the forehead midpoint (10) and ending back at the same point.
FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109,
]


def width_in_band(points, min_y, face_length, from_ratio, to_ratio):
    y_from = min_y + from_ratio * face_length
    y_to = min_y + to_ratio * face_length
    band = [p for p in points if y_from <= p[1] <= y_to]
    if len(band) < 2:
        return 0.0
    xs = [p[0] for p in band]
    return max(xs) - min(xs)


def compute_ratios(points):
    """points: list of (x, y) pixel coords for the 36 FACE_OVAL landmarks."""
    ys = [p[1] for p in points]
    min_y, max_y = min(ys), max(ys)
    face_length = max_y - min_y
    if face_length <= 0:
        return None

    forehead_width = width_in_band(points, min_y, face_length, 0.05, 0.25)
    cheekbone_width = width_in_band(points, min_y, face_length, 0.35, 0.55)
    jaw_width = width_in_band(points, min_y, face_length, 0.78, 0.95)
    if forehead_width == 0 or cheekbone_width == 0 or jaw_width == 0:
        return None

    length_to_width = face_length / cheekbone_width
    forehead_vs_cheek = (cheekbone_width - forehead_width) / cheekbone_width
    jaw_vs_cheek = (cheekbone_width - jaw_width) / cheekbone_width
    return {
        "faceLength": face_length,
        "foreheadWidth": forehead_width,
        "cheekboneWidth": cheekbone_width,
        "jawWidth": jaw_width,
        "lengthToWidthRatio": length_to_width,
        "foreheadVsCheek": forehead_vs_cheek,
        "jawVsCheek": jaw_vs_cheek,
    }


def main():
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=VisionTaskRunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
    )
    landmarker = vision.FaceLandmarker.create_from_options(options)

    rows = []
    no_face = 0
    total = 0

    for split in ("training_set", "testing_set"):
        for class_name, shape in CLASS_TO_SHAPE.items():
            folder = DATASET_DIR / split / class_name
            if not folder.exists():
                continue
            for img_path in sorted(folder.iterdir()):
                if img_path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                    continue
                total += 1
                pil_img = Image.open(img_path).convert("RGB")
                w, h = pil_img.size
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=__import__("numpy").array(pil_img))
                result = landmarker.detect(mp_image)
                if not result.face_landmarks:
                    no_face += 1
                    continue
                lm = result.face_landmarks[0]
                points = [(lm[i].x * w, lm[i].y * h) for i in FACE_OVAL]
                ratios = compute_ratios(points)
                if ratios is None:
                    no_face += 1
                    continue
                rows.append({
                    "split": split,
                    "class": class_name,
                    "shape": shape,
                    "filename": img_path.name,
                    **ratios,
                })

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "split", "class", "shape", "filename", "faceLength", "foreheadWidth",
            "cheekboneWidth", "jawWidth", "lengthToWidthRatio", "foreheadVsCheek", "jawVsCheek",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Total images: {total}")
    print(f"Detected faces: {len(rows)}")
    print(f"No face / bad landmarks: {no_face}")
    print(f"Wrote {OUT_CSV}")


if __name__ == "__main__":
    main()
