import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import Donut from "@/src/components/Donut";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/analytics/owner");
      setData(r);
      const t = await api.get("/chat/threads").catch(() => ({ threads: [] }));
      setUnread((t.threads || []).reduce((a: number, x: any) => a + (x.unread || 0), 0));
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  if (!data?.shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.navyHeader}><Text style={styles.headerTitle}>Owner Panel</Text><Text style={styles.headerSub}>Belum ada toko</Text></View>
        <View style={styles.emptyState}>
          <Ionicons name="storefront-outline" size={48} color={COLORS.brand} />
          <Text style={styles.emptyTitle}>Daftarkan toko dulu</Text>
          <Text style={styles.emptyText}>Klik menu Kelola untuk mendaftarkan toko Anda.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shop = data.shop;
  const growth = data.growth_pct;
  const isUp = growth >= 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerHi}>Halo, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
        </View>
        <Pressable style={styles.hIconBtn} onPress={() => router.push(`/chat/${shop.id}` as any)}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          {unread > 0 && <View style={styles.hBadge}><Text style={styles.hBadgeText}>{unread}</Text></View>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {/* Total Booking */}
        <View style={styles.bigCard}>
          <View style={styles.bigIcon}><Ionicons name="receipt" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigLabel}>Total Booking Bulan Ini</Text>
            <Text style={styles.bigValue}>{data.total_bookings_month.toLocaleString("id-ID")}</Text>
            <View style={styles.trendRow}>
              <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={14} color={isUp ? "#00FFB0" : "#FFB4B4"} />
              <Text style={[styles.trendText, { color: isUp ? "#00FFB0" : "#FFB4B4" }]}>{Math.abs(growth)}% dari minggu lalu</Text>
            </View>
          </View>
        </View>

        {/* Today + Fill */}
        <View style={styles.row2}>
          <View style={styles.miniCard}>
            <Ionicons name="calendar" size={18} color={COLORS.brand} />
            <Text style={styles.miniLabel}>Jadwal Hari Ini</Text>
            <Text style={styles.miniValue}>{data.today_appointments}</Text>
            <View style={styles.miniBar}><View style={[styles.miniFill, { width: `${data.today_fill_pct}%` }]} /></View>
            <Text style={styles.miniHint}>{data.today_fill_pct}% slot terisi</Text>
          </View>
          <View style={styles.miniCard}>
            <Ionicons name="star" size={18} color={COLORS.warning} />
            <Text style={styles.miniLabel}>Rating Toko</Text>
            <Text style={styles.miniValue}>{shop.rating?.toFixed(1) || "0.0"}</Text>
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
            <Ionicons name="people" size={22} color={COLORS.success} />
          </View>
          <View style={styles.hBar}><View style={[styles.hFill, { width: `${data.retention_pct}%`, backgroundColor: COLORS.success }]} /></View>
          <Text style={styles.metricHint}>Pelanggan kembali booking dalam 90 hari</Text>

          <View style={[styles.metricRow, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Productivity 90 Hari</Text>
              <Text style={styles.metricValue}>{data.productivity_pct}%</Text>
            </View>
            <Ionicons name="trending-up" size={22} color={COLORS.brand} />
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
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  hIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hBadge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.sidebar },
  hBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  headerHi: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  emptyState: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18 },
  emptyText: { color: COLORS.textDim, fontFamily: FONT.medium, textAlign: "center" },
  bigCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: COLORS.brand, padding: 18, borderRadius: 20, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6, marginTop: 4 },
  bigIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  bigLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  bigValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 28, marginTop: 4 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  trendText: { fontFamily: FONT.bold, fontSize: 11 },
  row2: { flexDirection: "row", gap: 12, marginTop: 12 },
  miniCard: { flex: 1, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  miniLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold, marginTop: 8 },
  miniValue: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginTop: 2 },
  miniBar: { height: 6, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 10, overflow: "hidden" },
  miniFill: { height: "100%", backgroundColor: COLORS.brand, borderRadius: 999 },
  miniHint: { color: COLORS.textDim, fontSize: 10, marginTop: 4, fontFamily: FONT.medium },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 8 },
  metricRow: { flexDirection: "row", alignItems: "center" },
  metricLabel: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  metricValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 22, marginTop: 2 },
  hBar: { height: 8, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 8, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 999 },
  metricHint: { color: COLORS.textDim, fontSize: 11, marginTop: 6, fontFamily: FONT.medium },
});
