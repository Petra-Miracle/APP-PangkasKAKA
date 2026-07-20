import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, rupiah } from "@/src/lib/api";

export default function OwnerDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReg, setShowReg] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", price_range: "Rp 25.000 - Rp 75.000" });

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/owner/dashboard"); setData(r); } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const register = async () => {
    try {
      await api.post("/owner/shop", {
        name: form.name, address: form.address, price_range: form.price_range,
        latitude: -10.1789 + Math.random() * 0.05, longitude: 123.607 + Math.random() * 0.05,
        image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
      });
      setShowReg(false); await load();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  if (!data?.shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.title}>Belum ada toko</Text>
          <Text style={styles.sub}>Daftarkan toko Anda untuk memulai.</Text>
          {!showReg && <Pressable style={styles.btn} onPress={() => setShowReg(true)} testID="btn-register-shop"><Text style={styles.btnText}>DAFTARKAN TOKO</Text></Pressable>}
          {showReg && (
            <View style={styles.card}>
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Nama toko" placeholderTextColor={COLORS.textDim} testID="shop-name" />
              <TextInput style={styles.input} value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="Alamat" placeholderTextColor={COLORS.textDim} testID="shop-address" />
              <TextInput style={styles.input} value={form.price_range} onChangeText={(t) => setForm({ ...form, price_range: t })} placeholder="Range harga" placeholderTextColor={COLORS.textDim} />
              <Pressable style={styles.btn} onPress={register} testID="submit-shop-registration"><Text style={styles.btnText}>KIRIM PENGAJUAN</Text></Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const s = data.stats;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        <Text style={styles.title}>{data.shop.name}</Text>
        <View style={[styles.badge, { backgroundColor: data.shop.verification_status === "approved" ? COLORS.success : data.shop.verification_status === "pending" ? COLORS.warning : COLORS.error }]}>
          <Text style={styles.badgeText}>{data.shop.verification_status.toUpperCase()}</Text>
        </View>
        {data.shop.verification_note && <Text style={styles.note}>Catatan admin: {data.shop.verification_note}</Text>}

        <View style={styles.statsGrid}>
          <StatBox label="Pesanan Hari Ini" value={s.today_orders} />
          <StatBox label="Barber Aktif" value={s.active_barbers} />
          <StatBox label="Rating" value={s.rating?.toFixed(1) || "0.0"} />
          <StatBox label="Revenue Bulan Ini" value={rupiah(s.monthly_revenue)} full />
        </View>

        <Text style={styles.sec}>PESANAN TERBARU</Text>
        {(data.latest_orders || []).map((o: any) => (
          <View key={o.id} style={styles.orderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.oCust}>{o.customer_name}</Text>
              <Text style={styles.oDetail}>{o.service_name} · {o.booking_date} {o.booking_time}</Text>
            </View>
            <View style={[styles.mini, { backgroundColor: o.status === "confirmed" ? COLORS.success : COLORS.brand }]}>
              <Text style={styles.miniText}>{o.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, full }: any) {
  return (
    <View style={[styles.statBox, full && { width: "100%" }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  sub: { color: COLORS.textDim, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 16 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 4, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 4, alignItems: "center", marginTop: 8 },
  btnText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginTop: 6 },
  badgeText: { color: "#121212", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  note: { color: COLORS.warning, marginTop: 8, fontSize: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  statBox: { width: "47%", backgroundColor: COLORS.surface, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  statLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 0.5 },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 4 },
  sec: { color: COLORS.textDim, marginTop: 24, marginBottom: 12, letterSpacing: 1, fontSize: 12, fontWeight: "700" },
  orderRow: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, borderRadius: 4, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  oCust: { color: COLORS.text, fontWeight: "700" },
  oDetail: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  mini: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  miniText: { color: "#121212", fontSize: 10, fontWeight: "900" },
});
