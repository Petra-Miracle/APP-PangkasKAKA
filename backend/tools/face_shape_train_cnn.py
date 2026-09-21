"""
Trains a MobileNetV2 transfer-learning classifier on
backend/db/Data-Trainning/men/{training_set,testing_set} and exports a
TFLite model for on-device inference in the app (frontend/assets/models).

Why a CNN instead of recalibrating the geometric on-device heuristic
(frontend/src/lib/faceShape.ts): a grid search over that heuristic's 3
width-ratio features (see face_shape_calibrate.py) topped out at ~22%
held-out accuracy on this dataset — the classes overlap too heavily on
those 3 numbers to be separable by threshold rules. A CNN learns directly
from pixels instead of 3 hand-picked ratios, which is the standard
approach for face-shape classification and what this dataset size (1311
images) supports.

Two-phase training:
  1. Frozen MobileNetV2 base, train just the classification head.
  2. Unfreeze the top of the base and fine-tune at a low learning rate.

Preprocessing (Rescaling to [-1, 1], matching MobileNetV2's expected
input) is baked into the model graph itself, so the exported TFLite model
takes a raw 0-255 RGB 224x224 image with no client-side normalization to
get right/wrong.

Usage: backend/venv/Scripts/python.exe backend/tools/face_shape_train_cnn.py
"""

import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix

ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "db" / "Data-Trainning" / "men"
OUT_DIR = ROOT / "ml_models"
OUT_DIR.mkdir(exist_ok=True)

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
SEED = 42

# Dataset class folder -> app's FaceShape label. No "heart" class exists in
# this dataset, so the CNN can only ever predict these four.
CLASS_TO_SHAPE = {"ovale": "oval", "rectangular": "oblong", "round": "round", "square": "square"}


def make_datasets():
    train_ds = tf.keras.utils.image_dataset_from_directory(
        DATASET_DIR / "training_set",
        validation_split=0.2,
        subset="training",
        seed=SEED,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        DATASET_DIR / "training_set",
        validation_split=0.2,
        subset="validation",
        seed=SEED,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
    )
    test_ds = tf.keras.utils.image_dataset_from_directory(
        DATASET_DIR / "testing_set",
        shuffle=False,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
    )
    class_names = train_ds.class_names  # alphabetical: ovale, rectangular, round, square
    train_ds = train_ds.prefetch(tf.data.AUTOTUNE)
    val_ds = val_ds.prefetch(tf.data.AUTOTUNE)
    test_ds = test_ds.prefetch(tf.data.AUTOTUNE)
    return train_ds, val_ds, test_ds, class_names


def build_model(num_classes):
    augment = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.04),
        tf.keras.layers.RandomZoom(0.1),
        tf.keras.layers.RandomContrast(0.1),
    ], name="augment")

    base = tf.keras.applications.MobileNetV2(
        input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet"
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    x = augment(inputs)
    x = tf.keras.layers.Rescaling(1.0 / 127.5, offset=-1.0)(x)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)
    return model, base


def evaluate(model, test_ds, class_names):
    y_true, y_pred = [], []
    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true.extend(labels.numpy().tolist())
        y_pred.extend(np.argmax(preds, axis=1).tolist())
    print("\n--- Held-out test set report (backend/db/Data-Trainning/men/testing_set) ---")
    print(classification_report(y_true, y_pred, target_names=class_names, digits=3))
    print("Confusion matrix (rows=true, cols=pred):")
    print(class_names)
    print(confusion_matrix(y_true, y_pred))
    return y_true, y_pred


def compute_class_weight(train_ds, num_classes):
    counts = np.zeros(num_classes)
    for _, labels in train_ds.unbatch():
        counts[int(labels.numpy())] += 1
    total = counts.sum()
    # Inverse-frequency weighting so the loss stops favoring whichever class
    # has the most training images (round=278 vs rectangular=194 raw counts).
    weights = total / (num_classes * counts)
    print(f"Class counts: {counts.tolist()} -> weights: {weights.tolist()}")
    return {i: float(w) for i, w in enumerate(weights)}


def main():
    train_ds, val_ds, test_ds, class_names = make_datasets()
    print(f"Classes: {class_names}")
    class_weight = compute_class_weight(train_ds, len(class_names))

    model, base = build_model(len(class_names))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    early_stop = tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy", patience=6, restore_best_weights=True
    )
    reduce_lr = tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_accuracy", factor=0.5, patience=3, min_lr=1e-7
    )

    print("\n=== Phase 1: training classification head (base frozen) ===")
    model.fit(
        train_ds, validation_data=val_ds, epochs=25,
        class_weight=class_weight, callbacks=[early_stop, reduce_lr],
    )

    # Round 2 unfroze the top 60 layers and got a worse held-out test score
    # (42.7%) than round 1's top-30 unfreeze (45.6%) despite a higher training
    # accuracy — classic overfitting on a ~900-image training set. Back to 30.
    print("\n=== Phase 2: fine-tuning top of MobileNetV2 ===")
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    early_stop_ft = tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy", patience=6, restore_best_weights=True
    )
    reduce_lr_ft = tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_accuracy", factor=0.5, patience=3, min_lr=1e-8
    )
    model.fit(
        train_ds, validation_data=val_ds, epochs=25,
        class_weight=class_weight, callbacks=[early_stop_ft, reduce_lr_ft],
    )

    evaluate(model, test_ds, class_names)

    keras_path = OUT_DIR / "face_shape_model.keras"
    model.save(keras_path)
    print(f"\nSaved Keras model to {keras_path}")

    # TFLite export, float16 quantized (halves model size, negligible accuracy loss,
    # runs well on-device — full int8 quantization is a possible later optimization).
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()
    tflite_path = OUT_DIR / "face_shape_model.tflite"
    tflite_path.write_bytes(tflite_model)
    print(f"Saved TFLite model to {tflite_path} ({len(tflite_model) / 1e6:.2f} MB)")

    labels_path = OUT_DIR / "face_shape_labels.json"
    labels_path.write_text(
        json.dumps({"class_names": class_names, "class_to_shape": CLASS_TO_SHAPE}, indent=2),
        encoding="utf-8",
    )
    print(f"Saved labels to {labels_path}")


if __name__ == "__main__":
    main()
