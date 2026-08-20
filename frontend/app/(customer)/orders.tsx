import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah, tanggal, formatJarak } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonRow } from "@/src/components/Skeleton";

const LOC_POLL_INTERVAL = 7000;

function LiveLocationCard({ bookingId, onPress }: { bookingId: string; onPress?: () => void }) {
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
    <PressableScale onPress={onPress} disabled={!onPress} scaleTo={0.98} testID={`live-location-${bookingId}`}>
      <LinearGradient
        colors={[COLORS.brandGradStart, COLORS.brandGradMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.locCard}
      >
        <View style={styles.locPulse}>
          <Ionicons name="navigate" size={16} color={COLORS.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locTitle}>
            Barber sedang menuju lokasimu{loc?.distance_km != null ? ` · ${formatJarak(loc.distance_km)}` : ""}
          </Text>
          {secondsAgo !== null && <Text style={styles.locSub}>Diperbarui {secondsAgo}s lalu</Text>}
        </View>
        {onPress && <Ionicons name="chevron-forward" size={18} color={COLORS.brand} />}
      </LinearGradient>
    </PressableScale>
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
  const [paymentMode, setPaymentMode] = useState("simulation");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/bookings"); setOrders(r.bookings); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { api.get("/payments/mode").then((m) => setPaymentMode(m.mode || "simulation")).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = async (id: string) => {
    try { await api.post(`/bookings/${id}/cancel`); await load(); } catch (e: any) { alert(e.message); }
  };
  const pay = async (id: string) => {
    if (paymentMode !== "simulation") { router.push(`/payment/status/${id}` as any); return; }
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
          <PressableScale key={t.key} testID={`tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]} scaleTo={0.94}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton style={{ height: 150 }} />
          <Skeleton style={{ height: 150 }} />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          {current.length === 0 && (
            <EmptyState
              icon="receipt-outline"
              title="Belum ada pesanan"
              description="Booking yang kamu buat akan muncul di sini."
            />
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
                    {o.delivery_mode === "rumah" && (
                      <View style={styles.homeModeRow}>
                        <Ionicons name="home" size={12} color={COLORS.brand} />
                        <Text style={styles.homeModeText}>Barber ke Rumah</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBottom}>
                  <Text style={styles.price}>{rupiah(o.total_price)}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {o.status === "confirmed" && o.delivery_mode === "rumah" && (
                  <LiveLocationCard bookingId={o.id} onPress={() => router.push(`/booking/track/${o.id}` as any)} />
                )}
                {(o.status === "pending" || o.status === "confirmed") && (
                  <View style={styles.chatRow}>
                    <PressableScale style={[styles.chatBtn, { flex: 1 }]} onPress={() => router.push(`/chat/booking/${o.id}` as any)} testID={`chat-barber-${o.id}`} scaleTo={0.96}>
                      <Ionicons name="chatbubbles-outline" size={16} color={COLORS.brand} />
                      <Text style={styles.chatBtnText}>Chat Barber</Text>
                    </PressableScale>
                    <PressableScale style={[styles.chatBtn, { flex: 1 }]} onPress={() => router.push(`/chat/owner/${o.id}` as any)} testID={`chat-owner-${o.id}`} scaleTo={0.96}>
                      <Ionicons name="storefront-outline" size={16} color={COLORS.brand} />
                      <Text style={styles.chatBtnText}>Chat Toko</Text>
                    </PressableScale>
                  </View>
                )}
                {o.status === "pending" && o.payment_status === "unpaid" && (
                  <PressableScale testID={`pay-${o.id}`} style={styles.payBtnWrap} onPress={() => pay(o.id)} haptic>
                    <LinearGradient
                      colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.payBtn}
                    >
                      <Ionicons name="wallet" size={16} color="#FFFFFF" />
                      <Text style={styles.payBtnText}>{paymentMode === "simulation" ? "BAYAR SIMULASI QRIS" : "LIHAT QRIS & BAYAR"}</Text>
                    </LinearGradient>
                  </PressableScale>
                )}
                {(o.status === "pending" || o.status === "confirmed") && (
                  <PressableScale style={styles.cancelBtn} onPress={() => cancel(o.id)} scaleTo={0.96}>
                    <Text style={styles.cancelText}>Batalkan Pesanan</Text>
                  </PressableScale>
                )}
                {o.status === "completed" && !o.has_review && (
                  <PressableScale testID={`review-${o.id}`} style={styles.reviewBtn} onPress={() => setReviewFor(o)} haptic>
                    <LinearGradient
                      colors={["#FFB84D", "#F59E0B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.reviewBtnGrad}
                    >
                      <Ionicons name="star" size={14} color="#FFFFFF" />
                      <Text style={styles.reviewText}>Beri Ulasan</Text>
                    </LinearGradient>
                  </PressableScale>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!reviewFor} transparent animationType="slide" onRequestClose={() => setReviewFor(null)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalBg} onPress={() => setReviewFor(null)}>
            <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
              <View style={styles.grabber} />
              <View style={styles.modalHeadIcon}>
                <Ionicons name="star" size={22} color={COLORS.warning} />
              </View>
              <Text style={styles.modalTitle}>Beri Ulasan</Text>
              <Text style={styles.modalSub}>{reviewFor?.shop?.name}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginVertical: 20, justifyContent: "center" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <PressableScale key={n} onPress={() => setRating(n)} testID={`star-${n}`} scaleTo={0.85} haptic>
                    <Ionicons name={n <= rating ? "star" : "star-outline"} size={40} color={COLORS.warning} />
                  </PressableScale>
                ))}
              </View>
              <TextInput style={styles.input} multiline value={comment} onChangeText={setComment} placeholder="Ceritakan pengalamanmu (opsional)" placeholderTextColor={COLORS.textDim} />
              <PressableScale style={styles.submitBtn} onPress={submitReview} testID="submit-review" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtnGrad}
                >
                  <Text style={styles.payBtnText}>KIRIM ULASAN</Text>
                </LinearGradient>
              </PressableScale>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
  tab: {
    flexShrink: 0, height: 40, paddingHorizontal: 18, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 13 },
  tabTextActive: { color: "#FFFFFF" },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 14,
    shadowColor: COLORS.cardShadowStrong, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  rowTop: { flexDirection: "row", gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  shopName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  svcName: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  date: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium },
  homeModeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  homeModeText: { color: COLORS.brand, fontSize: 11, fontFamily: FONT.bold },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  locCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, marginTop: 4, marginBottom: 8,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3,
  },
  locPulse: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  locTitle: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 12 },
  locSub: { color: "rgba(255,255,255,0.8)", fontFamily: FONT.medium, fontSize: 10, marginTop: 1 },
  chatRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 4 },
  chatBtn: {
    flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.brand, padding: 12, borderRadius: 12, alignItems: "center",
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  chatBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.3 },
  payBtnWrap: { borderRadius: 14, marginTop: 12, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  payBtn: { flexDirection: "row", justifyContent: "center", gap: 6, padding: 14, alignItems: "center" },
  payBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  cancelBtn: { padding: 10, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.error, fontFamily: FONT.semibold, fontSize: 13 },
  reviewBtn: { borderRadius: 12, marginTop: 12, overflow: "hidden", shadowColor: "#F59E0B", shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  reviewBtnGrad: { flexDirection: "row", justifyContent: "center", gap: 6, padding: 14 },
  reviewText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.5, fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  modalHeadIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 10 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 4, fontFamily: FONT.medium },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 12, marginBottom: 16, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  submitBtn: { borderRadius: 14, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  submitBtnGrad: { padding: 16, alignItems: "center" },
});