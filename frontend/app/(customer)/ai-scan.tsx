import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";

type ScanResult = { id: string; faceShape: string; confidence: number; reasoning: string; recommendations: any[] };

const SHAPE_LABEL: Record<string, string> = { oval: "Oval", round: "Bulat", square: "Kotak", oblong: "Oblong", heart: "Hati" };

export default function AIScan() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    setErr(null);
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { setErr("Izin " + (fromCamera ? "kamera" : "galeri") + " ditolak. Silakan pilih opsi lain."); return; }
    const opts: any = { base64: true, quality: 0.7, allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const asset = res.assets[0];
    setPreviewUri(asset.uri);
    await analyze(asset.base64!);
  };

  const analyze = async (b64: string) => {
    setAnalyzing(true); setErr(null); setResult(null);
    try { const r = await api.post("/ai/face-scan", { image_base64: b64 }); setResult(r); }
    catch (e: any) { setErr(e.message || "Analisis gagal, coba lagi"); }
    setAnalyzing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.head}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={24} color={COLORS.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Face Scan</Text>
            <Text style={styles.sub}>Foto dianalisis oleh AI, lalu dihapus otomatis</Text>
          </View>
        </View>

        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
          <Text style={styles.privacyText}>Privasi terjaga · Foto tidak disimpan di server</Text>
        </View>

        {!result && !analyzing && (
          <View style={styles.preview}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImg} contentFit="cover" />
            ) : (
              <View style={styles.previewEmpty}>
                <View style={styles.previewIcon}>
                  <Ionicons name="scan-circle-outline" size={64} color={COLORS.brand} />
                </View>
                <Text style={styles.previewText}>Ambil foto wajah</Text>
                <Text style={styles.previewHint}>Foto depan, pencahayaan merata</Text>
              </View>
            )}
          </View>
        )}

        {analyzing && (
          <View style={styles.preview}>
            <ActivityIndicator color={COLORS.brand} size="large" />
            <Text style={[styles.previewText, { marginTop: 16 }]}>Menganalisis bentuk wajah...</Text>
            <Text style={styles.previewHint}>AI sedang bekerja, tunggu sebentar</Text>
          </View>
        )}

        {err && (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errText} testID="scan-error">{err}</Text>
          </View>
        )}

        {!analyzing && (
          <View style={styles.btnRow}>
            <Pressable testID="scan-camera" style={styles.btnPrimary} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>KAMERA</Text>
            </Pressable>
            <Pressable testID="scan-gallery" style={styles.btnSecondary} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={20} color={COLORS.brand} />
              <Text style={styles.btnSecondaryText}>GALERI</Text>
            </Pressable>
          </View>
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
            <Pressable style={styles.retryBtn} onPress={() => { setResult(null); setPreviewUri(null); }}>
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
  privacyText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12 },
  preview: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, height: 320, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewEmpty: { alignItems: "center", padding: 20 },
  previewIcon: { width: 100, height: 100, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  previewImg: { width: "100%", height: "100%" },
  previewText: { color: COLORS.text, marginTop: 8, fontFamily: FONT.bold, fontSize: 15 },
  previewHint: { color: COLORS.textDim, fontSize: 12, marginTop: 4, fontFamily: FONT.medium },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  btnPrimaryText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
  btnSecondary: { flex: 1, backgroundColor: COLORS.surface, padding: 16, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: COLORS.border },
  btnSecondaryText: { color: COLORS.brand, fontFamily: FONT.extrabold, letterSpacing: 1 },
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
