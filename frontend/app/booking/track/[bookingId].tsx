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
                  <Ionicons name="cut" size={16} color="#FFFFFF" />
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
                <Ionicons name="bicycle" size={22} color="#FFFFFF" />
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

            <View style={styles.divider} />

            <Row label="Toko" value={booking?.shop?.name} />
            <Row label="Barber" value={booking?.barber?.name} />
            <Row label="Layanan" value={booking?.service?.name} />
            <Row label="Alamat Tujuan" value={booking?.customer_address || "-"} />
            <Row label="Jam" value={booking?.booking_time ? `${booking.booking_time} WITA` : "-"} />

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface, gap: 8 },
  mapFallbackText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },

  pinCustomer: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.sidebar, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  pinBarber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },

  topSafe: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.surface, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 5,
  },
  topBack: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  topTextWrap: { flex: 1 },
  topTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  topSubtitle: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },

  bottomSafe: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT, backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingHorizontal: 20,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 8,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: 12 },
  sheetContent: { paddingBottom: 18 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusIcon: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
  },
  statusTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  statusDistance: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 20, marginTop: 2 },
  statusSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  rowLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  rowValue: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13, flex: 1, textAlign: "right" },

  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", padding: 14, borderRadius: 14, marginTop: 14 },
  tipText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12, flex: 1, lineHeight: 17 },
});
