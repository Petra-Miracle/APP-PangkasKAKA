import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah, formatJarak } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonRow } from "@/src/components/Skeleton";

const LOC_POLL_INTERVAL = 7000;

function LiveLocationCard({ bookingId, onPress }: { bookingId: string; onPress?: () => void }) {
  const [loc, setLoc] = useState<{ distance_km?: number; updated_at: string } | null>(null);
  const [sharing, setSharing] = useState(false);
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

  // Dulu kartu ini disembunyikan total kalau barber belum menyalakan "bagikan
  // lokasi" (sharing === false) — hasilnya use case "lacak posisi StreetBarber
  // real-time" tidak pernah terlihat oleh customer sama sekali begitu booking
  // confirmed, karena tombolnya sendiri hilang. Sekarang kartu SELALU tampil
  // untuk booking confirmed & rumah; layar /booking/track sudah menangani state
  // "menunggu lokasi barber" dengan baik, jadi biarkan itu yang tampil di sana.
  const secondsAgo = loc ? Math.max(0, Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000)) : null;

  return (
    <PressableScale onPress={onPress} disabled={!onPress} scaleTo={0.98} testID={`live-location-${bookingId}`}>
      <View style={styles.locCard}>
        <View style={styles.locPulse}>
          <Ionicons name={sharing ? "navigate" : "time-outline"} size={16} color={COLORS.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locTitle}>Lacak lokasi StreetBarber</Text>
          {sharing && loc?.distance_km != null ? (
            <Text style={styles.locSub}>Barber {formatJarak(loc.distance_km)} lagi</Text>
          ) : sharing && secondsAgo !== null ? (
            <Text style={styles.locSub}>Diperbarui {secondsAgo}s lalu</Text>
          ) : (
            <Text style={styles.locSub}>Menunggu barber mulai membagikan lokasi</Text>
          )}
        </View>
        {onPress && <Ionicons name="chevron-forward" size={18} color={COLORS.info} />}
      </View>
    </PressableScale>
  );
}

const TABS = [
  { key: "aktif", label: "Aktif", statuses: ["pending", "confirmed"] },
  { key: "selesai", label: "Selesai", statuses: ["completed"] },
  { key: "dibatalkan", label: "Dibatalkan", statuses: ["cancelled"] },
];

// Badge makna (§12): kuning=menunggu, biru=berlangsung, hijau=selesai, merah=batal.
const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#B45309", bg: "#FFF7ED", label: "Menunggu Bayar" },
  confirmed: { color: COLORS.info, bg: "#EFF6FF", label: "Berlangsung" },
  completed: { color: COLORS.success, bg: "#ECFDF5", label: "Selesai" },
  cancelled: { color: COLORS.error, bg: "#FEF2F2", label: "Dibatalkan" },
};

// "Sel, 9 Sep" dari YYYY-MM-DD tanpa jebakan timezone (parse manual, bukan new Date(string)).
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "-";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

