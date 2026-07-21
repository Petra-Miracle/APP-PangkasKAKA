import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";

export default function ShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [service, setService] = useState<any>(null);
  const [barber, setBarber] = useState<any>(null);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<any[]>([]);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const [countdown, setCountdown] = useState(15 * 60);

  useEffect(() => {
    (async () => {
      try { const r = await api.get(`/shops/${id}`); setShop(r); } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    if (step === 3 && service && barber) {
      (async () => {
        const r = await api.get(`/shops/${id}/slots?barber_id=${barber.id}&date=${date}&service_id=${service.id}`);
        setSlots(r.slots);
      })();
    }
  }, [step, service, barber, date, id]);

  useEffect(() => {
    if (!payModal) return;
    setCountdown(15 * 60);
    const iv = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [payModal]);

  const nextDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { iso: d.toISOString().slice(0, 10), day: d.toLocaleDateString("id-ID", { weekday: "short" }), date: d.getDate() };
  });

  const createBooking = async () => {
    setCreating(true);
    try {
      const r = await api.post("/bookings", { shop_id: id, barber_id: barber.id, service_id: service.id, booking_date: date, booking_time: slotTime });
      const bookingId = r.booking.id;
      // Cek mode pembayaran
      let mode = "simulation";
      try { const m = await api.get("/payments/mode"); mode = m.mode || "simulation"; } catch {}

      if (mode === "simulation") {
        // Tampilkan modal QRIS mock (demo mode)
        setPayModal({ ...r.booking, mode });
      } else {
        // Sandbox / production: buat payment link Durianpay
        try {
          const p = await api.post(`/payments/create/${bookingId}`);
          if (p?.payment_link_url) {
            // Redirect ke status screen, dan buka payment link di browser eksternal
            router.replace(`/payment/status/${bookingId}?url=${encodeURIComponent(p.payment_link_url)}`);
            try { await Linking.openURL(p.payment_link_url); } catch {}
          } else {
            Alert.alert("Pembayaran", "Gagal membuat link pembayaran, silakan coba lagi");
          }
        } catch (e: any) {
          Alert.alert("Pembayaran", e.message || "Gagal membuat link pembayaran, silakan coba lagi");
        }
      }
    } catch (e: any) { alert(e.message); } finally { setCreating(false); }
  };

  const doPay = async () => {
    // Mode simulasi: langsung tandai sukses via endpoint /simulate/
    try {
      await api.post(`/payments/simulate/${payModal.id}`);
      setPayModal(null);
      router.replace(`/payment/status/${payModal.id}`);
    } catch (e: any) {
      // Fallback ke endpoint lama bila simulate tidak aktif
      try {
        await api.post(`/bookings/${payModal.id}/pay`);
        setPayModal(null);
        router.replace(`/payment/status/${payModal.id}`);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  if (loading || !shop) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <Image source={{ uri: shop.image }} style={styles.heroImg} contentFit="cover" />
          <Pressable style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{shop.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.metaText}>{shop.rating?.toFixed(1)}</Text>
              <Text style={styles.metaDim}>({shop.reviews_count} ulasan)</Text>
            </View>
            <View style={styles.dot} />
            <Text style={styles.metaDim}>{shop.price_range}</Text>
          </View>
          <View style={styles.addrRow}>
            <Ionicons name="location" size={14} color={COLORS.brand} />
            <Text style={styles.addr}>{shop.address}</Text>
          </View>

          <View style={styles.stepper}>
            {["Layanan", "Barber", "Jadwal", "Bayar"].map((label, i) => (
              <View key={label} style={styles.stepCol}>
                <View style={[styles.stepDot, step > i && styles.stepDotDone, step === i + 1 && styles.stepDotActive]}>
                  {step > i + 1 ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> :
                    <Text style={[styles.stepNum, step === i + 1 && { color: "#FFFFFF" }]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, step === i + 1 && { color: COLORS.brand, fontFamily: FONT.bold }]}>{label}</Text>
              </View>
            ))}
          </View>

          {step === 1 && (
            <View>
              <Text style={styles.sec}>PILIH LAYANAN</Text>
              {shop.services.map((s: any) => (
                <Pressable key={s.id} testID={`svc-${s.id}`} style={[styles.item, service?.id === s.id && styles.itemActive]} onPress={() => setService(s)}>
                  <View style={styles.svcIcon}><Ionicons name="cut" size={18} color={COLORS.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{s.name}</Text>
                    <Text style={styles.itemMeta}>{s.duration} menit</Text>
                  </View>
                  <Text style={styles.itemPrice}>{rupiah(s.price)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {step === 2 && (
            <View>
              <Text style={styles.sec}>PILIH BARBER</Text>
              {shop.barbers.map((b: any) => (
                <Pressable key={b.id} testID={`barber-${b.id}`} style={[styles.item, barber?.id === b.id && styles.itemActive]} onPress={() => setBarber(b)}>
                  {b.photo ?
                    <Image source={{ uri: b.photo }} style={styles.brAvatar} /> :
                    <View style={styles.brAvatarFallback}><Text style={styles.brInitial}>{b.name[0]}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{b.name}</Text>
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillText}>{b.skill_level}</Text>
                    </View>
                    <Text style={styles.itemMeta}>{b.specialization}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          {step === 3 && (
            <View>
              <Text style={styles.sec}>PILIH TANGGAL & JAM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: 12 }}>
                {nextDays.map((d) => (
                  <Pressable key={d.iso} testID={`day-${d.iso}`} onPress={() => { setDate(d.iso); setSlotTime(null); }}
                    style={[styles.dayChip, date === d.iso && styles.dayChipActive]}>
                    <Text style={[styles.dayLabel, date === d.iso && { color: "#FFFFFF" }]}>{d.day}</Text>
                    <Text style={[styles.dayNum, date === d.iso && { color: "#FFFFFF" }]}>{d.date}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.slotGrid}>
                {slots.length === 0 && <Text style={styles.empty}>Toko tutup atau tidak ada slot.</Text>}
                {slots.map((sl) => (
                  <Pressable key={sl.time} testID={`slot-${sl.time}`} disabled={!sl.available}
                    onPress={() => setSlotTime(sl.time)}
                    style={[styles.slot, !sl.available && styles.slotOff, slotTime === sl.time && styles.slotActive]}>
                    <Text style={[styles.slotText, !sl.available && { color: COLORS.textDim, textDecorationLine: "line-through" }, slotTime === sl.time && { color: "#FFFFFF" }]}>{sl.time}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {step === 4 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sec}>RINGKASAN PESANAN</Text>
              <SummaryRow label="Layanan" value={service?.name} />
              <SummaryRow label="Barber" value={barber?.name} />
              <SummaryRow label="Tanggal" value={date} />
              <SummaryRow label="Jam" value={`${slotTime} WITA`} />
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Pembayaran</Text>
                <Text style={styles.totalValue}>{rupiah(service?.price || 0)}</Text>
              </View>
            </View>
          )}

          <View style={styles.navRow}>
            {step > 1 && <Pressable style={styles.navSec} onPress={() => setStep(step - 1)}><Text style={styles.navSecText}>KEMBALI</Text></Pressable>}
            {step < 4 && (
              <Pressable testID="next-step" style={[styles.navPri, ((step === 1 && !service) || (step === 2 && !barber) || (step === 3 && !slotTime)) && { opacity: 0.4 }]}
                disabled={(step === 1 && !service) || (step === 2 && !barber) || (step === 3 && !slotTime)} onPress={() => setStep(step + 1)}>
                <Text style={styles.navPriText}>LANJUT</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            )}
            {step === 4 && (
              <Pressable testID="confirm-booking" style={styles.navPri} onPress={createBooking} disabled={creating}>
                <Text style={styles.navPriText}>{creating ? "..." : "BAYAR SEKARANG"}</Text>
                <Ionicons name="wallet" size={16} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!payModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Pembayaran QRIS</Text>
            <Text style={styles.modalSub}>Scan QR code di bawah ini untuk membayar</Text>
            <View style={styles.timerBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.warning} />
              <Text style={styles.timerText}>{String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}</Text>
              <Text style={styles.timerLabel}>sisa waktu</Text>
            </View>
            <View style={styles.qrBox}>
              <Ionicons name="qr-code" size={140} color={COLORS.text} />
              <Text style={styles.qrCode}>{payModal?.qris_code}</Text>
            </View>
            <Text style={styles.payTotal}>{rupiah(payModal?.total_price)}</Text>
            <Pressable style={styles.navPri} onPress={doPay} testID="mock-pay">
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.navPriText}>SIMULASI BAYAR</Text>
            </Pressable>
            <Pressable onPress={() => setPayModal(null)} style={{ padding: 12, alignItems: "center", marginTop: 4 }}>
              <Text style={{ color: COLORS.textDim, fontFamily: FONT.medium }}>Batalkan</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: any) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { position: "relative" },
  heroImg: { width: "100%", height: 240 },
  backBtn: { position: "absolute", top: 12, left: 12, width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  body: { padding: 20, marginTop: -20, backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  name: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  metaDim: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium },
  dot: { width: 3, height: 3, borderRadius: 999, backgroundColor: COLORS.textDim },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  addr: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.medium, flex: 1 },

  stepper: { flexDirection: "row", justifyContent: "space-between", marginVertical: 24, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  stepCol: { alignItems: "center", flex: 1 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  stepDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepNum: { color: COLORS.textDim, fontFamily: FONT.bold },
  stepLabel: { color: COLORS.textDim, fontSize: 10, marginTop: 6, fontFamily: FONT.semibold },

  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  itemActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  svcIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  brAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surface2 },
  brAvatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  brInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18 },
  skillBadge: { alignSelf: "flex-start", backgroundColor: COLORS.brandDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  skillText: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold },

  dayChip: { flexShrink: 0, width: 60, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  dayChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  dayLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold, textTransform: "uppercase" },
  dayNum: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, marginTop: 2 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { width: 82, paddingVertical: 12, alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  slotOff: { backgroundColor: COLORS.surface2, opacity: 0.6 },
  slotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  slotText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  empty: { color: COLORS.textDim, marginVertical: 20, textAlign: "center", width: "100%", fontFamily: FONT.medium },

  summaryCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  sumLabel: { color: COLORS.textDim, fontFamily: FONT.medium },
  sumVal: { color: COLORS.text, fontFamily: FONT.semibold },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: COLORS.textMuted, fontFamily: FONT.semibold },
  totalValue: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 22 },

  navRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  navPri: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, shadowColor: COLORS.brand, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  navPriText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  navSec: { flex: 1, padding: 16, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  navSecText: { color: COLORS.textMuted, fontFamily: FONT.bold, letterSpacing: 0.8, fontSize: 13 },

  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 4, fontFamily: FONT.medium, fontSize: 13 },
  timerBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginVertical: 20, backgroundColor: "#FFF7ED", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#FED7AA" },
  timerText: { color: COLORS.warning, fontSize: 22, fontFamily: FONT.extrabold, letterSpacing: 1 },
  timerLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  qrBox: { backgroundColor: "#FFFFFF", padding: 32, borderRadius: 20, alignItems: "center", marginBottom: 16, borderWidth: 2, borderColor: COLORS.border, borderStyle: "dashed" },
  qrCode: { color: COLORS.text, fontSize: 11, marginTop: 12, letterSpacing: 1, fontFamily: FONT.bold },
  payTotal: { color: COLORS.text, fontSize: 26, fontFamily: FONT.extrabold, textAlign: "center", marginBottom: 20 },
});
