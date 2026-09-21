"""
Reads backend/db/Data-Trainning/features.csv (produced by
face_shape_extract_features.py) and grid-searches new thresholds for the
on-device classifier in frontend/src/lib/faceShape.ts.

Fits only on rows where split == training_set, reports accuracy on the
held-out testing_set (the split the dataset ships with), and also reports
the accuracy of the CURRENT production thresholds on both splits as a
baseline for comparison.

The dataset has no "heart" class, so that branch's thresholds are left
untouched — this script only checks how often the current heart condition
misfires on faces that are definitely NOT heart-shaped (every row in this
dataset), and reports whether tightening it would remove false positives
without the search needing that class.

Usage: backend/venv/Scripts/python.exe backend/tools/face_shape_calibrate.py
"""

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "db" / "Data-Trainning" / "features.csv"

# Current production thresholds (frontend/src/lib/faceShape.ts), for baseline comparison.
PROD = {
    "oblong_cutoff": 1.37,
    "heart_forehead_max": 0.015,
    "heart_jaw_min": 0.175,
    "oval_cutoff": 1.12,
    "square_jaw_max": 0.055,
}


def classify(row, t):
    ratio = row["lengthToWidthRatio"]
    fvc = row["foreheadVsCheek"]
    jvc = row["jawVsCheek"]
    if ratio > t["oblong_cutoff"]:
        return "oblong"
    if fvc < t["heart_forehead_max"] and jvc > t["heart_jaw_min"]:
        return "heart"
    if ratio > t["oval_cutoff"]:
        return "oval"
    if jvc < t["square_jaw_max"]:
        return "square"
    return "round"


def accuracy(rows, t):
    if not rows:
        return 0.0
    correct = sum(1 for r in rows if classify(r, t) == r["shape"])
    return correct / len(rows)


def load_rows():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            rows.append({
                "split": r["split"],
                "shape": r["shape"],
                "lengthToWidthRatio": float(r["lengthToWidthRatio"]),
                "foreheadVsCheek": float(r["foreheadVsCheek"]),
                "jawVsCheek": float(r["jawVsCheek"]),
            })
    return rows


def frange(lo, hi, step):
    n = int(round((hi - lo) / step))
    return [round(lo + i * step, 4) for i in range(n + 1)]


def main():
    rows = load_rows()
    train = [r for r in rows if r["split"] == "training_set"]
    test = [r for r in rows if r["split"] == "testing_set"]
    print(f"train={len(train)} test={len(test)}")

    print("\n--- Baseline: current production thresholds ---")
    print(f"train acc: {accuracy(train, PROD):.3f}")
    print(f"test  acc: {accuracy(test, PROD):.3f}")

    heart_false_fires = sum(
        1 for r in train
        if r["foreheadVsCheek"] < PROD["heart_forehead_max"] and r["jawVsCheek"] > PROD["heart_jaw_min"]
    )
    print(f"heart condition false-fires on non-heart training data: {heart_false_fires}/{len(train)}")

    # Grid search oblong_cutoff, oval_cutoff (< oblong_cutoff), square_jaw_max.
    # Heart thresholds are left fixed — no positive examples to calibrate them against.
    best = None
    for oblong_cutoff in frange(1.15, 1.70, 0.01):
        for oval_cutoff in frange(1.00, oblong_cutoff - 0.02, 0.01):
            for square_jaw_max in frange(0.00, 0.20, 0.005):
                t = {
                    "oblong_cutoff": oblong_cutoff,
                    "heart_forehead_max": PROD["heart_forehead_max"],
                    "heart_jaw_min": PROD["heart_jaw_min"],
                    "oval_cutoff": oval_cutoff,
                    "square_jaw_max": square_jaw_max,
                }
                acc = accuracy(train, t)
                if best is None or acc > best[0]:
                    best = (acc, t)

    best_acc, best_t = best
    print("\n--- Best thresholds found on training_set ---")
    print(best_t)
    print(f"train acc: {best_acc:.3f}")
    print(f"test  acc: {accuracy(test, best_t):.3f}")

    # Per-class breakdown on test set with the new thresholds.
    print("\n--- Per-class test accuracy (new thresholds) ---")
    for shape in ("oval", "oblong", "round", "square"):
        subset = [r for r in test if r["shape"] == shape]
        print(f"{shape:10s} n={len(subset):3d} acc={accuracy(subset, best_t):.3f}")

    heart_false_fires_new = sum(
        1 for r in train
        if r["foreheadVsCheek"] < best_t["heart_forehead_max"] and r["jawVsCheek"] > best_t["heart_jaw_min"]
    )
    print(f"\nheart condition false-fires with new thresholds: {heart_false_fires_new}/{len(train)}")


if __name__ == "__main__":
    main()
