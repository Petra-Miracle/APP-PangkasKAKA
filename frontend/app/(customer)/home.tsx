import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api, COLORS, FONT, formatJarak, rupiah, tanggal } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonShopCard, SkeletonRow } from "@/src/components/Skeleton";

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

  // Kalau GPS live gagal/ditolak, pakai koordinat alamat yang didaftarkan user
  // (diisi saat registrasi) sebelum jatuh ke titik default Kupang — supaya
  // "toko terdekat" tetap terasa personal walau izin lokasi tidak diberikan.
  const registeredCoords = (): { lat: number; lng: number } =>
    user?.lat != null && user?.lng != null ? { lat: user.lat, lng: user.lng } : { lat: -10.1789, lng: 123.607 };

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let c: { lat: number; lng: number } | null = null;
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch { c = registeredCoords(); }
      } else {
        c = registeredCoords();
      }
      setCoords(c);
      await loadShops(c);
      await loadNearbyBarbers(c);
    } catch {} finally { setLoading(false); }
  }, [loadShops, loadNearbyBarbers, user?.lat, user?.lng]);

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
        <PressableScale testID="notif-btn" style={styles.iconBtn} onPress={() => router.push("/(customer)/profile")}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
      >
        <PressableScale testID="search-shortcut" style={styles.searchWrap} onPress={() => router.push("/(customer)/explore" as any)}>
          <Ionicons name="search" size={18} color={COLORS.textDim} />
          <Text style={styles.searchPlaceholder}>Cari barbershop di sekitarmu...</Text>
          <View style={styles.searchChip}>
            <Ionicons name="options-outline" size={14} color={COLORS.brand} />
          </View>
        </PressableScale>

        <PressableScale testID="ai-banner" style={styles.aiBanner} onPress={() => router.push("/(customer)/ai-scan")} haptic>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiGradient}
          >
            <View pointerEvents="none" style={styles.aiDeco} />
            <View style={styles.aiIconBox}>
              <Ionicons name="sparkles" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiTitle}>AI Face Scan ✨</Text>
              <Text style={styles.aiSub}>Temukan gaya rambut yang cocok dengan wajahmu</Text>
            </View>
            <View style={styles.aiChevron}>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </PressableScale>

        {nearbyBarbers.length > 0 && (
          <View>
            <View style={styles.nearbyHeaderRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionTitle}>StreetBarber Online Terdekat</Text>
              <View style={styles.livePill}>
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
              {nearbyBarbers.map((b: any) => (
                <PressableScale key={b.id} testID={`nearby-barber-${b.id}`} style={styles.barberCard} onPress={() => router.push({ pathname: `/(customer)/shop/${b.shop_id}`, params: { presetBarberId: b.id } } as any)} scaleTo={0.95}>
                  <Image source={{ uri: b.photo }} style={styles.barberImg} contentFit="cover" />
                  <View style={styles.onlineDot} />
                  <Text style={styles.barberName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.barberShop} numberOfLines={1}>{b.shop_name}</Text>
                  <View style={styles.barberDistRow}>
                    <Ionicons name="navigate" size={11} color={COLORS.brand} />
                    <Text style={styles.barberDist}>{formatJarak(b.distance_km)}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        )}

        {analytics?.active_booking ? (
          <PressableScale style={styles.activeCard} onPress={() => router.push("/(customer)/orders")} testID="active-booking-card" haptic>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeGradient}
            >
              <View pointerEvents="none" style={styles.activeDeco} />
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
            </LinearGradient>
          </PressableScale>
        ) : null}

        {analytics?.last_booking && (
          <PressableScale testID="rebook-card" style={styles.rebookCard} onPress={rebook} scaleTo={0.98}>
            <Image source={{ uri: analytics.last_booking.shop_image }} style={styles.rebookImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rebookLabel}>PESAN ULANG</Text>
              <Text style={styles.rebookTitle} numberOfLines={1}>{analytics.last_booking.service_name}</Text>
              <Text style={styles.rebookSub} numberOfLines={1}>di {analytics.last_booking.shop_name}</Text>
            </View>
            <View style={styles.rebookIcon}>
              <Ionicons name="repeat" size={18} color={COLORS.brand} />
            </View>
          </PressableScale>
        )}

        {hairstyles.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Inspirasi Gaya Rambut</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {hairstyles.map((h) => (
                <PressableScale key={h.id} testID={`hairstyle-${h.id}`} style={styles.styleCard} onPress={() => router.push("/(customer)/ai-scan")} scaleTo={0.94}>
                  <Image source={{ uri: h.image_url }} style={styles.styleImg} contentFit="cover" />
                  <View style={styles.styleImgOverlay} />
                  <Text style={styles.styleName} numberOfLines={1}>{h.name}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.popularHeaderRow}>
          <Text style={styles.sectionTitle}>Barber Populer di Kupang</Text>
          <PressableScale testID="see-all-explore" onPress={() => router.push("/(customer)/explore" as any)}>
            <View style={styles.seeAllPill}>
              <Text style={styles.seeAllText}>Lihat Semua</Text>
              <Ionicons name="arrow-forward" size={12} color={COLORS.brand} />
            </View>
          </PressableScale>
        </View>
        {loading ? (
          <View style={{ marginTop: 4 }}>
            <SkeletonShopCard />
            <SkeletonShopCard />
            <SkeletonRow />
          </View>
        ) : popularShops.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            title="Belum ada barbershop"
            description="Toko baru akan muncul di sini begitu terverifikasi."
            actionLabel="Muat Ulang"
            onAction={() => init()}
          />
        ) : (
          popularShops.map((item) => (
            <PressableScale key={item.id} testID={`shop-card-${item.id}`} style={[styles.card, { marginBottom: 14 }]} onPress={() => router.push(`/(customer)/shop/${item.id}` as any)} scaleTo={0.97}>
              <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
              {item.distance_km !== null && (
                <View style={styles.distBadge}>
                  <Ionicons name="navigate" size={11} color={COLORS.brand} />
                  <Text style={styles.distText}>{formatJarak(item.distance_km)}</Text>
                </View>
              )}
              <LinearGradient
                colors={["rgba(10,37,64,0)", "rgba(10,37,64,0.55)"]}
                style={styles.cardScrim}
                pointerEvents="none"
              />
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  {item.rating > 0 && (
                    <View style={styles.ratePill}>
                      <Ionicons name="star" size={11} color={COLORS.gold} />
                      <Text style={styles.rateText}>{item.rating?.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.addrRow}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textDim} />
                  <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.price}>{item.price_range}</Text>
                  <Text style={styles.rateCount}>({item.reviews_count} ulasan)</Text>
                </View>
              </View>
            </PressableScale>
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
  iconBtn: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16,
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  searchPlaceholder: { flex: 1, color: COLORS.textDim, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  searchChip: { width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  rebookCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 12, marginTop: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  rebookImg: { width: 50, height: 50, borderRadius: 14 },
  rebookLabel: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.6 },
  rebookTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginTop: 2 },
  rebookSub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 1 },
  rebookIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  styleCard: { width: 112, alignItems: "center" },
  styleImg: { width: 112, height: 128, borderRadius: 18, backgroundColor: COLORS.surface2 },
  styleImgOverlay: { position: "absolute", bottom: 26, left: 0, right: 0, height: 40, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: "rgba(10,37,64,0.35)" },
  styleName: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 11, marginTop: 6, textAlign: "center" },
  popularHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  seeAllPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  seeAllText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  aiBanner: { marginTop: 16, borderRadius: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  aiGradient: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, overflow: "hidden" },
  aiDeco: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -40 },
  aiIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  aiTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 15 },
  aiSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  aiChevron: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontFamily: FONT.bold, marginTop: 20, marginBottom: 8 },
  nearbyHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  livePill: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  livePillText: { color: COLORS.success, fontSize: 9, fontFamily: FONT.bold, letterSpacing: 0.6 },
  barberCard: {
    width: 124, backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, padding: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  barberImg: { width: "100%", height: 92, borderRadius: 12, backgroundColor: COLORS.surface2 },
  onlineDot: { position: "absolute", top: 16, right: 16, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, borderWidth: 2, borderColor: "#FFFFFF" },
  barberName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 12, marginTop: 8 },
  barberShop: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10, marginTop: 1 },
  barberDistRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  barberDist: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4,
  },
  cardImg: { width: "100%", height: 170 },
  cardScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80 },
  distBadge: {
    position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  distText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },
  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardName: { color: COLORS.text, fontSize: 16, fontFamily: FONT.extrabold, flex: 1 },
  ratePill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFF9EC", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rateText: { color: "#B45309", fontFamily: FONT.bold, fontSize: 11 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardAddr: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, flex: 1 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  rateCount: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  price: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
  activeCard: { borderRadius: 20, marginTop: 12, overflow: "hidden", shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  activeGradient: { padding: 18, overflow: "hidden" },
  activeDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.07)", top: -70, right: -50 },
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