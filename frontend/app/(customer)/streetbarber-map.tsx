import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import { api, COLORS, FONT, formatJarak } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";

// Peta StreetBarber terdekat (OpenStreetMap raster, tanpa API key — sama
// seperti layar lacak). Marker hanya untuk barber yang sedang ONLINE karena
// hanya merekalah yang punya titik lokasi live dari backend
// (GET /barbers/nearby). Radius layanan maks 9,2 km (aturan produk).
const POLL_INTERVAL = 20000;
const MAX_RADIUS_KM = 9.2;
const SHEET_MAX_HEIGHT = Math.round(Dimensions.get("window").height * 0.46);

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

export default function StreetBarberMap() {
  const router = useRouter();
  const { user } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<any>(null);

  const registeredCoords = useCallback((): { lat: number; lng: number } =>
    user?.lat != null && user?.lng != null ? { lat: user.lat, lng: user.lng } : { lat: -10.1789, lng: 123.607 },
  [user?.lat, user?.lng]);

  const loadNearby = useCallback(async (c: { lat: number; lng: number } | null) => {
    if (!c) { setBarbers([]); return; }
    try {
      const r = await api.get(`/barbers/nearby?lat=${c.lat}&lng=${c.lng}`);
      setBarbers(r.barbers || []);
    } catch { setBarbers([]); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let c: { lat: number; lng: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          } catch { c = registeredCoords(); }
        } else {
          c = registeredCoords();
        }
      } catch { c = registeredCoords(); }
      if (cancelled) return;
      setCoords(c);
      await loadNearby(c);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadNearby, registeredCoords]);

  useEffect(() => {
    if (!coords) return;
    pollRef.current = setInterval(() => loadNearby(coords), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [coords, loadNearby]);

  const customerCoord: [number, number] | null = coords ? [coords.lng, coords.lat] : null;

  const bounds = useMemo<[number, number, number, number] | null>(() => {
    const pts: [number, number][] = [];
    if (customerCoord) pts.push(customerCoord);
    for (const b of barbers) {
      if (b.lng != null && b.lat != null) pts.push([b.lng, b.lat]);
    }
    if (pts.length === 0) return null;
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const pad = 0.01;
    return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
  }, [customerCoord, barbers]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
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
            {barbers.map((b: any) => (
              b.lng != null && b.lat != null ? (
                <Marker key={b.id} id={`barber-${b.id}`} lngLat={[b.lng, b.lat]}>
                  <View style={styles.pinBarber}>
                    <Ionicons name="cut" size={16} color={COLORS.onBrand} />
                  </View>
                </Marker>
              ) : null
            ))}
          </Map>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={36} color={COLORS.textDim} />
            <Text style={styles.mapFallbackText}>Menunggu titik lokasi di peta...</Text>
          </View>
        )}
      </View>

      <SafeAreaView edges={["top"]} style={styles.topSafe} pointerEvents="box-none">
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.topBack} testID="map-back" scaleTo={0.9}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </PressableScale>
          <View style={styles.topTextWrap}>
            <Text style={styles.topTitle} numberOfLines={1}>StreetBarber Terdekat</Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>Maksimal {MAX_RADIUS_KM} km darimu</Text>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Sedang online di sekitarmu</Text>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{barbers.length}</Text>
              </View>
            </View>
            {barbers.length === 0 ? (
              <EmptyState
                icon="bicycle-outline"
                title="Belum ada yang online"
                description={`Tidak ada StreetBarber dalam radius ${MAX_RADIUS_KM} km saat ini. Coba lagi nanti atau jelajahi barbershop.`}
                actionLabel="Jelajah Barbershop"
                onAction={() => router.push("/(customer)/explore" as any)}
              />
            ) : (
              barbers.map((b: any) => (
                <PressableScale
                  key={b.id}
                  testID={`map-barber-${b.id}`}
                  style={styles.row}
                  onPress={() => router.push(`/(customer)/barber/${b.id}` as any)}
                  scaleTo={0.98}
                >
                  {b.photo ? (
                    <Image source={{ uri: b.photo }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{(b.name || "?")[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
                    <Text style={styles.shop} numberOfLines={1}>{b.shop_name}</Text>
                    <Text style={styles.dist} numberOfLines={1}>
                      {formatJarak(b.distance_km)}{b.eta_minutes != null ? ` · ~${b.eta_minutes} mnt` : ""}
                    </Text>
                  </View>
                  <View style={styles.callPill}>
                    <Text style={styles.callPillText}>Panggil</Text>
                  </View>
                </PressableScale>
              ))
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
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
    paddingTop: 12, paddingHorizontal: 20,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 1, shadowRadius: 22, elevation: 10,
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginBottom: 12 },
  sheetContent: { paddingBottom: 20 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sheetTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  countPill: { backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  countText: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 13 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 12, marginBottom: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.surface2 },
  avatarFallback: { backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 20 },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  shop: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  dist: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12, marginTop: 3 },
  callPill: { backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  callPillText: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 12 },
});
