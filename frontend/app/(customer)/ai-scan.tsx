import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Camera, useCameraDevice, useCameraPermission, type CameraRef } from "react-native-vision-camera";
import { useImageFaceDetector, type Face } from "react-native-vision-camera-face-detector";
import Svg, { Circle } from "react-native-svg";
import { api, COLORS, FONT } from "@/src/lib/api";
import { classifyFaceShape, isFrontalPose, type FaceShapeResult } from "@/src/lib/faceShape";
import PressableScale from "@/src/components/PressableScale";

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
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Ionicons name="sparkles" size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Face Scan</Text>
            <Text style={styles.sub}>Deteksi bentuk wajah real-time, langsung di HP-mu</Text>
          </View>
        </View>

        <View style={styles.privacy}>
          <View style={styles.privacyIcon}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
          </View>
          <Text style={styles.privacyText}>Foto tidak pernah dikirim ke server — analisis 100% di perangkatmu</Text>
        </View>

        {!result && !analyzing && (
          <View style={styles.cameraBox}>
            {!hasPermission && (
              <View style={styles.permBox}>
                <Ionicons name="camera-outline" size={48} color={COLORS.textDim} />
                <Text style={styles.permText}>Izin kamera dibutuhkan untuk AI Face Scan</Text>
                <PressableScale
                  style={styles.permBtn}
                  onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
                  haptic
                >
                  <LinearGradient
                    colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.permBtnGrad}
                  >
                    <Text style={styles.permBtnText}>{canRequestPermission ? "Izinkan Kamera" : "Buka Pengaturan"}</Text>
                  </LinearGradient>
                </PressableScale>
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
                  {progress > 0 && (
                    <View style={styles.progressPill}>
                      <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cornerTl} pointerEvents="none" />
                <View style={styles.cornerTr} pointerEvents="none" />
                <View style={styles.cornerBl} pointerEvents="none" />
                <View style={styles.cornerBr} pointerEvents="none" />
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
          <View style={[styles.cameraBox, { gap: 16 }]}>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.analyzingIcon}
            >
              <Ionicons name="scan" size={28} color="#FFFFFF" />
            </LinearGradient>
            <ActivityIndicator color={COLORS.brand} size="large" />
            <Text style={styles.analyzingText}>Menganalisis bentuk wajah...</Text>
          </View>
        )}

        {err && (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errText} testID="scan-error">{err}</Text>
          </View>
        )}
        {err && (
          <PressableScale style={styles.retryBtn} onPress={retry} scaleTo={0.97}>
            <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
            <Text style={styles.retryText}>Coba Lagi</Text>
          </PressableScale>
        )}

        {result && (
          <View style={styles.resultBox}>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resultCard}
            >
              <View pointerEvents="none" style={styles.resultDeco} />
              <Text style={styles.resultLabel}>BENTUK WAJAH TERDETEKSI</Text>
              <Text style={styles.resultShape} testID="face-shape">{SHAPE_LABEL[result.faceShape] || result.faceShape}</Text>
              <View style={styles.confRow}>
                <View style={styles.confBar}>
                  <View style={[styles.confFill, { width: `${result.confidence}%` }]} />
                </View>
                <Text style={styles.confText}>{result.confidence}%</Text>
              </View>
              <Text style={styles.resultReason}>{result.reasoning}</Text>
            </LinearGradient>

            <Text style={styles.recsTitle}>INSPIRASI GAYA UNTUKMU</Text>
            <View style={styles.tipBox}>
              <Ionicons name="bulb" size={16} color={COLORS.warning} />
              <Text style={styles.tipText}>
                Ini referensi gaya, bukan daftar layanan pasti tersedia di semua toko. Tunjukkan foto & nama gaya ini ke barber saat booking — sebagian besar barber bisa menyesuaikan dari referensi.
              </Text>
            </View>
            {result.recommendations.map((h: any) => (
              <PressableScale
                key={h.id}
                style={styles.recCard}
                testID={`rec-${h.id}`}
                onPress={() => router.push({ pathname: "/(customer)/explore", params: { q: h.name } } as any)}
                scaleTo={0.98}
              >
                <Image source={{ uri: h.image_url }} style={styles.recImg} contentFit="cover" />
                <View style={{ flex: 1, padding: 14 }}>
                  <Text style={styles.recName}>{h.name}</Text>
                  <Text style={styles.recDesc} numberOfLines={2}>{h.description}</Text>
                  <PressableScale
                    style={styles.bookBtn}
                    onPress={() => router.push({ pathname: "/(customer)/explore", params: { q: h.name } } as any)}
                    testID={`book-${h.id}`}
                    scaleTo={0.94}
                    haptic
                  >
                    <LinearGradient
                      colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.bookBtnGrad}
                    >
                      <Text style={styles.bookBtnText}>CARI BARBER TERDEKAT</Text>
                      <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                    </LinearGradient>
                  </PressableScale>
                </View>
              </PressableScale>
            ))}
            <PressableScale style={styles.retryBtn} onPress={retry} scaleTo={0.97}>
              <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
              <Text style={styles.retryText}>Scan Ulang</Text>
            </PressableScale>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  sub: { color: COLORS.textDim, marginTop: 2, fontSize: 12, fontFamily: FONT.medium },
  privacy: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ECFDF5", padding: 12, borderRadius: 14, marginBottom: 20 },
  privacyIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  privacyText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },

  cameraBox: { backgroundColor: "#000", borderRadius: 24, height: 420, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#1F2937" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 14 },
  cornerTl: { position: "absolute", top: 16, left: 16, width: 26, height: 26, borderTopWidth: 3, borderLeftWidth: 3, borderColor: COLORS.brand, borderTopLeftRadius: 10 },
  cornerTr: { position: "absolute", top: 16, right: 16, width: 26, height: 26, borderTopWidth: 3, borderRightWidth: 3, borderColor: COLORS.brand, borderTopRightRadius: 10 },
  cornerBl: { position: "absolute", bottom: 16, left: 16, width: 26, height: 26, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: COLORS.brand, borderBottomLeftRadius: 10 },
  cornerBr: { position: "absolute", bottom: 16, right: 16, width: 26, height: 26, borderBottomWidth: 3, borderRightWidth: 3, borderColor: COLORS.brand, borderBottomRightRadius: 10 },
  progressPill: {
    backgroundColor: "rgba(10,37,64,0.75)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  progressText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 12 },
  instructionBox: { position: "absolute", bottom: 20, left: 20, right: 20, alignItems: "center" },
  instructionText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: "hidden" },
  analyzingIcon: {
    width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  analyzingText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  debugBox: { backgroundColor: "#0A2540", borderRadius: 12, padding: 10, marginTop: 10 },
  debugText: { color: "#8FA5BF", fontSize: 10, fontFamily: FONT.medium },
  permBox: { alignItems: "center", padding: 24, gap: 10 },
  permText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13, textAlign: "center" },
  permBtn: { borderRadius: 999, overflow: "hidden", marginTop: 4, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  permBtnGrad: { paddingHorizontal: 22, paddingVertical: 12 },
  permBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13 },

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 14, borderRadius: 14, marginTop: 12 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium },

  resultBox: { marginTop: 20 },
  resultCard: { padding: 24, borderRadius: 24, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6, overflow: "hidden" },
  resultDeco: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -40 },
  resultLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 1, fontFamily: FONT.bold },
  resultShape: { color: "#FFFFFF", fontSize: 42, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  confRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  confBar: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, overflow: "hidden" },
  confFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 999 },
  confText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13 },
  resultReason: { color: "rgba(255,255,255,0.9)", marginTop: 12, fontSize: 13, lineHeight: 20, fontFamily: FONT.medium },
  recsTitle: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.bold, marginTop: 28, marginBottom: 12, letterSpacing: 0.8 },
  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFF7ED", padding: 12, borderRadius: 14, marginBottom: 14 },
  tipText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12, flex: 1, lineHeight: 17 },
  recCard: {
    backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", marginBottom: 12, overflow: "hidden",
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  recImg: { width: 110, height: 140 },
  recName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  recDesc: { color: COLORS.textDim, fontSize: 12, marginTop: 4, fontFamily: FONT.medium, lineHeight: 18 },
  bookBtn: { borderRadius: 10, marginTop: 10, alignSelf: "flex-start", overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 },
  bookBtnGrad: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 9, paddingHorizontal: 12 },
  bookBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 10, letterSpacing: 0.5 },
  retryBtn: {
    flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 20, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", backgroundColor: COLORS.surface,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  retryText: { color: COLORS.textMuted, fontFamily: FONT.bold },
});