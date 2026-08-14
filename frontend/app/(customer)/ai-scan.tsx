import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Camera, useCameraDevice, useCameraPermission, type CameraRef } from "react-native-vision-camera";
import { useImageFaceDetector, type Face } from "react-native-vision-camera-face-detector";
import Svg, { Circle } from "react-native-svg";
import { api, COLORS, FONT } from "@/src/lib/api";
import { classifyFaceShape, isFrontalPose, type FaceShapeResult } from "@/src/lib/faceShape";

type ScanResult = { faceShape: string; confidence: number; reasoning: string; recommendations: any[] };

const SHAPE_LABEL: Record<string, string> = { oval: "Oval", round: "Bulat", square: "Kotak", oblong: "Oblong", heart: "Hati" };
const STABLE_FRAMES_REQUIRED = 15;
const RING_SIZE = 240;
const RING_STROKE = 6;

export default function AIScan() {
  const router = useRouter();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const cameraRef = useRef<CameraRef>(null);
  // Must be a stable reference — a fresh object literal every render makes
  // useImageFaceDetector's internal useMemo recreate the native detector on
  // every re-render (progress updates re-render this component every ~350ms).
  const detectorOptions = useMemo(() => ({ performanceMode: "fast" as const, runContours: true }), []);
  const faceDetector = useImageFaceDetector(detectorOptions);

  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState(0); // 0-1, drives the ring
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const lastShapeRef = useRef<FaceShapeResult["shape"] | null>(null);
  const stableCountRef = useRef(0);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const onStable = useCallback(async (classified: FaceShapeResult) => {
    setScanning(false);
    setAnalyzing(true);
    setErr(null);
    try {
      const r = await api.post("/ai/face-scan", {
        face_shape: classified.shape,
        confidence: classified.confidence,
        measurements: classified.measurements,
      });
      setResult(r);
    } catch (e: any) {
      setErr(e.message || "Analisis gagal, coba lagi");
    }
    setAnalyzing(false);
  }, []);

  const handleFacesDetected = useCallback((faces: Face[]) => {
    if (triggeredRef.current || !scanning) return;
    const face = faces?.[0];
    const points = face?.contours?.FACE;
    if (!face || !points) {
      stableCountRef.current = 0;
      lastShapeRef.current = null;
      setProgress(0);
      setDebugInfo(`wajah: ${faces?.length ?? 0} terdeteksi${face ? ", tanpa contour" : ""}`);
      return;
    }
    if (!isFrontalPose(face.pitchAngle, face.rollAngle, face.yawAngle)) {
      stableCountRef.current = 0;
      lastShapeRef.current = null;
      setProgress(0);
      setDebugInfo(`pitch:${face.pitchAngle.toFixed(0)} roll:${face.rollAngle.toFixed(0)} yaw:${face.yawAngle.toFixed(0)}`);
      return;
    }
    const classified = classifyFaceShape(points);
    if (!classified) {
      stableCountRef.current = 0;
      setProgress(0);
      setDebugInfo(`contour: ${points.length} titik, gagal diklasifikasi`);
      return;
    }
    setDebugInfo(`stabil: ${classified.shape} (${stableCountRef.current + 1}/${STABLE_FRAMES_REQUIRED})`);
    if (lastShapeRef.current === classified.shape) {
      stableCountRef.current += 1;
    } else {
      stableCountRef.current = 1;
      lastShapeRef.current = classified.shape;
    }
    setProgress(Math.min(1, stableCountRef.current / STABLE_FRAMES_REQUIRED));
    if (stableCountRef.current >= STABLE_FRAMES_REQUIRED) {
      triggeredRef.current = true;
      onStable(classified);
    }
  }, [scanning, onStable]);

  useEffect(() => {
    if (!scanning || !device || !hasPermission) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const loop = async () => {
      if (cancelled) return;
      try {
        const cam = cameraRef.current;
        if (cam) {
          const snapshot = await cam.takeSnapshot();
          const path = await snapshot.saveToTemporaryFileAsync("jpg", 70);
          const faces = faceDetector.detectFaces(`file://${path}`);
          if (!cancelled) handleFacesDetected(faces);
        }
      } catch (e: any) {
        // Surface capture/detect failures instead of failing silently forever —
        // this is what used to make the scanner look "frozen" with no feedback.
        if (!cancelled) setDebugInfo(`error: ${e?.message || String(e)}`);
      }
      if (!cancelled) timer = setTimeout(loop, 350);
    };
    timer = setTimeout(loop, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanning, device, hasPermission, faceDetector, handleFacesDetected]);

  const retry = () => {
    setResult(null);
    setErr(null);
    setProgress(0);
    stableCountRef.current = 0;
    lastShapeRef.current = null;
    triggeredRef.current = false;
    setScanning(true);
  };

  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.head}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={24} color={COLORS.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Face Scan</Text>
            <Text style={styles.sub}>Deteksi bentuk wajah real-time, langsung di HP-mu</Text>
          </View>
        </View>

        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
          <Text style={styles.privacyText}>Foto tidak pernah dikirim ke server — analisis 100% di perangkatmu</Text>
        </View>

        {!result && !analyzing && (
          <View style={styles.cameraBox}>
            {!hasPermission && (
              <View style={styles.permBox}>
                <Ionicons name="camera-outline" size={48} color={COLORS.textDim} />
                <Text style={styles.permText}>Izin kamera dibutuhkan untuk AI Face Scan</Text>
                <Pressable
                  style={styles.permBtn}
                  onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
                >
                  <Text style={styles.permBtnText}>{canRequestPermission ? "Izinkan Kamera" : "Buka Pengaturan"}</Text>
                </Pressable>
              </View>
            )}
            {hasPermission && !device && (
              <View style={styles.permBox}>
                <Ionicons name="camera-outline" size={48} color={COLORS.textDim} />
                <Text style={styles.permText}>Kamera depan tidak ditemukan di perangkat ini</Text>
              </View>
            )}
            {hasPermission && device && (
              <>
                <Camera
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={scanning}
                  onError={(e) => setErr(e.message || "Kamera gagal dimuat")}
                />
                <View style={styles.overlay} pointerEvents="none">
                  <Svg width={RING_SIZE} height={RING_SIZE}>
                    <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} stroke="rgba(255,255,255,0.3)" strokeWidth={RING_STROKE} fill="none" />
                    <Circle
                      cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r}
                      stroke={COLORS.brand} strokeWidth={RING_STROKE} fill="none"
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={circumference * (1 - progress)}
                      strokeLinecap="round"
                      rotation={-90}
                      origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                    />
                  </Svg>
                </View>
                <View style={styles.instructionBox} pointerEvents="none">
                  <Text style={styles.instructionText}>
                    {progress > 0 ? "Tahan posisi wajahmu..." : "Posisikan wajah di dalam lingkaran"}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* TODO: remove once AI Scan detection is confirmed stable on-device */}
        {!result && !analyzing && !!debugInfo && (
          <View style={styles.debugBox}>
            <Text style={styles.debugText} numberOfLines={4}>{debugInfo}</Text>
          </View>
        )}

        {analyzing && (
          <View style={styles.cameraBox}>
            <ActivityIndicator color={COLORS.brand} size="large" />
            <Text style={[styles.instructionText, { color: COLORS.text, marginTop: 16 }]}>Menganalisis...</Text>
          </View>
        )}

        {err && (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errText} testID="scan-error">{err}</Text>
          </View>
        )}
        {err && (
          <Pressable style={styles.retryBtn} onPress={retry}>
            <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        )}

        {result && (
          <View style={styles.resultBox}>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>BENTUK WAJAH TERDETEKSI</Text>
              <Text style={styles.resultShape} testID="face-shape">{SHAPE_LABEL[result.faceShape] || result.faceShape}</Text>
              <View style={styles.confRow}>
                <View style={styles.confBar}>
                  <View style={[styles.confFill, { width: `${result.confidence}%` }]} />
                </View>
                <Text style={styles.confText}>{result.confidence}%</Text>
              </View>
              <Text style={styles.resultReason}>{result.reasoning}</Text>
            </View>

            <Text style={styles.recsTitle}>REKOMENDASI GAYA</Text>
            {result.recommendations.map((h: any) => (
              <View key={h.id} style={styles.recCard} testID={`rec-${h.id}`}>
                <Image source={{ uri: h.image_url }} style={styles.recImg} contentFit="cover" />
                <View style={{ flex: 1, padding: 14 }}>
                  <Text style={styles.recName}>{h.name}</Text>
                  <Text style={styles.recDesc} numberOfLines={2}>{h.description}</Text>
                  <Pressable style={styles.bookBtn} onPress={() => router.push("/(customer)/home")} testID={`book-${h.id}`}>
                    <Text style={styles.bookBtnText}>PESAN GAYA INI</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable style={styles.retryBtn} onPress={retry}>
              <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
              <Text style={styles.retryText}>Scan Ulang</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  sub: { color: COLORS.textDim, marginTop: 2, fontSize: 12, fontFamily: FONT.medium },
  privacy: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ECFDF5", padding: 12, borderRadius: 12, marginBottom: 20 },
  privacyText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },

  cameraBox: { backgroundColor: "#000", borderRadius: 20, height: 420, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  instructionBox: { position: "absolute", bottom: 20, left: 20, right: 20, alignItems: "center" },
  instructionText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: "hidden" },
  debugBox: { backgroundColor: "#0A2540", borderRadius: 10, padding: 10, marginTop: 10 },
  debugText: { color: "#8FA5BF", fontSize: 10, fontFamily: FONT.medium },
  permBox: { alignItems: "center", padding: 24, gap: 10 },
  permText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13, textAlign: "center" },
  permBtn: { backgroundColor: COLORS.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, marginTop: 4 },
  permBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13 },

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 14, borderRadius: 12, marginTop: 12 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium },

  resultBox: { marginTop: 20 },
  resultCard: { backgroundColor: COLORS.brand, padding: 24, borderRadius: 20, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6 },
  resultLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 1, fontFamily: FONT.bold },
  resultShape: { color: "#FFFFFF", fontSize: 42, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  confRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  confBar: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, overflow: "hidden" },
  confFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 999 },
  confText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13 },
  resultReason: { color: "rgba(255,255,255,0.9)", marginTop: 12, fontSize: 13, lineHeight: 20, fontFamily: FONT.medium },
  recsTitle: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.bold, marginTop: 28, marginBottom: 12, letterSpacing: 0.8 },
  recCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", marginBottom: 12, overflow: "hidden" },
  recImg: { width: 110, height: 140 },
  recName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  recDesc: { color: COLORS.textDim, fontSize: 12, marginTop: 4, fontFamily: FONT.medium, lineHeight: 18 },
  bookBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brand, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginTop: 10, alignSelf: "flex-start" },
  bookBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 10, letterSpacing: 0.5 },
  retryBtn: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 20, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", backgroundColor: COLORS.surface },
  retryText: { color: COLORS.textMuted, fontFamily: FONT.bold },
});
