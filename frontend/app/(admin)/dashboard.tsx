import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, COLORS, rupiah } from "@/src/lib/api";

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
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.sub}>PangkasKAKA · Command Center</Text>
        <View style={styles.grid}>
          <Stat label="Total Toko" value={s.total_shops} />
          <Stat label="Menunggu Verifikasi" value={s.pending_verifications} accent />
          <Stat label="Pelanggan" value={s.total_customers} />
          <Stat label="Revenue Hari Ini" value={rupiah(s.revenue_today || 0)} full />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Stat({ label, value, accent, full }: any) {
  return (
    <View style={[styles.card, full && { width: "100%" }, accent && { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.val}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  sub: { color: COLORS.textDim, marginTop: 4, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", padding: 14, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  label: { color: COLORS.textDim, fontSize: 11, letterSpacing: 0.5 },
  val: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 4 },
});
