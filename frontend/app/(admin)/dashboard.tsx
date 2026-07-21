import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import Donut from "@/src/components/Donut";

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/analytics/admin"); setD(r); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !d) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;
  const k = d.kpi;
  const custUp = k.customer_growth_pct >= 0;
  const revUp = k.revenue_growth_pct >= 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={styles.badge}><Ionicons name="shield-checkmark" size={12} color={COLORS.brand} /><Text style={styles.badgeText}>ADMIN CONSOLE</Text></View>
        <Text style={styles.headerTitle}>Command Center</Text>
        <Text style={styles.headerSub}>PangkasKAKA · Kupang NTT</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {/* 4 KPI */}
        <View style={styles.grid}>
          <Kpi icon="storefront" label="Total Barbershop" value={k.total_shops} trend={`+${k.new_shops_month} baru`} up />
          <Kpi icon="hourglass" label="Menunggu Verifikasi" value={k.pending} amber />
          <Kpi icon="people" label="Total Pelanggan" value={k.total_customers.toLocaleString("id-ID")} trend={`${custUp ? "+" : ""}${k.customer_growth_pct}% mingguan`} up={custUp} />
        </View>

        <View style={[styles.bigCard, { marginTop: 12 }]}>
          <View style={styles.bigIcon}><Ionicons name="cash" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigLabel}>Transaksi Hari Ini</Text>
            <Text style={styles.bigValue}>{rupiah(k.revenue_today)}</Text>
            <View style={styles.trendRow}>
              <Ionicons name={revUp ? "arrow-up" : "arrow-down"} size={14} color={revUp ? "#00FFB0" : "#FFB4B4"} />
              <Text style={[styles.trendText, { color: revUp ? "#00FFB0" : "#FFB4B4" }]}>{Math.abs(k.revenue_growth_pct)}% dari kemarin</Text>
            </View>
          </View>
        </View>

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
                <Ionicons name="warning" size={14} color={COLORS.error} />
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
            <Text style={styles.emptyMsg}>✓ Tidak ada penurunan rating drastis</Text>
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
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontFamily: FONT.extrabold, marginTop: 8 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "31.5%", padding: 12, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  kpiIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  kpiLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold },
  kpiValue: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, marginTop: 2 },
  trendRow2: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  trendText2: { fontFamily: FONT.bold, fontSize: 9 },
  bigCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: COLORS.brand, padding: 18, borderRadius: 20, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  bigIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  bigLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  bigValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 24, marginTop: 4 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  trendText: { fontFamily: FONT.bold, fontSize: 11 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  rowB: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rateChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF7ED", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rateChipText: { color: COLORS.warning, fontFamily: FONT.extrabold, fontSize: 13 },
  rateChipSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10 },
  warnHead: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12 },
  warnHeadText: { color: COLORS.error, fontFamily: FONT.semibold, fontSize: 12 },
  warnItem: { flexDirection: "row", justifyContent: "space-between", padding: 10, backgroundColor: "#FEF2F2", borderRadius: 10, marginTop: 8 },
  warnName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  warnDrop: { color: COLORS.error, fontFamily: FONT.bold, fontSize: 12 },
  emptyMsg: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 13, marginTop: 8 },
});
