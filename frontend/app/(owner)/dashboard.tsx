import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import Donut from "@/src/components/Donut";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [togglingOpen, setTogglingOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/analytics/owner");
      setData(r);
      if (r.shop) setIsOpen(r.shop.is_open !== false);
      const t = await api.get("/chat/threads").catch(() => ({ threads: [] }));
      setUnread((t.threads || []).reduce((a: number, x: any) => a + (x.unread || 0), 0));
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleOpen = async (val: boolean) => {
    setIsOpen(val); // optimistic
    setTogglingOpen(true);
    try {
      await api.put("/owner/shop/open-status", { is_open: val });
    } catch (e: any) {
      setIsOpen(!val); // revert on failure
      alert(e.message || "Gagal mengubah status toko");
    }
    setTogglingOpen(false);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 14, width: 90, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 22, width: 160, marginTop: 8, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 76 }} />
        <Skeleton style={{ height: 96 }} />
        <Skeleton style={{ height: 96 }} />
      </View>
    </SafeAreaView>
  );

  if (!data?.shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
          <Text style={styles.headerTitle}>Owner Panel</Text>
          <Text style={styles.headerSub}>Belum ada toko</Text>
        </LinearGradient>
        <EmptyState
          icon="storefront-outline"
          title="Daftarkan toko dulu"
          description="Klik menu Kelola untuk mendaftarkan toko Anda."
          actionLabel="Kelola Toko"
          onAction={() => router.push("/(owner)/manage" as any)}
        />
      </SafeAreaView>
    );
  }

  const shop = data.shop;
  const growth = data.growth_pct;
  const isUp = growth >= 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerHi}>Halo, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
        </View>
        <PressableScale style={styles.hIconBtn} onPress={() => router.push(`/chat/${shop.id}` as any)} scaleTo={0.9} haptic>
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          {unread > 0 && <View style={styles.hBadge}><Text style={styles.hBadgeText}>{unread}</Text></View>}
        </PressableScale>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        {/* Open/closed toggle + schedule shortcut */}
        <View style={styles.statusCard}>
          <View style={styles.statusDotWrap}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? COLORS.success : COLORS.error }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>{isOpen ? "Toko Sedang Buka" : "Toko Tutup Sementara"}</Text>
            <Text style={styles.statusHint}>Nonaktifkan kalau tutup mendadak, di luar jadwal rutin</Text>
          </View>
          <Switch
            value={isOpen}
            onValueChange={toggleOpen}
            disabled={togglingOpen}
            trackColor={{ false: COLORS.border, true: COLORS.brandDim }}
            thumbColor={isOpen ? COLORS.brand : COLORS.textDim}
            testID="toggle-shop-open"
          />
        </View>
        <PressableScale style={styles.scheduleBtn} onPress={() => router.push("/(owner)/schedule" as any)} testID="goto-schedule" scaleTo={0.97}>
          <View style={styles.scheduleIcon}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.brand} />
          </View>
          <Text style={styles.scheduleBtnText}>Atur Jadwal Buka Toko</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
        </PressableScale>

        {/* Pendapatan */}
        <LinearGradient
          colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bigCard}
        >
          <View pointerEvents="none" style={styles.bigDeco} />
          <View style={styles.bigIcon}><Ionicons name="cash" size={22} color={COLORS.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigLabel}>Pendapatan Bulan Ini</Text>
            <Text style={styles.bigValue}>{rupiah(data.monthly_revenue || 0)}</Text>
            <Text style={styles.trendTextDim}>Dari booking yang sudah dibayar</Text>
          </View>
        </LinearGradient>

        {/* Total Booking */}
        <LinearGradient
          colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bigCard}
        >
          <View pointerEvents="none" style={styles.bigDeco} />
          <View style={styles.bigIcon}><Ionicons name="receipt" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigLabel}>Total Booking Bulan Ini</Text>
            <Text style={styles.bigValue}>{data.total_bookings_month.toLocaleString("id-ID")}</Text>
            <View style={styles.trendRow}>
              <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={14} color={isUp ? "#00FFB0" : "#FFB4B4"} />
              <Text style={[styles.trendText, { color: isUp ? "#00FFB0" : "#FFB4B4" }]}>{Math.abs(growth)}% dari minggu lalu</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Today + Fill */}
        <View style={styles.row2}>
          <View style={styles.miniCard}>
            <View style={styles.miniIcon}><Ionicons name="calendar" size={18} color={COLORS.brand} /></View>
            <Text style={styles.miniLabel}>Jadwal Hari Ini</Text>
            <Text style={styles.miniValue}>{data.today_appointments}</Text>
            <View style={styles.miniBar}><View style={[styles.miniFill, { width: `${data.today_fill_pct}%` }]} /></View>
            <Text style={styles.miniHint}>{data.today_fill_pct}% slot terisi</Text>
          </View>
          <View style={styles.miniCard}>
            <View style={[styles.miniIcon, { backgroundColor: "#FFF7ED" }]}><Ionicons name="star" size={18} color={COLORS.warning} /></View>
            <Text style={styles.miniLabel}>Rating Toko</Text>
            <Text style={styles.miniValue}>{shop.rating?.toFixed(1) || "0.0"}</Text>
            <View style={styles.miniBar}><View style={[styles.miniFill, { width: `${Math.min(100, (shop.rating || 0) * 20)}%`, backgroundColor: COLORS.warning }]} /></View>
            <Text style={styles.miniHint}>{shop.reviews_count || 0} ulasan</Text>
          </View>
        </View>

        {/* Retention + Productivity */}
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Retention 90 Hari</Text>
              <Text style={styles.metricValue}>{data.retention_pct}%</Text>
            </View>
            <View style={styles.metricIcon}><Ionicons name="people" size={22} color={COLORS.success} /></View>
          </View>
          <View style={styles.hBar}><View style={[styles.hFill, { width: `${data.retention_pct}%`, backgroundColor: COLORS.success }]} /></View>
          <Text style={styles.metricHint}>Pelanggan kembali booking dalam 90 hari</Text>

          <View style={[styles.metricRow, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Productivity 90 Hari</Text>
              <Text style={styles.metricValue}>{data.productivity_pct}%</Text>
            </View>
            <View style={styles.metricIcon}><Ionicons name="trending-up" size={22} color={COLORS.brand} /></View>
          </View>
          <View style={styles.hBar}><View style={[styles.hFill, { width: `${data.productivity_pct}%`, backgroundColor: COLORS.brand }]} /></View>
          <Text style={styles.metricHint}>Rasio slot terisi vs slot tersedia</Text>
        </View>

        {/* Donut */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Layanan Terpopuler</Text>
          <View style={{ marginTop: 8 }}>
            <Donut data={data.popular_services} centerLabel="Booking" centerValue={data.popular_services.reduce((a: number, b: any) => a + b.count, 0)} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -70, right: -40 },
  hIconBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  hBadge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.sidebar },
  hBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  headerHi: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  statusDotWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  statusDot: { width: 12, height: 12, borderRadius: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4 },
  statusLabel: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  statusHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 4 },
  scheduleBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  scheduleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  scheduleBtnText: { flex: 1, color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  bigCard: {
    flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 22, marginTop: 12, overflow: "hidden",
    shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 22, elevation: 8,
  },
  bigDeco: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30 },
  bigIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  bigLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  bigValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 28, marginTop: 4, letterSpacing: -0.5 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  trendText: { fontFamily: FONT.bold, fontSize: 11 },
  trendTextDim: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.medium, fontSize: 11, marginTop: 4 },
  row2: { flexDirection: "row", gap: 12, marginTop: 12 },
  miniCard: {
    flex: 1, backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  miniIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  miniLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold, marginTop: 10 },
  miniValue: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginTop: 2 },
  miniBar: { height: 6, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 10, overflow: "hidden" },
  miniFill: { height: "100%", backgroundColor: COLORS.brand, borderRadius: 999 },
  miniHint: { color: COLORS.textDim, fontSize: 10, marginTop: 4, fontFamily: FONT.medium },
  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 8 },
  metricRow: { flexDirection: "row", alignItems: "center" },
  metricIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  metricLabel: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  metricValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 22, marginTop: 2 },
  hBar: { height: 8, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 8, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 999 },
  metricHint: { color: COLORS.textDim, fontSize: 11, marginTop: 6, fontFamily: FONT.medium },
});