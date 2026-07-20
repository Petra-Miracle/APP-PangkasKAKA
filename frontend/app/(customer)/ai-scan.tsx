import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { api, COLORS } from "@/src/lib/api";

type ScanResult = { id: string; faceShape: string; confidence: number; reasoning: string; recommendations: any[] };

const SHAPE_LABEL: Record<string, string> = {
  oval: "Oval", round: "Bulat", square: "Kotak", oblong: "Oblong", heart: "Hati",
};

export default function AIScan() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    setErr(null);
    let perm;
    if (fromCamera) perm = await ImagePicker.requestCameraPermissionsAsync();
    else perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      setErr("Izin " + (fromCamera ? "kamera" : "galeri") + " ditolak. Silakan pilih opsi lain.");
      return;
    }
    const opts: any = { base64: true, quality: 0.7, allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const asset = res.assets[0];
    setPreviewUri(asset.uri);
    await analyze(asset.base64!);
  };

  const analyze = async (b64: string) => {
    setAnalyzing(true); setErr(null); setResult(null);
    try {
      const r = await api.post("/ai/face-scan", { image_base64: b64 });
      setResult(r);
    } catch (e: any) { setErr(e.message || "Analisis gagal, coba lagi"); }
    setAnalyzing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.title}>AI Face Scan</Text>
        <Text style={styles.sub}>Foto dianalisis lalu langsung dihapus — hanya hasil yang disimpan.</Text>

        {!result && !analyzing && (
          <View style={styles.preview}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImg} contentFit="cover" />
            ) : (
              <View style={styles.previewEmpty}>
                <Ionicons name="scan-circle-outline" size={80} color={COLORS.brand} />
                <Text style={styles.previewText}>Pilih foto wajah</Text>
                <Text style={styles.previewHint}>Foto depan, cahaya merata</Text>
              </View>
            )}
          </View>
        )}

        {analyzing && (
          <View style={styles.preview}>
            <ActivityIndicator color={COLORS.brand} size="large" />
            <Text style={[styles.previewText, { marginTop: 16 }]}>Menganalisis bentuk wajah...</Text>
          </View>
        )}

        {err && (
          <View style={styles.errBox}><Text style={styles.errText} testID="scan-error">{err}</Text></View>
        )}

        {!analyzing && (
          <View style={styles.btnRow}>
            <Pressable testID="scan-camera" style={styles.btnPrimary} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={20} color="#121212" />
              <Text style={styles.btnPrimaryText}>KAMERA</Text>
            </Pressable>
            <Pressable testID="scan-gallery" style={styles.btnSecondary} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={20} color={COLORS.brandLight} />
              <Text style={styles.btnSecondaryText}>GALERI</Text>
            </Pressable>
          </View>
        )}

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>BENTUK WAJAH TERDETEKSI</Text>
            <Text style={styles.resultShape} testID="face-shape">{SHAPE_LABEL[result.faceShape] || result.faceShape}</Text>
            <Text style={styles.resultConf}>Confidence: {result.confidence}%</Text>
            <Text style={styles.resultReason}>{result.reasoning}</Text>

            <Text style={styles.recsTitle}>Rekomendasi Gaya</Text>
            {result.recommendations.map((h: any) => (
              <View key={h.id} style={styles.recCard} testID={`rec-${h.id}`}>
                <Image source={{ uri: h.image_url }} style={styles.recImg} contentFit="cover" />
                <View style={{ flex: 1, padding: 12 }}>
                  <Text style={styles.recName}>{h.name}</Text>
                  <Text style={styles.recDesc} numberOfLines={2}>{h.description}</Text>
                  <Pressable style={styles.bookBtn} onPress={() => router.push("/(customer)/home")} testID={`book-${h.id}`}>
                    <Text style={styles.bookBtnText}>PESAN GAYA INI</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable style={styles.retryBtn} onPress={() => { setResult(null); setPreviewUri(null); }}>
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
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  sub: { color: COLORS.textDim, marginTop: 4, marginBottom: 20, fontSize: 12 },
  preview: { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, height: 300, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewEmpty: { alignItems: "center" },
  previewImg: { width: "100%", height: "100%" },
  previewText: { color: COLORS.text, marginTop: 8, fontWeight: "700" },
  previewHint: { color: COLORS.textDim, fontSize: 12, marginTop: 4 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.brand, padding: 16, borderRadius: 4, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  btnPrimaryText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  btnSecondary: { flex: 1, backgroundColor: COLORS.surface, padding: 16, borderRadius: 4, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: COLORS.borderStrong },
  btnSecondaryText: { color: COLORS.brandLight, fontWeight: "900", letterSpacing: 1 },
  errBox: { backgroundColor: "#4A0F0F", padding: 12, borderRadius: 4, marginTop: 12 },
  errText: { color: "#FFB4B4" },
  resultBox: { marginTop: 24 },
  resultLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 1 },
  resultShape: { color: COLORS.brand, fontSize: 40, fontWeight: "900", letterSpacing: 1 },
  resultConf: { color: COLORS.textMuted, fontWeight: "700" },
  resultReason: { color: COLORS.textDim, marginTop: 8, fontSize: 13, lineHeight: 20 },
  recsTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900", marginTop: 24, marginBottom: 12 },
  recCard: { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", marginBottom: 12, overflow: "hidden" },
  recImg: { width: 110, height: 130 },
  recName: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  recDesc: { color: COLORS.textDim, fontSize: 12, marginTop: 4 },
  bookBtn: { backgroundColor: COLORS.brand, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4, marginTop: 8, alignSelf: "flex-start" },
  bookBtnText: { color: "#121212", fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  retryBtn: { marginTop: 20, padding: 14, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  retryText: { color: COLORS.textMuted, fontWeight: "700" },
});