export default function Orders() {
  const router = useRouter();
  const [tab, setTab] = useState("aktif");
  const { refresh: refreshAuth } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFor, setReviewFor] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [paymentMode, setPaymentMode] = useState("simulation");

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/bookings"); setOrders(r.bookings); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);

  useEffect(() => { api.get("/payments/mode").then((m) => setPaymentMode(m.mode || "simulation")).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = (o: any) => {
    // Sesuai kebijakan: batal >= H-2 jam bebas penalti; batal < H-2 jam tetap
    // boleh, tapi akun kena penalti (tidak bisa order Barber ke Rumah lagi).
    const bookingDateTime = new Date(`${o.booking_date}T${o.booking_time}:00+08:00`);
    const hoursLeft = (bookingDateTime.getTime() - Date.now()) / 3600000;
    const isLate = hoursLeft < 2;
    Alert.alert(
      "Batalkan Pesanan",
      isLate
        ? "Pembatalan kurang dari H-2 jam sebelum jadwal akan memberi penalti: kamu tidak bisa lagi memesan jasa Barber ke Rumah. Tetap batalkan?"
        : "Yakin ingin membatalkan pesanan ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Batalkan", style: "destructive", onPress: async () => {
            try {
              const r = await api.post(`/bookings/${o.id}/cancel`);
              await load();
              if (r.penalty_applied) {
                await refreshAuth();
                Alert.alert("Pesanan Dibatalkan", "Karena dibatalkan kurang dari H-2 jam, akunmu tidak bisa lagi memesan jasa Barber ke Rumah.");
              }
            } catch (e: any) { alert(e.message); }
          },
        },
      ]
    );
  };
  const pay = async (id: string) => {
    if (paymentMode !== "simulation") { router.push(`/payment/status/${id}` as any); return; }
    try { await api.post(`/bookings/${id}/pay`); await load(); } catch (e: any) { alert(e.message); }
  };
  // Pesan lagi: navigasi ke halaman booking yang sudah ada (toko / detail barber),
  // user menyusun ulang pesanan dari sana. Tanpa endpoint baru.
  const reorder = (o: any) => {
    if (o.delivery_mode === "rumah" && o.barber_id) {
      router.push(`/(customer)/barber/${o.barber_id}` as any);
    } else if (o.shop_id) {
      router.push(`/(customer)/shop/${o.shop_id}` as any);
    }
  };
  const submitReview = async () => {
    try { await api.post(`/bookings/${reviewFor.id}/review`, { rating, comment }); setReviewFor(null); setComment(""); setRating(5); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const current = orders.filter((o) => TABS.find((t) => t.key === tab)!.statuses.includes(o.status));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Pesanan</Text>
        <Text style={styles.sub}>Riwayat layanan & produk kamu</Text>
      </View>
      {/* Segmented tipe (§1b): 2 layar tetap terpisah, tombol ini hanya navigasi antar keduanya */}
      <View style={styles.typeSeg}>
        <View style={[styles.typeOpt, styles.typeOptActive]}>
          <Text style={[styles.typeText, styles.typeTextActive]}>Layanan</Text>
        </View>
        <PressableScale testID="type-produk" style={styles.typeOpt} onPress={() => router.push("/(customer)/product-orders" as any)} scaleTo={0.96}>
          <Text style={styles.typeText}>Produk</Text>
        </PressableScale>
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
            const canReorder = o.status === "cancelled" && (o.delivery_mode === "rumah" ? !!o.barber_id : !!o.shop_id);
            // StreetBarber mandiri, bukan milik toko (toko cuma validator) — booking
            // panggilan ke rumah tampil atas nama StreetBarber-nya, bukan toko.
            const isHomeService = o.delivery_mode === "rumah";
            return (
              <View key={o.id} style={styles.card} testID={`order-${o.id}`}>
                <View style={styles.rowTop}>
                  <Image source={{ uri: isHomeService ? o.barber?.photo : o.shop?.image }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.shopName} numberOfLines={1}>{isHomeService ? o.barber?.name : o.shop?.name}</Text>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <View style={styles.svcRow}>
                      <Ionicons name="cut" size={12} color={COLORS.textDim} />
                      <Text style={styles.svcName} numberOfLines={1}>
                        {isHomeService ? o.service?.name : `${o.service?.name} · ${o.barber?.name}`}
                      </Text>
                    </View>
                    <Text style={styles.date}>{shortDate(o.booking_date)} · {o.booking_time} WITA</Text>
                    {o.delivery_mode === "rumah" && (
                      <View style={styles.homeModeRow}>
                        <Ionicons name="home" size={12} color={COLORS.brandLight} />
                        <Text style={styles.homeModeText}>Barber ke Rumah</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBottom}>
                  <View>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.price}>{rupiah(o.amount_total_charged ?? o.total_price)}</Text>
                  </View>
                  {o.status === "pending" && o.payment_status === "unpaid" && (
                    <PressableScale testID={`pay-${o.id}`} style={styles.payBtnWrap} onPress={() => pay(o.id)} haptic scaleTo={0.96}>
                      <View style={styles.payBtn}>
                        <Ionicons name="wallet" size={15} color={COLORS.onBrand} />
                        <Text style={styles.payBtnText}>{paymentMode === "simulation" ? "BAYAR SIMULASI QRIS" : "LIHAT QRIS & BAYAR"}</Text>
                      </View>
                    </PressableScale>
                  )}
                  {o.status === "completed" && !o.has_review && (
                    <PressableScale testID={`review-${o.id}`} style={styles.reviewBtn} onPress={() => setReviewFor(o)} haptic scaleTo={0.96}>
                      <View style={styles.reviewBtnGrad}>
                        <Ionicons name="star" size={14} color={COLORS.brandLight} />
                        <Text style={styles.reviewText}>Beri ulasan</Text>
                      </View>
                    </PressableScale>
                  )}
                  {canReorder && (
                    <PressableScale testID={`reorder-${o.id}`} style={styles.reorderBtn} onPress={() => reorder(o)} scaleTo={0.96}>
                      <Text style={styles.reorderText}>Pesan lagi</Text>
                    </PressableScale>
                  )}
                </View>
                {o.status === "confirmed" && o.delivery_mode === "rumah" && (
                  <LiveLocationCard bookingId={o.id} onPress={() => router.push(`/booking/track/${o.id}` as any)} />
                )}
                {(o.status === "pending" || o.status === "confirmed") && (
                  <View style={styles.chatRow}>
                    <PressableScale style={[styles.chatBtn, { flex: 1 }]} onPress={() => router.push(`/chat/booking/${o.id}` as any)} testID={`chat-barber-${o.id}`} scaleTo={0.96}>
                      <Ionicons name="chatbubbles-outline" size={16} color={COLORS.brandLight} />
                      <Text style={styles.chatBtnText}>Chat Barber</Text>
                    </PressableScale>
                    <PressableScale style={[styles.chatBtn, { flex: 1 }]} onPress={() => router.push(`/chat/owner/${o.id}` as any)} testID={`chat-owner-${o.id}`} scaleTo={0.96}>
                      <Ionicons name="storefront-outline" size={16} color={COLORS.brandLight} />
                      <Text style={styles.chatBtnText}>Chat Toko</Text>
                    </PressableScale>
                  </View>
                )}
                {(o.status === "pending" || o.status === "confirmed") && (
                  <PressableScale style={styles.cancelBtn} onPress={() => cancel(o)} scaleTo={0.96}>
                    <Text style={styles.cancelText}>Batalkan Pesanan</Text>
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
              <Text style={styles.modalSub}>{reviewFor?.delivery_mode === "rumah" ? reviewFor?.barber?.name : reviewFor?.shop?.name}</Text>
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
  headerBox: { padding: 16, paddingBottom: 10 },
  title: { color: COLORS.text, fontSize: 26, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  sub: { color: COLORS.textDim, marginTop: 3, fontFamily: FONT.medium, fontSize: 13 },
  typeSeg: {
    flexDirection: "row", backgroundColor: COLORS.surface2, borderRadius: 16, padding: 4, marginHorizontal: 16, marginBottom: 4, gap: 4,
  },
  typeOpt: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  typeOptActive: { backgroundColor: COLORS.surface, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  typeText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 14 },
  typeTextActive: { color: COLORS.text, fontFamily: FONT.extrabold },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  tab: {
    flexShrink: 0, height: 40, paddingHorizontal: 18, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 13 },
  tabTextActive: { color: COLORS.onBrand },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 16,
    shadowColor: COLORS.cardShadowStrong, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  rowTop: { flexDirection: "row", gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 18 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  shopName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, flex: 1 },
  svcRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  svcName: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.medium, flex: 1 },
  date: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 3 },
  homeModeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  homeModeText: { color: COLORS.brandLight, fontSize: 11, fontFamily: FONT.bold },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  locCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, marginTop: 12, marginBottom: 4,
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
  },
  locPulse: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  locTitle: { color: COLORS.info, fontFamily: FONT.extrabold, fontSize: 14 },
  locSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  chatRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 4 },
  chatBtn: {
    flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.brand, padding: 12, borderRadius: 12, alignItems: "center",
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  chatBtnText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  totalLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  price: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  badgeText: { fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.3 },
  payBtnWrap: { borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.brand, shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4, flexShrink: 0 },
  payBtn: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center" },
  payBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 0.4, fontSize: 12 },
  reorderBtn: { borderRadius: 12, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 11, paddingHorizontal: 16, flexShrink: 0 },
  reorderText: { color: COLORS.textMuted, fontFamily: FONT.bold, fontSize: 13 },
  cancelBtn: { padding: 10, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.error, fontFamily: FONT.semibold, fontSize: 13 },
  reviewBtn: { borderRadius: 12, backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand, flexShrink: 0 },
  reviewBtnGrad: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14 },
  reviewText: { color: COLORS.brandLight, fontFamily: FONT.extrabold, letterSpacing: 0.4, fontSize: 12 },
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