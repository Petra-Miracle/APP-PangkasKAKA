import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah, tanggal, formatJarak } from "@/src/lib/api";

const LOC_POLL_INTERVAL = 7000;

function LiveLocationCard({ bookingId }: { bookingId: string }) {
  const [loc, setLoc] = useState<{ distance_km?: number; updated_at: string } | null>(null);
  const [sharing, setSharing] = useState(true);
  const pollRef = useRef<any>(null);

  const fetchLoc = useCallback(async () => {
    try {
      const r = await api.get(`/bookings/${bookingId}/karyawan-location`);
      setLoc(r); setSharing(true);
    } catch { setSharing(false); }
  }, [bookingId]);

  useEffect(() => {
    fetchLoc();
    pollRef.current = setInterval(fetchLoc, LOC_POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchLoc]);

  if (!sharing) return null;
  const secondsAgo = loc ? Math.max(0, Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000)) : null;

  return (
    <View style={styles.locCard} testID={`live-location-${bookingId}`}>
      <Ionicons name="navigate-circle" size={20} color={COLORS.brand} />
      <View style={{ flex: 1 }}>
        <Text style={styles.locTitle}>
          Barber sedang menuju lokasimu{loc?.distance_km != null ? ` · ${formatJarak(loc.distance_km)}` : ""}
        </Text>
        {secondsAgo !== null && <Text style={styles.locSub}>Diperbarui {secondsAgo}s lalu</Text>}
      </View>
    </View>
  );
}

const TABS = [
  { key: "aktif", label: "Aktif", statuses: ["pending", "confirmed"] },
  { key: "selesai", label: "Selesai", statuses: ["completed"] },
  { key: "dibatalkan", label: "Dibatalkan", statuses: ["cancelled"] },
];

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "Menunggu Bayar" },
  confirmed: { color: COLORS.success, bg: "#ECFDF5", label: "Terkonfirmasi" },
  completed: { color: COLORS.info, bg: "#F0F9FF", label: "Selesai" },
  cancelled: { color: COLORS.error, bg: "#FEF2F2", label: "Dibatalkan" },
};

export default function Orders() {
  const router = useRouter();
  const [tab, setTab] = useState("aktif");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFor, setReviewFor] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/bookings"); setOrders(r.bookings); } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = async (id: string) => {
    try { await api.post(`/bookings/${id}/cancel`); await load(); } catch (e: any) { alert(e.message); }
  };
  const pay = async (id: string) => {
    try { await api.post(`/bookings/${id}/pay`); await load(); } catch (e: any) { alert(e.message); }
  };
  const submitReview = async () => {
    try { await api.post(`/bookings/${reviewFor.id}/review`, { rating, comment }); setReviewFor(null); setComment(""); setRating(5); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const current = orders.filter((o) => TABS.find((t) => t.key === tab)!.statuses.includes(o.status));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Pesanan Saya</Text>
        <Text style={styles.sub}>Riwayat semua booking Anda</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 56 }}>
        {TABS.map((t) => (
          <Pressable key={t.key} testID={`tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          {current.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textDim} />
              <Text style={styles.empty}>Belum ada pesanan.</Text>
            </View>
          )}
          {current.map((o) => {
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            return (
              <View key={o.id} style={styles.card} testID={`order-${o.id}`}>
                <View style={styles.rowTop}>
                  <Image source={{ uri: o.shop?.image }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopName} numberOfLines={1}>{o.shop?.name}</Text>
                    <Text style={styles.svcName} numberOfLines={1}>{o.service?.name} · {o.barber?.name}</Text>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={12} color={COLORS.textDim} />
                      <Text style={styles.date}>{tanggal(o.booking_date)} · {o.booking_time} WITA</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBottom}>
                  <Text style={styles.price}>{rupiah(o.total_price)}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {o.status === "confirmed" && <LiveLocationCard bookingId={o.id} />}
                {(o.status === "pending" || o.status === "confirmed") && (
                  <Pressable style={styles.chatBtn} onPress={() => router.push(`/chat/booking/${o.id}` as any)} testID={`chat-barber-${o.id}`}>
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.brand} />
                    <Text style={styles.chatBtnText}>Chat dengan Barber</Text>
                  </Pressable>
                )}
                {o.status === "pending" && o.payment_status === "unpaid" && (
                  <Pressable testID={`pay-${o.id}`} style={styles.payBtn} onPress={() => pay(o.id)}>
                    <Ionicons name="wallet" size={16} color="#FFFFFF" />
                    <Text style={styles.payBtnText}>BAYAR SIMULASI QRIS</Text>
                  </Pressable>
                )}
                {(o.status === "pending" || o.status === "confirmed") && (
                  <Pressable style={styles.cancelBtn} onPress={() => cancel(o.id)}>
                    <Text style={styles.cancelText}>Batalkan Pesanan</Text>
                  </Pressable>
                )}
                {o.status === "completed" && !o.has_review && (
                  <Pressable testID={`review-${o.id}`} style={styles.reviewBtn} onPress={() => setReviewFor(o)}>
                    <Ionicons name="star" size={14} color="#FFFFFF" />
                    <Text style={styles.reviewText}>Beri Ulasan</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!reviewFor} transparent animationType="slide" onRequestClose={() => setReviewFor(null)}>
        <Pressable style={styles.modalBg} onPress={() => setReviewFor(null)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Beri Ulasan</Text>
            <Text style={styles.modalSub}>{reviewFor?.shop?.name}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 20, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} testID={`star-${n}`}>
                  <Ionicons name={n <= rating ? "star" : "star-outline"} size={40} color={COLORS.warning} />
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} multiline value={comment} onChangeText={setComment} placeholder="Ceritakan pengalamanmu (opsional)" placeholderTextColor={COLORS.textDim} />
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
  headerBox: { padding: 16, paddingBottom: 8 },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  sub: { color: COLORS.textDim, marginTop: 2, fontFamily: FONT.medium, fontSize: 13 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  tab: { flexShrink: 0, height: 40, paddingHorizontal: 18, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 13 },
  tabTextActive: { color: "#FFFFFF" },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 12 },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, shadowColor: "#0A2540", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  rowTop: { flexDirection: "row", gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  shopName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  svcName: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  date: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  locCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.brandDim, padding: 10, borderRadius: 12, marginTop: 4, marginBottom: 8 },
  locTitle: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12 },
  locSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10, marginTop: 1 },
  chatBtn: { flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.brand, padding: 12, borderRadius: 12, alignItems: "center", marginTop: 4, marginBottom: 4 },
  chatBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.3 },
  payBtn: { flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.brand, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 12, shadowColor: COLORS.brand, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  payBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  cancelBtn: { padding: 10, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.error, fontFamily: FONT.semibold, fontSize: 13 },
  reviewBtn: { flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.warning, padding: 14, borderRadius: 12, marginTop: 12 },
  reviewText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.5, fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 4, fontFamily: FONT.medium },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 12, marginBottom: 16, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
});
