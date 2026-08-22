// Geometric face-shape classification from an ML Kit face contour (via
// react-native-vision-camera-face-detector's `contours.FACE` point array).
// Runs fully on-device — no image or network round-trip needed to get a shape.

export type FaceShape = "oval" | "round" | "square" | "oblong" | "heart";

export interface FaceShapeMeasurements {
  faceLength: number;
  foreheadWidth: number;
  cheekboneWidth: number;
  jawWidth: number;
  lengthToWidthRatio: number;
}

export interface FaceShapeResult {
  shape: FaceShape;
  confidence: number;
  measurements: FaceShapeMeasurements;
}

interface Point {
  x: number;
  y: number;
}

// ML Kit's FACE contour has ~36 points tracing the face outline; below this
// we don't have enough resolution to trust the width bands.
const MIN_CONTOUR_POINTS = 20;

function widthInBand(points: Point[], minY: number, faceLength: number, fromRatio: number, toRatio: number): number {
  const yFrom = minY + fromRatio * faceLength;
  const yTo = minY + toRatio * faceLength;
  const band = points.filter((p) => p.y >= yFrom && p.y <= yTo);
  if (band.length < 2) return 0;
  const xs = band.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
}

export function classifyFaceShape(facePoints: Point[]): FaceShapeResult | null {
  if (!facePoints || facePoints.length < MIN_CONTOUR_POINTS) return null;

  const ys = facePoints.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const faceLength = maxY - minY;
  if (faceLength <= 0) return null;

  // Bands as fraction of face length, top (forehead/hairline area) to bottom (chin).
  const foreheadWidth = widthInBand(facePoints, minY, faceLength, 0.05, 0.25);
  const cheekboneWidth = widthInBand(facePoints, minY, faceLength, 0.35, 0.55);
  const jawWidth = widthInBand(facePoints, minY, faceLength, 0.78, 0.95);
  if (foreheadWidth === 0 || cheekboneWidth === 0 || jawWidth === 0) return null;

  const lengthToWidthRatio = faceLength / cheekboneWidth;
  const foreheadVsCheek = (cheekboneWidth - foreheadWidth) / cheekboneWidth;
  const jawVsCheek = (cheekboneWidth - jawWidth) / cheekboneWidth;

  // Thresholds calibrated against a 30-face labeled reference set (6 per shape;
  // see backend/db/Data-Wajah/data_wajah.xlsx). The previous thresholds put real
  // oval samples inside heart's bucket (heart only required jawVsCheek > 0.14,
  // but oval's own jawVsCheek reaches 0.24) and real square samples inside
  // round's (the round/square split used lengthToWidthRatio < 1.15, but square
  // faces in the reference set never exceed 1.10 either) — oblong's own cutoff
  // of 1.55 was also higher than any oblong sample in the reference set ever
  // reaches (max 1.54), so oblong could never actually fire. lengthToWidthRatio
  // barely differs between oval/round/square/heart (they overlap heavily) and
  // only cleanly separates oblong; foreheadVsCheek/jawVsCheek carry the real
  // per-shape signal and now drive heart/square/round directly.
  let shape: FaceShape;
  let marginScore: number; // 0-1, how clearly the measurements fit the bucket

  if (lengthToWidthRatio > 1.37) {
    shape = "oblong";
    marginScore = Math.min(1, (lengthToWidthRatio - 1.37) / 0.3);
  } else if (foreheadVsCheek < 0.015 && jawVsCheek > 0.175) {
    shape = "heart";
    marginScore = Math.min(1, (jawVsCheek - 0.175) / 0.15);
  } else if (lengthToWidthRatio > 1.12) {
    shape = "oval";
    marginScore = Math.min(1, (lengthToWidthRatio - 1.12) / 0.2);
  } else if (jawVsCheek < 0.055) {
    shape = "square";
    marginScore = Math.min(1, (0.055 - jawVsCheek) / 0.1);
  } else {
    shape = "round";
    marginScore = Math.min(1, (jawVsCheek - 0.055) / 0.12);
  }

  const confidence = Math.round(65 + Math.max(0, Math.min(1, marginScore)) * 30);

  return {
    shape,
    confidence,
    measurements: { faceLength, foreheadWidth, cheekboneWidth, jawWidth, lengthToWidthRatio },
  };
}

// Reject readings taken while the head is turned/tilted — contour widths get
// distorted by perspective and would produce a wrong shape.
export function isFrontalPose(pitchAngle: number, rollAngle: number, yawAngle: number, thresholdDeg = 15): boolean {
  return Math.abs(pitchAngle) < thresholdDeg && Math.abs(rollAngle) < thresholdDeg && Math.abs(yawAngle) < thresholdDeg;
}
