import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

export default function OwnerDashboard() {
  const { user } = useAuth();
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
        <View style={styles.navyHeader}>
          <Text style={styles.headerTitle}>Owner Panel</Text>
          <Text style={styles.headerSub}>PangkasKAKA · Dashboard Toko</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="storefront-outline" size={48} color={COLORS.brand} />
            </View>
            <Text style={styles.emptyTitle}>Belum ada toko</Text>
            <Text style={styles.emptyText}>Daftarkan toko Anda untuk mulai menerima pesanan.</Text>
            {!showReg && <Pressable style={styles.btn} onPress={() => setShowReg(true)} testID="btn-register-shop"><Text style={styles.btnText}>DAFTARKAN TOKO</Text></Pressable>}
          </View>
          {showReg && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Data Toko</Text>
              <Text style={styles.label}>Nama Toko</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Barber Kupang" placeholderTextColor={COLORS.textDim} testID="shop-name" />
              <Text style={styles.label}>Alamat</Text>
              <TextInput style={styles.input} value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="Jl. Timor Raya No. 12" placeholderTextColor={COLORS.textDim} testID="shop-address" />
              <Text style={styles.label}>Range Harga</Text>
              <TextInput style={styles.input} value={form.price_range} onChangeText={(t) => setForm({ ...form, price_range: t })} placeholder="Rp 25.000 - Rp 75.000" placeholderTextColor={COLORS.textDim} />
              <Pressable style={styles.btn} onPress={register} testID="submit-shop-registration"><Text style={styles.btnText}>KIRIM PENGAJUAN</Text></Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const s = data.stats;
  const status = data.shop.verification_status;
  const statusMeta = status === "approved" ? { bg: "#ECFDF5", color: COLORS.success, label: "Terverifikasi" } :
                     status === "pending" ? { bg: "#FFF7ED", color: COLORS.warning, label: "Menunggu Verifikasi" } :
                     { bg: "#FEF2F2", color: COLORS.error, label: "Ditolak" };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerHi}>Halo, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.headerTitle}>{data.shop.name}</Text>
        </View>
        <View style={styles.headerBadge}>
          <View style={[styles.dotBadge, { backgroundColor: statusMeta.color }]} />
          <Text style={styles.headerBadgeText}>{statusMeta.label}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        {data.shop.verification_note && (
          <View style={styles.noteBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
            <Text style={styles.noteText}>Catatan admin: {data.shop.verification_note}</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatBox icon="calendar" label="Pesanan Hari Ini" value={s.today_orders} />
          <StatBox icon="people" label="Barber Aktif" value={s.active_barbers} />
          <StatBox icon="star" label="Rating" value={s.rating?.toFixed(1) || "0.0"} />
          <View style={styles.bigStat}>
            <View style={styles.bigStatIcon}><Ionicons name="cash" size={20} color="#FFFFFF" /></View>
            <View>
              <Text style={styles.bigStatLabel}>Revenue Bulan Ini</Text>
              <Text style={styles.bigStatValue}>{rupiah(s.monthly_revenue)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sec}>PESANAN TERBARU</Text>
        {(data.latest_orders || []).length === 0 && <Text style={styles.empty}>Belum ada pesanan.</Text>}
        {(data.latest_orders || []).map((o: any) => (
          <View key={o.id} style={styles.orderRow}>
            <View style={styles.orderAvatar}><Ionicons name="person" size={18} color={COLORS.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.oCust}>{o.customer_name}</Text>
              <Text style={styles.oDetail}>{o.service_name} · {o.booking_date} · {o.booking_time}</Text>
            </View>
            <View style={[styles.mini, o.status === "confirmed" ? { backgroundColor: "#ECFDF5" } : { backgroundColor: "#FFF7ED" }]}>
              <Text style={[styles.miniText, o.status === "confirmed" ? { color: COLORS.success } : { color: COLORS.warning }]}>{o.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value }: any) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={COLORS.brand} /></View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  headerHi: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  dotBadge: { width: 6, height: 6, borderRadius: 999 },
  headerBadgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: FONT.bold },

  emptyState: { alignItems: "center", padding: 24, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontFamily: FONT.extrabold },
  emptyText: { color: COLORS.textDim, marginTop: 6, marginBottom: 16, textAlign: "center", fontFamily: FONT.medium },
  card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginTop: 16 },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, marginBottom: 12 },
  label: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 16, shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },

  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFF7ED", padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: "#FED7AA" },
  noteText: { color: COLORS.warning, flex: 1, fontFamily: FONT.medium, fontSize: 12 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  statBox: { width: "31%", backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  statIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  statValue: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  bigStat: { width: "100%", backgroundColor: COLORS.brand, padding: 18, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  bigStatIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  bigStatLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  bigStatValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 22, marginTop: 2 },

  sec: { color: COLORS.textDim, marginTop: 28, marginBottom: 12, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold },
  empty: { color: COLORS.textDim, textAlign: "center", padding: 20, fontFamily: FONT.medium },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: COLORS.surface, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  orderAvatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  oCust: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  oDetail: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  mini: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  miniText: { fontSize: 10, fontFamily: FONT.bold },
});
