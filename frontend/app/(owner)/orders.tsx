import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah, tanggal } from "@/src/lib/api";

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "Menunggu" },
  confirmed: { color: COLORS.success, bg: "#ECFDF5", label: "Terkonfirmasi" },
  completed: { color: COLORS.info, bg: "#F0F9FF", label: "Selesai" },
  cancelled: { color: COLORS.error, bg: "#FEF2F2", label: "Dibatalkan" },
};

export default function OwnerOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/owner/orders"); setOrders(r.orders); } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = async (id: string, status: string) => {
    try { await api.post(`/owner/orders/${id}/status`, { status }); await load(); }
    catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <Text style={styles.headerTitle}>Pesanan Masuk</Text>
        <Text style={styles.headerSub}>{orders.length} pesanan total</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}>
        {orders.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.textDim} />
            <Text style={styles.empty}>Belum ada pesanan.</Text>
          </View>
        )}
        {orders.map((o) => {
          const meta = STATUS_META[o.status] || STATUS_META.pending;
          return (
            <View key={o.id} style={styles.card} testID={`o-order-${o.id}`}>
              <View style={styles.rowTop}>
                <View style={styles.avatar}><Ionicons name="person" size={20} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cust}>{o.customer?.name}</Text>
                  <Text style={styles.phone}>{o.customer?.phone}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <View style={styles.det}>
                <View style={styles.detRow}><Ionicons name="cut" size={13} color={COLORS.textDim} /><Text style={styles.detText}>{o.service_name} · {o.barber_name}</Text></View>
                <View style={styles.detRow}><Ionicons name="calendar" size={13} color={COLORS.textDim} /><Text style={styles.detText}>{tanggal(o.booking_date)} · {o.booking_time} WITA</Text></View>
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.price}>{rupiah(o.total_price)}</Text>
                <View style={styles.actions}>
                  {o.status === "pending" && <Pressable style={styles.btnPri} onPress={() => update(o.id, "confirmed")} testID={`confirm-${o.id}`}><Text style={styles.btnPriText}>Konfirmasi</Text></Pressable>}
                  {o.status === "confirmed" && <Pressable style={styles.btnPri} onPress={() => update(o.id, "completed")} testID={`complete-${o.id}`}><Text style={styles.btnPriText}>Selesaikan</Text></Pressable>}
                  {(o.status === "pending" || o.status === "confirmed") && <Pressable style={styles.btnSec} onPress={() => update(o.id, "cancelled")}><Text style={styles.btnSecText}>Batal</Text></Pressable>}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  emptyBox: { alignItems: "center", padding: 40, gap: 12 },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#0A2540", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  cust: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  phone: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  det: { marginTop: 12, gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  detRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  price: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18 },
  actions: { flexDirection: "row", gap: 8 },
  btnPri: { backgroundColor: COLORS.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  btnPriText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 12 },
  btnSec: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.error },
  btnSecText: { color: COLORS.error, fontFamily: FONT.bold, fontSize: 12 },
});
