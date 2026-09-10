import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

// MapLibre (peta live tracking) tidak jalan di web build — file .web.tsx ini
// otomatis dipilih Metro saat build untuk web, jadi turun ke kartu jarak/status
// berbasis teks saja (sama seperti tampilan sebelum peta ditambahkan). Peta
// penuh tetap tersedia di aplikasi mobile — lihat [bookingId].tsx.
const POLL_INTERVAL = 8000;

type LocationResp = { lat: number; lng: number; updated_at: string; distance_km?: number };

export default function TrackBarberScreenWeb() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loc, setLoc] = useState<LocationResp | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<any>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const r = await api.get(`/bookings/${bookingId}/karyawan-location`);
      setLoc(r);
      setLocError(null);
    } catch (e: any) {
      setLoc(null);
      setLocError(e.message || "Lokasi barber belum tersedia");
    }
  }, [bookingId]);

  useEffect(() => {
    (async () => {
      try {
        const b = await api.get(`/bookings/${bookingId}`);
        setBooking(b);
      } catch {}
      await fetchLocation();
      setLoading(false);
    })();
    pollRef.current = setInterval(fetchLocation, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bookingId, fetchLocation]);

  const secondsAgo = loc ? Math.max(0, Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000)) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.backRow}>
          <PressableScale onPress={() => router.back()} style={styles.back} scaleTo={0.9}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </PressableScale>
          <Text style={styles.backTitle}>Lacak Barber</Text>
        </View>

        <LinearGradient
          colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.heroDeco} />
          <View style={styles.heroIcon}>
            <Ionicons name="bicycle" size={28} color={COLORS.onBrand} />
          </View>
          {loc ? (
            <>
              <Text style={styles.heroTitle}>Barber Sedang Menuju Lokasimu</Text>
              {loc.distance_km != null ? (
                <Text style={styles.heroDistance}>± {loc.distance_km.toFixed(1)} km lagi</Text>
              ) : (
                <Text style={styles.heroDistance}>Lokasi aktif</Text>
              )}
              <Text style={styles.heroUpdated}>
                Diperbarui {secondsAgo < 60 ? `${secondsAgo} detik` : `${Math.round(secondsAgo / 60)} menit`} lalu
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>Menunggu Lokasi Barber</Text>
              <Text style={styles.heroUpdated}>{locError}</Text>
            </>
          )}
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sec}>PROGRESS PESANAN</Text>
          <ProgressSteps
            steps={[
              { label: "Diterima", done: booking?.status === "confirmed" || booking?.status === "completed" },
              { label: "Menuju lokasi", done: !!loc || booking?.status === "completed" },
              { label: "Selesai", done: booking?.status === "completed" },
            ]}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sec}>DETAIL PESANAN</Text>
          <Row label="Toko" value={booking?.shop?.name} />
          <Row label="Barber" value={booking?.barber?.name} />
          <Row label="Layanan" value={booking?.service?.name} />
          <Row label="Alamat Tujuan" value={booking?.customer_address || "-"} />
          <Row label="Jam" value={booking?.booking_time ? `${booking.booking_time} WITA` : "-"} />
          <PressableScale
            style={styles.chatBtn}
            onPress={() => router.push(`/chat/booking/${bookingId}` as any)}
            testID="track-chat-btn"
            scaleTo={0.97}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.onBrand} />
            <Text style={styles.chatBtnText}>Chat dengan Barber</Text>
          </PressableScale>
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle" size={16} color={COLORS.info} />
          <Text style={styles.tipText}>
            Peta lokasi live tersedia di aplikasi mobile. Halaman ini otomatis diperbarui tiap beberapa detik selama barber membagikan lokasi.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value || "-"}</Text>
    </View>
  );
}

function ProgressSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <View style={styles.progressRow}>
      {steps.map((s, i) => (
        <View key={s.label} style={styles.progressStep}>
          <View style={[styles.progressDot, s.done && styles.progressDotDone]}>
            {s.done && <Ionicons name="checkmark" size={12} color={COLORS.onBrand} />}
          </View>
          <Text style={[styles.progressLabel, s.done && styles.progressLabelDone]}>{s.label}</Text>
          {i < steps.length - 1 && (
            <View style={[styles.progressLine, s.done && steps[i + 1]?.done && styles.progressLineDone]} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  backRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  backTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18 },

  hero: { padding: 24, borderRadius: 24, alignItems: "center", overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6 },
  heroDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.25)", top: -70, right: -50 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, textAlign: "center" },
  heroDistance: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 30, marginTop: 8 },
  heroUpdated: { color: "rgba(15,26,46,0.7)", fontFamily: FONT.medium, fontSize: 12, marginTop: 8, textAlign: "center" },
  progressRow: { flexDirection: "row", marginTop: 4 },
  progressStep: { flex: 1, alignItems: "center", position: "relative" },
  progressDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  progressDotDone: { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight },
  progressLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold, marginTop: 6, textAlign: "center" },
  progressLabelDone: { color: COLORS.brandLight, fontFamily: FONT.bold },
  progressLine: { position: "absolute", top: 13, left: "68%", width: "64%", height: 2, backgroundColor: COLORS.border, borderRadius: 1 },
  progressLineDone: { backgroundColor: COLORS.brand },
  chatBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.brand, padding: 14, borderRadius: 14, marginTop: 14 },
  chatBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 13 },

  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, marginTop: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  rowLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  rowValue: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13, flex: 1, textAlign: "right" },

  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", padding: 14, borderRadius: 14, marginTop: 16 },
  tipText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12, flex: 1, lineHeight: 17 },
});
