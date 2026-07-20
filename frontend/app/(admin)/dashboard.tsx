import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/admin/dashboard"); setD(r); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;
  const s = d?.stats || {};
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={12} color={COLORS.brand} />
          <Text style={styles.badgeText}>ADMIN CONSOLE</Text>
        </View>
        <Text style={styles.headerTitle}>Command Center</Text>
        <Text style={styles.headerSub}>PangkasKAKA · Kupang NTT</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        <View style={styles.grid}>
          <StatCard icon="storefront" label="Total Toko" value={s.total_shops} />
          <StatCard icon="hourglass" label="Menunggu Verifikasi" value={s.pending_verifications} accent />
          <StatCard icon="people" label="Pelanggan" value={s.total_customers} />
        </View>
        <View style={styles.revenueCard}>
          <View style={styles.revenueIcon}><Ionicons name="cash" size={24} color="#FFFFFF" /></View>
          <View>
            <Text style={styles.revenueLabel}>Revenue Hari Ini</Text>
            <Text style={styles.revenueValue}>{rupiah(s.revenue_today || 0)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="bulb" size={20} color={COLORS.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Fitur Utama Admin</Text>
            <Text style={styles.infoText}>Verifikasi dokumen legal toko (KTP, NIB, NPWP, Surat Usaha), kelola pengguna, dan tangguhkan toko bermasalah.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, accent }: any) {
  return (
    <View style={[styles.card, accent && { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim }]}>
      <View style={[styles.cardIcon, accent && { backgroundColor: COLORS.brand }]}>
        <Ionicons name={icon} size={16} color={accent ? "#FFFFFF" : COLORS.brand} />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardVal, accent && { color: COLORS.brand }]}>{value}</Text>
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

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { flex: 1, minWidth: "31%", padding: 14, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  cardIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  cardLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold },
  cardVal: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },

  revenueCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: COLORS.brand, padding: 18, borderRadius: 20, marginTop: 16, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  revenueIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  revenueLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  revenueValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 22, marginTop: 4 },

  infoCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  infoTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  infoText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 4, lineHeight: 18 },
});
