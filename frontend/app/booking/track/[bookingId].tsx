import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

const POLL_INTERVAL = 8000; // 8 detik, selaras dengan interval push lokasi karyawan
const SHEET_MAX_HEIGHT = Math.round(Dimensions.get("window").height * 0.46);

type LocationResp = { lat: number; lng: number; updated_at: string; distance_km?: number };

// Raster tile OSM gratis, tanpa API key. Sesuai kebijakan pemakaian OSM, atribusi
// wajib ditampilkan — lihat komponen Map (attribution) dan caption di bawah peta.
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export default function TrackBarberScreen() {
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
  const updatedLabel = secondsAgo < 60 ? `${secondsAgo} detik` : `${Math.round(secondsAgo / 60)} menit`;

  const customerCoord: [number, number] | null =
    booking?.customer_lat != null && booking?.customer_lng != null
      ? [booking.customer_lng, booking.customer_lat]
      : null;
  const barberCoord: [number, number] | null = loc ? [loc.lng, loc.lat] : null;

  const bounds = useMemo<[number, number, number, number] | null>(() => {
    if (!customerCoord && !barberCoord) return null;
    const pts = [customerCoord, barberCoord].filter(Boolean) as [number, number][];
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const pad = 0.006; // sedikit ruang di tepi peta
    return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
  }, [customerCoord, barberCoord]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      {/* Peta layar penuh sebagai background — overlay atas/bawah mengambang di atasnya */}
      <View style={StyleSheet.absoluteFillObject}>
        {bounds ? (
          <Map mapStyle={OSM_STYLE} style={{ flex: 1 }} attribution logo={false} compass={false} scaleBar={false}>
            <Camera
              initialViewState={{
                bounds,
                padding: { top: 130, bottom: SHEET_MAX_HEIGHT + 30, left: 40, right: 40 },
              }}
            />
            {customerCoord && (
              <Marker id="customer" lngLat={customerCoord}>
                <View style={styles.pinCustomer}>
                  <Ionicons name="home" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            )}
            {barberCoord && (
              <Marker id="barber" lngLat={barberCoord}>
                <View style={styles.pinBarber}>
                  <Ionicons name="cut" size={16} color={COLORS.onBrand} />
                </View>
              </Marker>
            )}
          </Map>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={36} color={COLORS.textDim} />
            <Text style={styles.mapFallbackText}>Menunggu titik lokasi di peta...</Text>
          </View>
        )}
      </View>

      {/* Bar mengambang di atas peta */}
      <SafeAreaView edges={["top"]} style={styles.topSafe} pointerEvents="box-none">
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.topBack} scaleTo={0.9}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </PressableScale>
          <View style={styles.topTextWrap}>
            <Text style={styles.topTitle} numberOfLines={1}>Melacak Barber</Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>
              {loc ? `Diperbarui ${updatedLabel} lalu` : "Menunggu lokasi..."}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Kartu mengambang di bawah peta */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              <View style={styles.statusIcon}>
                <Ionicons name="bicycle" size={22} color={COLORS.onBrand} />
              </View>
              <View style={{ flex: 1 }}>
                {loc ? (
                  <>
                    <Text style={styles.statusTitle}>Barber Sedang Menuju Lokasimu</Text>
                    <Text style={styles.statusDistance}>
                      {loc.distance_km != null ? `± ${loc.distance_km.toFixed(1)} km lagi` : "Lokasi aktif"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.statusTitle}>Menunggu Lokasi Barber</Text>
                    <Text style={styles.statusSub}>{locError}</Text>
                  </>
                )}
              </View>
            </View>

            {/* Progress (§11): dipetakan ke status booking ASLI — backend hanya punya
                pending/confirmed/completed, tanpa sub-status "dicukur", jadi 3 tahap ini
                yang jujur: Diterima (confirmed+), Menuju lokasi (lokasi aktif), Selesai. */}
            <ProgressSteps
              steps={[
                { label: "Diterima", done: booking?.status === "confirmed" || booking?.status === "completed" },
                { label: "Menuju lokasi", done: !!loc || booking?.status === "completed" },
                { label: "Selesai", done: booking?.status === "completed" },
              ]}
            />

            <View style={styles.divider} />

            <Row label="StreetBarber" value={booking?.barber?.name} />
            <Row label="Divalidasi oleh" value={booking?.shop?.name} />
            <Row label="Layanan" value={booking?.service?.name} />
            <Row label="Alamat Tujuan" value={booking?.customer_address || "-"} />
            <Row label="Jam" value={booking?.booking_time ? `${booking.booking_time} WITA` : "-"} />

            <View style={styles.barberRow}>
              <View style={styles.barberAvatar}>
                <Ionicons name="cut" size={18} color={COLORS.brandLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.barberRowName} numberOfLines={1}>{booking?.barber?.name || "Barber"}</Text>
                <Text style={styles.barberRowSub} numberOfLines={1}>{booking?.shop?.name || ""}</Text>
              </View>
              <PressableScale
                style={styles.chatBtn}
                onPress={() => router.push(`/chat/booking/${bookingId}` as any)}
                testID="track-chat-btn"
                scaleTo={0.94}
              >
                <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.onBrand} />
                <Text style={styles.chatBtnText}>Chat</Text>
              </PressableScale>
            </View>

            <View style={styles.tipBox}>
              <Ionicons name="information-circle" size={14} color={COLORS.info} />
              <Text style={styles.tipText}>
                Diperbarui otomatis tiap beberapa detik selama barber membagikan lokasi. Kalau lokasi tidak muncul,
                barber sedang tidak aktif membagikan lokasi — booking kamu tetap aman.
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
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

  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface, gap: 10 },
  mapFallbackText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },

  pinCustomer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.sidebar, alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
  pinBarber: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },

  topSafe: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.surface, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 7,
  },
  topBack: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  topTextWrap: { flex: 1 },
  topTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  topSubtitle: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },

  bottomSafe: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT, backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 12, paddingHorizontal: 22,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 1, shadowRadius: 22, elevation: 10,
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginBottom: 14 },
  sheetContent: { paddingBottom: 20 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  statusIcon: {
    width: 50, height: 50, borderRadius: 18, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  statusTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  statusDistance: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 22, marginTop: 2 },
  progressRow: { flexDirection: "row", marginTop: 18 },
  progressStep: { flex: 1, alignItems: "center", position: "relative" },
  progressDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surface2,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center",
  },
  progressDotDone: { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight },
  progressLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold, marginTop: 6, textAlign: "center" },
  progressLabelDone: { color: COLORS.brandLight, fontFamily: FONT.bold },
  progressLine: { position: "absolute", top: 13, left: "68%", width: "64%", height: 2, backgroundColor: COLORS.border, borderRadius: 1 },
  progressLineDone: { backgroundColor: COLORS.brand },
  barberRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand, borderRadius: 16, padding: 12 },
  barberAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  barberRowName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  barberRowSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  chatBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  chatBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 12 },
  statusSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, gap: 12 },
  rowLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  rowValue: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13, flex: 1, textAlign: "right" },

  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", padding: 16, borderRadius: 16, marginTop: 16 },
  tipText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12, flex: 1, lineHeight: 18 },
});
