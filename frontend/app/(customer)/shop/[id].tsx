import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, rupiah } from "@/src/lib/api";

export default function ShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1=service, 2=barber, 3=slot, 4=confirm
  const [service, setService] = useState<any>(null);
  const [barber, setBarber] = useState<any>(null);
  const [date, setDate] = useState<string>(() => {
    const d = new Date(); return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<any[]>([]);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const [countdown, setCountdown] = useState(15 * 60);

  useEffect(() => {
    (async () => {
      try { const r = await api.get(`/shops/${id}`); setShop(r); } catch {}
      finally { setLoading(false); }
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
    return { iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" }) };
  });

  const createBooking = async () => {
    setCreating(true);
    try {
      const r = await api.post("/bookings", { shop_id: id, barber_id: barber.id, service_id: service.id, booking_date: date, booking_time: slotTime });
      setPayModal(r.booking);
    } catch (e: any) { alert(e.message); } finally { setCreating(false); }
  };

  const doPay = async () => {
    try { await api.post(`/bookings/${payModal.id}/pay`); setPayModal(null); router.replace("/(customer)/orders"); }
    catch (e: any) { alert(e.message); }
  };

  if (loading || !shop) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.hero}>
          <Image source={{ uri: shop.image }} style={styles.heroImg} contentFit="cover" />
          <Pressable style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </Pressable>
        </View>
        <View style={{ padding: 16 }}>
          <Text style={styles.name}>{shop.name}</Text>
          <Text style={styles.addr}>{shop.address}</Text>
          <View style={styles.rateRow}>
            <Ionicons name="star" size={14} color={COLORS.warning} />
            <Text style={styles.rateText}>{shop.rating?.toFixed(1)}</Text>
            <Text style={styles.rateCount}> · {shop.reviews_count} ulasan</Text>
          </View>

          <View style={styles.stepper}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepNum, step >= s && { color: "#121212" }]}>{s}</Text>
              </View>
            ))}
          </View>

          {step === 1 && (
            <View>
              <Text style={styles.sec}>PILIH LAYANAN</Text>
              {shop.services.map((s: any) => (
                <Pressable key={s.id} testID={`svc-${s.id}`} style={[styles.item, service?.id === s.id && styles.itemActive]}
                  onPress={() => setService(s)}>
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
                <Pressable key={b.id} testID={`barber-${b.id}`} style={[styles.item, barber?.id === b.id && styles.itemActive]}
                  onPress={() => setBarber(b)}>
                  <View style={styles.brAvatar}>
                    {b.photo ? <Image source={{ uri: b.photo }} style={{ width: 44, height: 44, borderRadius: 22 }} /> :
                      <Text style={styles.brInitial}>{b.name[0]}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{b.name}</Text>
                    <Text style={styles.itemMeta}>{b.skill_level} · {b.specialization}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          {step === 3 && (
            <View>
              <Text style={styles.sec}>PILIH TANGGAL & JAM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {nextDays.map((d) => (
                  <Pressable key={d.iso} testID={`day-${d.iso}`} onPress={() => { setDate(d.iso); setSlotTime(null); }}
                    style={[styles.dayChip, date === d.iso && styles.dayChipActive]}>
                    <Text style={[styles.dayText, date === d.iso && { color: "#121212" }]}>{d.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.slotGrid}>
                {slots.length === 0 && <Text style={styles.empty}>Toko tutup / tidak ada slot</Text>}
                {slots.map((sl) => (
                  <Pressable key={sl.time} testID={`slot-${sl.time}`} disabled={!sl.available}
                    onPress={() => setSlotTime(sl.time)}
                    style={[styles.slot, !sl.available && styles.slotOff, slotTime === sl.time && styles.slotActive]}>
                    <Text style={[styles.slotText, !sl.available && { color: COLORS.textDim }, slotTime === sl.time && { color: "#121212" }]}>{sl.time}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {step === 4 && (
            <View>
              <Text style={styles.sec}>KONFIRMASI</Text>
              <SummaryRow label="Layanan" value={service?.name} />
              <SummaryRow label="Barber" value={barber?.name} />
              <SummaryRow label="Tanggal" value={date} />
              <SummaryRow label="Jam" value={slotTime + " WITA"} />
              <SummaryRow label="Total" value={rupiah(service?.price || 0)} bold />
            </View>
          )}

          <View style={styles.navRow}>
            {step > 1 && <Pressable style={styles.navSec} onPress={() => setStep(step - 1)}><Text style={styles.navSecText}>KEMBALI</Text></Pressable>}
            {step < 4 && (
              <Pressable testID="next-step" style={styles.navPri} disabled={
                (step === 1 && !service) || (step === 2 && !barber) || (step === 3 && !slotTime)
              } onPress={() => setStep(step + 1)}>
                <Text style={styles.navPriText}>LANJUT</Text>
              </Pressable>
            )}
            {step === 4 && (
              <Pressable testID="confirm-booking" style={styles.navPri} onPress={createBooking} disabled={creating}>
                <Text style={styles.navPriText}>{creating ? "..." : "BAYAR SEKARANG"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!payModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Bayar QRIS</Text>
            <View style={styles.timerBox}>
              <Text style={styles.timerText}>{String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}</Text>
              <Text style={styles.timerLabel}>SISA WAKTU</Text>
            </View>
            <View style={styles.qrBox}>
              <Ionicons name="qr-code" size={140} color="#121212" />
              <Text style={styles.qrCode}>{payModal?.qris_code}</Text>
            </View>
            <Text style={styles.payTotal}>{rupiah(payModal?.total_price)}</Text>
            <Pressable style={styles.navPri} onPress={doPay} testID="mock-pay">
              <Text style={styles.navPriText}>SIMULASI BAYAR</Text>
            </Pressable>
            <Pressable onPress={() => setPayModal(null)} style={{ padding: 12, alignItems: "center" }}>
              <Text style={{ color: COLORS.textDim }}>Batal</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, bold }: any) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumVal, bold && { fontSize: 20, color: COLORS.brand }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { position: "relative" },
  heroImg: { width: "100%", height: 220 },
  backBtn: { position: "absolute", top: 12, left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  addr: { color: COLORS.textDim, marginTop: 4 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  rateText: { color: COLORS.text, fontWeight: "700" },
  rateCount: { color: COLORS.textDim, fontSize: 12 },
  stepper: { flexDirection: "row", justifyContent: "center", gap: 12, marginVertical: 20 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  stepNum: { color: COLORS.textDim, fontWeight: "900" },
  sec: { color: COLORS.textDim, letterSpacing: 1, fontSize: 12, fontWeight: "700", marginBottom: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  itemActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  itemName: { color: COLORS.text, fontWeight: "700" },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  itemPrice: { color: COLORS.brandLight, fontWeight: "900" },
  brAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  brInitial: { color: COLORS.brand, fontWeight: "900" },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  dayChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  dayText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { width: 80, paddingVertical: 10, alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  slotOff: { opacity: 0.4 },
  slotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  slotText: { color: COLORS.text, fontWeight: "700" },
  empty: { color: COLORS.textDim, marginVertical: 20, textAlign: "center", width: "100%" },
  navRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  navPri: { flex: 1, backgroundColor: COLORS.brand, padding: 16, borderRadius: 4, alignItems: "center" },
  navPriText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  navSec: { flex: 1, padding: 16, borderRadius: 4, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  navSecText: { color: COLORS.textDim, fontWeight: "700" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sumLabel: { color: COLORS.textDim },
  sumVal: { color: COLORS.text, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  timerBox: { alignItems: "center", marginVertical: 20 },
  timerText: { color: COLORS.brand, fontSize: 56, fontWeight: "900", letterSpacing: 2 },
  timerLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 1 },
  qrBox: { backgroundColor: "#fff", padding: 24, borderRadius: 8, alignItems: "center", marginBottom: 12 },
  qrCode: { color: "#121212", fontSize: 11, marginTop: 8, letterSpacing: 1 },
  payTotal: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 16 },
});
