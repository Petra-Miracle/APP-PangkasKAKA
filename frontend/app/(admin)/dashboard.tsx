import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import Donut from "@/src/components/Donut";
import Skeleton from "@/src/components/Skeleton";

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/analytics/admin"); setD(r); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !d) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 12, width: 110, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 24, width: 200, marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 90 }} />
        <Skeleton style={{ height: 96 }} />
        <Skeleton style={{ height: 140 }} />
      </View>
    </SafeAreaView>
  );
  const k = d.kpi;
  const custUp = k.customer_growth_pct >= 0;
  const revUp = k.revenue_growth_pct >= 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <View style={styles.badge}><Ionicons name="shield-checkmark" size={12} color={COLORS.gold} /><Text style={styles.badgeText}>ADMIN CONSOLE</Text></View>
        <Text style={styles.headerTitle}>Command Center</Text>
        <Text style={styles.headerSub}>PangkasKAKA · Kupang NTT</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        {/* 4 KPI */}
        <View style={styles.grid}>
          <Kpi icon="storefront" label="Total Barbershop" value={k.total_shops} trend={`+${k.new_shops_month} baru`} up />
          <Kpi icon="hourglass" label="Menunggu Verifikasi" value={k.pending} amber />
          <Kpi icon="people" label="Total Pelanggan" value={k.total_customers.toLocaleString("id-ID")} trend={`${custUp ? "+" : ""}${k.customer_growth_pct}% mingguan`} up={custUp} />
        </View>

        <LinearGradient
          colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bigCard, { marginTop: 12 }]}
        >
          <View pointerEvents="none" style={styles.bigDeco} />
          <View style={styles.bigIcon}><Ionicons name="cash" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigLabel}>Transaksi Hari Ini</Text>
            <Text style={styles.bigValue}>{rupiah(k.revenue_today)}</Text>
            <View style={styles.trendRow}>
              <Ionicons name={revUp ? "arrow-up" : "arrow-down"} size={14} color={revUp ? "#00FFB0" : "#FFB4B4"} />
              <Text style={[styles.trendText, { color: revUp ? "#00FFB0" : "#FFB4B4" }]}>{Math.abs(k.revenue_growth_pct)}% dari kemarin</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Health */}
        <View style={styles.card}>
          <View style={styles.rowB}>
            <Text style={styles.cardTitle}>Kesehatan Platform</Text>
            <View style={styles.rateChip}>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.rateChipText}>{d.health.avg_rating.toFixed(2)}</Text>
              <Text style={styles.rateChipSub}>rata-rata</Text>
            </View>
          </View>
          {d.health.warning_shops.length > 0 ? (
            <View>
              <View style={styles.warnHead}>
                <View style={styles.warnIcon}><Ionicons name="warning" size={14} color={COLORS.error} /></View>
                <Text style={styles.warnHeadText}>Toko dengan penurunan rating drastis:</Text>
              </View>
              {d.health.warning_shops.map((s: any) => (
                <View key={s.id} style={styles.warnItem}>
                  <Text style={styles.warnName}>{s.name}</Text>
                  <Text style={styles.warnDrop}>-{s.drop} · {s.current.toFixed(1)}★</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.okRow}>
              <View style={styles.okIcon}><Ionicons name="checkmark" size={14} color={COLORS.success} /></View>
              <Text style={styles.emptyMsg}>Tidak ada penurunan rating drastis</Text>
            </View>
          )}
        </View>

        {/* Distribution */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distribusi Toko per Kecamatan</Text>
          <View style={{ marginTop: 8 }}>
            <Donut data={d.distribution} centerLabel="Toko" centerValue={d.distribution.reduce((a: number, b: any) => a + b.count, 0)} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ icon, label, value, trend, up, amber }: any) {
  return (
    <View style={[styles.kpi, amber && { borderColor: COLORS.warning, backgroundColor: "#FFF7ED" }]}>
      <View style={[styles.kpiIcon, amber && { backgroundColor: COLORS.warning }]}>
        <Ionicons name={icon} size={14} color={amber ? "#FFFFFF" : COLORS.brand} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, amber && { color: COLORS.warning }]}>{value}</Text>
      {trend && (
        <View style={styles.trendRow2}>
          <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={up ? COLORS.success : COLORS.error} />
          <Text style={[styles.trendText2, { color: up ? COLORS.success : COLORS.error }]}>{trend}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)", top: -75, right: -45 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontFamily: FONT.extrabold, marginTop: 8, letterSpacing: -0.3 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    width: "31.5%", padding: 12, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  kpiIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  kpiLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold },
  kpiValue: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, marginTop: 2 },
  trendRow2: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  trendText2: { fontFamily: FONT.bold, fontSize: 9 },
  bigCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 22, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  bigDeco: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)", top: -50, right: -30 },
  bigIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  bigLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  bigValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 24, marginTop: 4, letterSpacing: -0.3 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  trendText: { fontFamily: FONT.bold, fontSize: 11 },
  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  rowB: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rateChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF7ED", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rateChipText: { color: COLORS.warning, fontFamily: FONT.extrabold, fontSize: 13 },
  rateChipSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10 },
  warnHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  warnIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  warnHeadText: { color: COLORS.error, fontFamily: FONT.semibold, fontSize: 12 },
  warnItem: { flexDirection: "row", justifyContent: "space-between", padding: 10, backgroundColor: "#FEF2F2", borderRadius: 12, marginTop: 8 },
  warnName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  warnDrop: { color: COLORS.error, fontFamily: FONT.bold, fontSize: 12 },
  okRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ECFDF5", padding: 10, borderRadius: 12, marginTop: 8 },
  okIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  emptyMsg: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 13 },
});