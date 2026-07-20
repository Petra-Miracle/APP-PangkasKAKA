import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { api, COLORS, rupiah, tanggal } from "@/src/lib/api";

const TABS = [
  { key: "aktif", label: "Aktif", statuses: ["pending", "confirmed"] },
  { key: "selesai", label: "Selesai", statuses: ["completed"] },
  { key: "dibatalkan", label: "Dibatalkan", statuses: ["cancelled"] },
];

export default function Orders() {
  const [tab, setTab] = useState("aktif");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFor, setReviewFor] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/bookings");
      setOrders(r.bookings);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = async (id: string) => {
    try { await api.post(`/bookings/${id}/cancel`); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const submitReview = async () => {
    try {
      await api.post(`/bookings/${reviewFor.id}/review`, { rating, comment });
      setReviewFor(null); setComment(""); setRating(5); await load();
    } catch (e: any) { alert(e.message); }
  };

  const current = orders.filter((o) => TABS.find((t) => t.key === tab)!.statuses.includes(o.status));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>Pesanan Saya</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 56 }}>
        {TABS.map((t) => (
          <Pressable key={t.key} testID={`tab-${t.key}`} onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
          {current.length === 0 && <Text style={styles.empty}>Belum ada pesanan.</Text>}
          {current.map((o) => (
            <View key={o.id} style={styles.card} testID={`order-${o.id}`}>
              <View style={styles.rowTop}>
                <Image source={{ uri: o.shop?.image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopName}>{o.shop?.name}</Text>
                  <Text style={styles.svcName}>{o.service?.name} · {o.barber?.name}</Text>
                  <Text style={styles.date}>{tanggal(o.booking_date)} · {o.booking_time} WITA</Text>
                </View>
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.price}>{rupiah(o.total_price)}</Text>
                <View style={[styles.badge, { backgroundColor: o.status === "confirmed" ? COLORS.success : o.status === "completed" ? COLORS.info : o.status === "cancelled" ? "#4A0F0F" : COLORS.brand }]}>
                  <Text style={styles.badgeText}>{o.status.toUpperCase()}</Text>
                </View>
              </View>
              {o.status === "pending" && o.payment_status === "unpaid" && (
                <Pressable testID={`pay-${o.id}`} style={styles.payBtn} onPress={async () => { try { await api.post(`/bookings/${o.id}/pay`); await load(); } catch (e: any) { alert(e.message); } }}>
                  <Text style={styles.payBtnText}>BAYAR QRIS (Simulasi)</Text>
                </Pressable>
              )}
              {(o.status === "pending" || o.status === "confirmed") && (
                <Pressable style={styles.cancelBtn} onPress={() => cancel(o.id)}>
                  <Text style={styles.cancelText}>Batalkan</Text>
                </Pressable>
              )}
              {o.status === "completed" && !o.has_review && (
                <Pressable testID={`review-${o.id}`} style={styles.reviewBtn} onPress={() => setReviewFor(o)}>
                  <Ionicons name="star" size={14} color="#121212" />
                  <Text style={styles.reviewText}>Beri Ulasan</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!reviewFor} transparent animationType="slide" onRequestClose={() => setReviewFor(null)}>
        <Pressable style={styles.modalBg} onPress={() => setReviewFor(null)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Ulasan untuk {reviewFor?.shop?.name}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 16 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} testID={`star-${n}`}>
                  <Ionicons name={n <= rating ? "star" : "star-outline"} size={32} color={COLORS.warning} />
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} multiline value={comment} onChangeText={setComment} placeholder="Komentar (opsional)" placeholderTextColor={COLORS.textDim} />
            <Pressable style={styles.payBtn} onPress={submitReview} testID="submit-review">
              <Text style={styles.payBtnText}>KIRIM ULASAN</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", padding: 16 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  tab: { flexShrink: 0, height: 36, paddingHorizontal: 16, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textDim, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#121212" },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  rowTop: { flexDirection: "row", gap: 12 },
  thumb: { width: 60, height: 60, borderRadius: 4 },
  shopName: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  svcName: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  date: { color: COLORS.textDim, fontSize: 12, marginTop: 4 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  price: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  payBtn: { backgroundColor: COLORS.brand, padding: 12, borderRadius: 4, alignItems: "center", marginTop: 10 },
  payBtnText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  cancelBtn: { padding: 10, alignItems: "center" },
  cancelText: { color: COLORS.textDim, fontWeight: "700" },
  reviewBtn: { flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.warning, padding: 10, borderRadius: 4, marginTop: 8 },
  reviewText: { color: "#121212", fontWeight: "900" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 4, marginBottom: 12, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border },
});
