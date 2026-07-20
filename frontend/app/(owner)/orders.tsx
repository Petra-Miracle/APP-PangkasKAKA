import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, COLORS, rupiah, tanggal } from "@/src/lib/api";

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
      <Text style={styles.title}>Pesanan</Text>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
        {orders.length === 0 && <Text style={styles.empty}>Belum ada pesanan.</Text>}
        {orders.map((o) => (
          <View key={o.id} style={styles.card} testID={`o-order-${o.id}`}>
            <Text style={styles.cust}>{o.customer?.name}</Text>
            <Text style={styles.det}>{o.service_name} · {o.barber_name}</Text>
            <Text style={styles.det}>{tanggal(o.booking_date)} · {o.booking_time} WITA</Text>
            <View style={styles.row}>
              <Text style={styles.price}>{rupiah(o.total_price)}</Text>
              <View style={[styles.badge, { backgroundColor: o.status === "confirmed" ? COLORS.success : o.status === "completed" ? COLORS.info : o.status === "cancelled" ? "#4A0F0F" : COLORS.brand }]}>
                <Text style={styles.badgeText}>{o.status.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              {o.status === "pending" && <Pressable style={styles.btnPri} onPress={() => update(o.id, "confirmed")} testID={`confirm-${o.id}`}><Text style={styles.btnPriText}>Konfirmasi</Text></Pressable>}
              {o.status === "confirmed" && <Pressable style={styles.btnPri} onPress={() => update(o.id, "completed")} testID={`complete-${o.id}`}><Text style={styles.btnPriText}>Selesai</Text></Pressable>}
              {(o.status === "pending" || o.status === "confirmed") && <Pressable style={styles.btnSec} onPress={() => update(o.id, "cancelled")}><Text style={styles.btnSecText}>Batal</Text></Pressable>}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", padding: 16 },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  cust: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  det: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, alignItems: "center" },
  price: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnPri: { flex: 1, backgroundColor: COLORS.brand, padding: 10, borderRadius: 4, alignItems: "center" },
  btnPriText: { color: "#121212", fontWeight: "900" },
  btnSec: { flex: 1, padding: 10, borderRadius: 4, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  btnSecText: { color: COLORS.textDim, fontWeight: "700" },
});
