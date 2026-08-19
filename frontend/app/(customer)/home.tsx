import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api, COLORS, FONT, formatJarak, rupiah, tanggal } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

type Shop = { id: string; name: string; image: string; address: string; rating: number; reviews_count: number; price_range: string; distance_km: number | null; is_verified: boolean };
type Hairstyle = { id: string; name: string; image_url: string; description: string };

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [popularShops, setPopularShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [nearbyBarbers, setNearbyBarbers] = useState<any[]>([]);
  const [hairstyles, setHairstyles] = useState<Hairstyle[]>([]);

  const loadShops = useCallback(async (c: { lat: number; lng: number } | null) => {
    let url = `/shops?sort=terpopuler`;
    if (c) url += `&lat=${c.lat}&lng=${c.lng}`;
    const res = await api.get(url);
    setPopularShops((res.shops || []).slice(0, 8));
    try { const a = await api.get("/analytics/customer"); setAnalytics(a); } catch {}
    try { const h = await api.get("/hairstyles"); setHairstyles((h.hairstyles || []).slice(0, 8)); } catch {}
  }, []);

  const loadNearbyBarbers = useCallback(async (c: { lat: number; lng: number } | null) => {
    if (!c) { setNearbyBarbers([]); return; }
    try {
      const r = await api.get(`/barbers/nearby?lat=${c.lat}&lng=${c.lng}`);
      setNearbyBarbers(r.barbers || []);
    } catch { setNearbyBarbers([]); }
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let c: { lat: number; lng: number } | null = null;
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch { c = { lat: -10.1789, lng: 123.607 }; }
      } else {
        c = { lat: -10.1789, lng: 123.607 };
      }
      setCoords(c);
      await loadShops(c);
      await loadNearbyBarbers(c);
    } catch {} finally { setLoading(false); }
  }, [loadShops, loadNearbyBarbers]);

  useEffect(() => { init(); }, [init]);

  const onRefresh = async () => { setRefreshing(true); await loadShops(coords); await loadNearbyBarbers(coords); setRefreshing(false); };

  const rebook = () => {
    const lb = analytics?.last_booking;
    if (!lb) return;
    router.push({ pathname: `/(customer)/shop/${lb.shop_id}`, params: { rebookServiceId: lb.service_id, rebookBarberId: lb.barber_id || "" } } as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Halo, {user?.name?.split(" ")[0] || "Sobat"} 👋</Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color={COLORS.brand} />
            <Text style={styles.city} testID="city-name">Kupang · Nusa Tenggara Timur</Text>
          </View>
        </View>
        <Pressable testID="notif-btn" style={styles.iconBtn} onPress={() => router.push("/(customer)/profile")}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
      >
        <Pressable testID="search-shortcut" style={styles.searchWrap} onPress={() => router.push("/(customer)/explore" as any)}>
          <Ionicons name="search" size={18} color={COLORS.textDim} />
          <Text style={styles.searchPlaceholder}>Cari barbershop di sekitarmu...</Text>
        </Pressable>

        <Pressable testID="ai-banner" style={styles.aiBanner} onPress={() => router.push("/(customer)/ai-scan")}>
          <View style={styles.aiIconBox}>
            <Ionicons name="sparkles" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>AI Face Scan ✨</Text>
            <Text style={styles.aiSub}>Temukan gaya rambut yang cocok dengan wajahmu</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </Pressable>

        {nearbyBarbers.length > 0 && (
          <View>
            <View style={styles.nearbyHeaderRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionTitle}>Barber Online Terdekat</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {nearbyBarbers.map((b: any) => (
                <Pressable key={b.id} testID={`nearby-barber-${b.id}`} style={styles.barberCard} onPress={() => router.push(`/(customer)/shop/${b.shop_id}` as any)}>
                  <Image source={{ uri: b.photo }} style={styles.barberImg} contentFit="cover" />
                  <Text style={styles.barberName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.barberShop} numberOfLines={1}>{b.shop_name}</Text>
                  <View style={styles.barberDistRow}>
                    <Ionicons name="navigate" size={11} color={COLORS.brand} />
                    <Text style={styles.barberDist}>{formatJarak(b.distance_km)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {analytics?.active_booking ? (
          <Pressable style={styles.activeCard} onPress={() => router.push("/(customer)/orders")} testID="active-booking-card">
            <View style={styles.activeHead}>
              <Text style={styles.activeLabel}>BOOKING AKTIF</Text>
              <View style={styles.countdownPill}>
                <Ionicons name="time" size={12} color="#FFFFFF" />
                <Text style={styles.countdownText}>
                  {analytics.active_booking.days_until > 0 ? `${analytics.active_booking.days_until} hari lagi` :
                   analytics.active_booking.hours_until > 0 ? `${analytics.active_booking.hours_until} jam lagi` : "Segera"}
                </Text>
              </View>
            </View>
            <Text style={styles.activeShop} numberOfLines={1}>{analytics.active_booking.shop?.name}</Text>
            <Text style={styles.activeMeta}>{analytics.active_booking.service?.name} · {analytics.active_booking.booking_time} WITA</Text>
            <View style={styles.trackerRow}>
              {["Menunggu Bayar", "Terkonfirmasi", "Selesai"].map((step, i) => {
                const st = analytics.active_booking.status;
                const activeIdx = st === "pending" ? 0 : st === "confirmed" ? 1 : st === "completed" ? 2 : 0;
                const done = i <= activeIdx;
                return (
                  <View key={step} style={styles.trackerStep}>
                    <View style={[styles.trackerDot, done && { backgroundColor: "#FFFFFF" }]}>
                      {done && <Ionicons name="checkmark" size={10} color={COLORS.brand} />}
                    </View>
                    <Text style={[styles.trackerLabel, done && { color: "#FFFFFF", fontFamily: FONT.bold }]}>{step}</Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        ) : null}

        {analytics?.last_booking && (
          <Pressable testID="rebook-card" style={styles.rebookCard} onPress={rebook}>
            <Image source={{ uri: analytics.last_booking.shop_image }} style={styles.rebookImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rebookLabel}>PESAN ULANG</Text>
              <Text style={styles.rebookTitle} numberOfLines={1}>{analytics.last_booking.service_name}</Text>
              <Text style={styles.rebookSub} numberOfLines={1}>di {analytics.last_booking.shop_name}</Text>
            </View>
            <Ionicons name="repeat" size={20} color={COLORS.brand} />
          </Pressable>
        )}

        {hairstyles.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Inspirasi Gaya Rambut</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {hairstyles.map((h) => (
                <Pressable key={h.id} testID={`hairstyle-${h.id}`} style={styles.styleCard} onPress={() => router.push("/(customer)/ai-scan")}>
                  <Image source={{ uri: h.image_url }} style={styles.styleImg} contentFit="cover" />
                  <Text style={styles.styleName} numberOfLines={1}>{h.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.popularHeaderRow}>
          <Text style={styles.sectionTitle}>Barber Populer di Kupang</Text>
          <Pressable testID="see-all-explore" onPress={() => router.push("/(customer)/explore" as any)}>
            <Text style={styles.seeAllText}>Lihat Semua</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={COLORS.brand} style={{ marginTop: 20 }} /> : popularShops.length === 0 ? (
          <Text style={styles.empty}>Belum ada barbershop.</Text>
        ) : (
          popularShops.map((item) => (
            <Pressable key={item.id} testID={`shop-card-${item.id}`} style={[styles.card, { marginBottom: 12 }]} onPress={() => router.push(`/(customer)/shop/${item.id}` as any)}>
              <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
              {item.distance_km !== null && (
                <View style={styles.distBadge}>
                  <Ionicons name="navigate" size={11} color={COLORS.brand} />
                  <Text style={styles.distText}>{formatJarak(item.distance_km)}</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.addrRow}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textDim} />
                  <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={styles.cardRow}>
                  <View style={styles.rateBox}>
                    <Ionicons name="star" size={13} color={COLORS.warning} />
                    <Text style={styles.rateText}>{item.rating?.toFixed(1) || "0.0"}</Text>
                    <Text style={styles.rateCount}>({item.reviews_count})</Text>
                  </View>
                  <Text style={styles.price}>{item.price_range}</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  hi: { color: COLORS.textDim, fontSize: 13, fontFamily: FONT.medium },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  city: { color: COLORS.text, fontSize: 18, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  searchPlaceholder: { flex: 1, color: COLORS.textDim, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  rebookCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 12, marginTop: 16 },
  rebookImg: { width: 48, height: 48, borderRadius: 12 },
  rebookLabel: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.6 },
  rebookTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginTop: 2 },
  rebookSub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 1 },
  styleCard: { width: 100, alignItems: "center" },
  styleImg: { width: 100, height: 100, borderRadius: 14, backgroundColor: COLORS.surface2 },
  styleName: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 11, marginTop: 6, textAlign: "center" },
  popularHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  seeAllText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  aiBanner: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.brand, marginTop: 16, padding: 16, borderRadius: 16,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  aiIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  aiTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 15 },
  aiSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  chipRow: { gap: 8, alignItems: "center", paddingVertical: 4 },
  chip: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.semibold },
  chipTextActive: { color: "#FFFFFF" },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontFamily: FONT.bold, marginTop: 20, marginBottom: 8 },
  nearbyHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  barberCard: { width: 120, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 10 },
  barberImg: { width: "100%", height: 90, borderRadius: 10, backgroundColor: COLORS.surface2 },
  barberName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 12, marginTop: 8 },
  barberShop: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10, marginTop: 1 },
  barberDistRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  barberDist: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40, fontFamily: FONT.medium },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardImg: { width: "100%", height: 160 },
  distBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  distText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },
  cardBody: { padding: 14 },
  cardName: { color: COLORS.text, fontSize: 16, fontFamily: FONT.extrabold },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardAddr: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, flex: 1 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  rateBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  rateText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  rateCount: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  price: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
  activeCard: { backgroundColor: COLORS.brand, borderRadius: 16, padding: 16, marginTop: 12, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  activeHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.8 },
  countdownPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  countdownText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 11 },
  activeShop: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 18, marginTop: 8 },
  activeMeta: { color: "rgba(255,255,255,0.9)", fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  trackerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, gap: 6 },
  trackerStep: { flex: 1, alignItems: "center", gap: 4 },
  trackerDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
  trackerLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: FONT.semibold },
});
