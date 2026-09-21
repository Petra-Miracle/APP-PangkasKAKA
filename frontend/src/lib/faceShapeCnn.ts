// On-device face-shape classification via a MobileNetV2 model trained on
// backend/db/Data-Trainning (see backend/tools/face_shape_train_cnn.py).
// Runs through react-native-fast-tflite (Nitro/JSI, CPU delegate) — same
// on-device guarantee as the geometric fallback in faceShape.ts: the photo
// never leaves the device, only the resulting shape label does.
//
// The training dataset only covers 4 shapes (no "heart" examples), so this
// model can never predict "heart" — ai-scan.tsx falls back to the geometric
// classifier's result for that one case.

import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { useTensorflowModel } from "react-native-fast-tflite";
import type { TensorflowModel } from "react-native-fast-tflite";
import type { FaceShape } from "./faceShape";

const MODEL_INPUT_SIZE = 224;

// Order matches backend/ml_models/face_shape_labels.json's class_names
// (alphabetical dataset folder order — do not reorder without retraining).
const CLASS_NAMES = ["ovale", "rectangular", "round", "square"] as const;
const CLASS_TO_SHAPE: Record<(typeof CLASS_NAMES)[number], FaceShape> = {
  ovale: "oval",
  rectangular: "oblong",
  round: "round",
  square: "square",
};

export interface CnnFaceShapeResult {
  shape: FaceShape;
  confidence: number; // 0-100
}

export function useFaceShapeModel() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return useTensorflowModel(require("../../assets/models/face-shape.tflite"), []);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const c3 = clean[i + 2];
    const c4 = clean[i + 3];
    const e3 = c3 && c3 !== "=" ? chars.indexOf(c3) : -1;
    const e4 = c4 && c4 !== "=" ? chars.indexOf(c4) : -1;
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 !== -1) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (e4 !== -1) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes.slice(0, p);
}

// Runs the CNN on a single snapshot (the still frame captured once the
// geometric classifier's live-preview loop reports a stable face). This is
// a one-shot classification, not per-frame, so JS-side JPEG decode is fine.
export async function classifyFaceShapeCnn(
  model: TensorflowModel,
  snapshotUri: string
): Promise<CnnFaceShapeResult | null> {
  const resized = await ImageManipulator.manipulateAsync(
    snapshotUri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!resized.base64) return null;

  const jpegBytes = base64ToUint8Array(resized.base64);
  const decoded = jpeg.decode(jpegBytes, { useTArray: true });
  if (decoded.width !== MODEL_INPUT_SIZE || decoded.height !== MODEL_INPUT_SIZE) return null;

  // Model input is float32 [1,224,224,3], values 0-255 (Rescaling is baked
  // into the graph) — see build_model() in face_shape_train_cnn.py.
  const rgba = decoded.data;
  const input = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  for (let i = 0, j = 0; j < input.length; i += 4, j += 3) {
    input[j] = rgba[i];
    input[j + 1] = rgba[i + 1];
    input[j + 2] = rgba[i + 2];
  }

  const outputs = await model.run([input.buffer]);
  const probs = new Float32Array(outputs[0]);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }

  const shape = CLASS_TO_SHAPE[CLASS_NAMES[bestIdx]];
  if (!shape) return null;
  return { shape, confidence: Math.round(probs[bestIdx] * 100) };
}
