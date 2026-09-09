import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import PressableScale from "@/src/components/PressableScale";
import Skeleton from "@/src/components/Skeleton";

// Halaman booking mandiri untuk StreetBarber — sengaja terpisah dari halaman toko
// (app/(customer)/shop/[id].tsx). StreetBarber berdiri sendiri setelah lulus validasi
// (lihat Noted/2026-09-02/Mentoring/Karyawan.md): toko cuma jadi validator berkas & skill.
// Layanan, harga & biaya ke rumah di sini murni milik StreetBarber sendiri (GET /barbers/{id}),
// bukan dipinjam dari katalog toko validator.

// Raster tile OSM gratis, tanpa API key — sama seperti app/booking/track/[bookingId].tsx.
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};
const DEFAULT_CENTER: [number, number] = [123.607, -10.1789]; // Kupang, [lng, lat]

export default function BarberProfile() {
  const { id, rebookServiceId } = useLocalSearchParams<{ id: string; rebookServiceId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [barber, setBarber] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [service, setService] = useState<any>(null);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [slots, setSlots] = useState<any[]>([]);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const [countdown, setCountdown] = useState(15 * 60);
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    user?.lat != null && user?.lng != null ? [user.lng, user.lat] : DEFAULT_CENTER
  );
  const [gpsLoading, setGpsLoading] = useState(false);

  const useCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { alert("Izin lokasi dibutuhkan untuk booking ke rumah"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCustomerCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setMapCenter([loc.coords.longitude, loc.coords.latitude]);
    } catch { alert("Gagal mengambil lokasi, coba lagi"); } finally { setGpsLoading(false); }
  };

  const onMapPress = (e: any) => {
    const [lng, lat] = e.nativeEvent?.lngLat || e.geometry?.coordinates || [];
    if (lat == null || lng == null) return;
    setCustomerCoords({ lat, lng });
    setMapCenter([lng, lat]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/barbers/${id}`);
        if (cancelled) return;
        setBarber(r);
        if (rebookServiceId) {
          const svc = (r.services || []).find((s: any) => s.id === rebookServiceId);
          if (svc) { setService(svc); setStep(2); }
        }
      } catch {} finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, rebookServiceId]);

  useEffect(() => {
    if (step === 2 && service && barber) {
      (async () => {
        const r = await api.get(`/barbers/${barber.id}/slots?date=${date}&service_id=${service.id}`);
        setSlots(r.slots);
        setShowAllSlots(false);
      })();
    }
  }, [step, service, barber, date]);

  useEffect(() => {
    if (!payModal) return;
    setCountdown(15 * 60);
    const iv = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [payModal]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthLabel = calendarMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const isCurrentMonth = calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth();

  const calendarWeeks = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Senin = 0
    const cursor = new Date(year, month, 1 - firstWeekday);
    const weeks: { iso: string; day: number; inMonth: boolean; isPast: boolean }[][] = [];
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const iso = cursor.toISOString().slice(0, 10);
        week.push({ iso, day: cursor.getDate(), inMonth: cursor.getMonth() === month, isPast: iso < todayIso });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [calendarMonth, todayIso]);

  const createBooking = async () => {
    setCreating(true);
    try {
      const r = await api.post("/bookings", {
        shop_id: barber.shop_id, barber_id: barber.id, service_id: service.id, booking_date: date, booking_time: slotTime,
        delivery_mode: "rumah",
        customer_address: customerAddress, customer_lat: customerCoords?.lat, customer_lng: customerCoords?.lng,
      });
      const bookingId = r.booking.id;
      let mode = "simulation";
      try { const m = await api.get("/payments/mode"); mode = m.mode || "simulation"; } catch {}

      if (mode === "simulation") {
        setPayModal({ ...r.booking, mode });
      } else {
        try {
          const p = await api.post(`/payments/create/${bookingId}`);
          if (p?.payment_link_url || p?.qr_string) {
            router.replace(`/payment/status/${bookingId}?url=${encodeURIComponent(p.payment_link_url || "")}`);
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
    try {
      await api.post(`/payments/simulate/${payModal.id}`);
      setPayModal(null);
      router.replace(`/payment/status/${payModal.id}`);
    } catch (e: any) {
      try {
        await api.post(`/bookings/${payModal.id}/pay`);
        setPayModal(null);
        router.replace(`/payment/status/${payModal.id}`);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Skeleton style={{ height: 96, borderRadius: 20 }} />
        <Skeleton style={{ height: 56, marginTop: 22 }} />
        <Skeleton style={{ height: 56, marginTop: 8 }} />
        <Skeleton style={{ height: 56, marginTop: 8 }} />
      </View>
    </SafeAreaView>
  );

  if (!barber) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.body}>
        <PressableScale style={styles.backBtnFlat} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.empty}>StreetBarber tidak ditemukan atau sudah tidak aktif.</Text>
      </View>
    </SafeAreaView>
  );

  if (user?.home_delivery_blocked) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.body}>
        <PressableScale style={styles.backBtnFlat} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.empty}>Kamu tidak bisa memesan jasa Barber ke Rumah karena pernah membatalkan booking kurang dari H-2 jam sebelum jadwal.</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <PressableScale style={styles.backBtn} onPress={() => router.back()} testID="back-btn" scaleTo={0.92}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </PressableScale>
          {barber.photo ? (
            <Image source={{ uri: barber.photo }} style={styles.heroAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
              <Text style={styles.heroInitial}>{barber.name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.heroName}>{barber.name}</Text>
          <View style={styles.skillBadge}>
            <Text style={styles.skillText}>{barber.skill_level} · StreetBarber</Text>
          </View>
          <Text style={styles.validatorHint}>Divalidasi oleh {barber.shop_name}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.stepper}>
            {["Layanan", "Jadwal", "Bayar"].map((label, i) => (
              <View key={label} style={styles.stepCol}>
                <View style={[styles.stepDot, step > i + 1 && styles.stepDotDone, step === i + 1 && styles.stepDotActive]}>
                  {step > i + 1 ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> :
                    <Text style={[styles.stepNum, step === i + 1 && { color: "#FFFFFF" }]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, step === i + 1 && { color: COLORS.brand, fontFamily: FONT.bold }]}>{label}</Text>
                {i < 2 && <View style={[styles.stepLine, step > i + 1 && styles.stepLineDone]} />}
              </View>
            ))}
          </View>

          {step === 1 && (
            <View>
              <Text style={styles.sec}>PILIH LAYANAN</Text>
              {(barber.services || []).length === 0 && <Text style={styles.empty}>StreetBarber ini belum menambahkan layanan.</Text>}
              {(barber.services || []).map((s: any) => (
                <PressableScale key={s.id} testID={`svc-${s.id}`} style={[styles.item, service?.id === s.id && styles.itemActive]} onPress={() => setService(s)} scaleTo={0.98}>
                  <View style={[styles.svcIcon, service?.id === s.id && { backgroundColor: COLORS.brand }]}>
                    <Ionicons name="cut" size={18} color={service?.id === s.id ? "#FFFFFF" : COLORS.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{s.name}</Text>
                    <Text style={styles.itemMeta}>{s.duration} menit</Text>
                  </View>
                  <Text style={styles.itemPrice}>{rupiah(s.price)}</Text>
                  {service?.id === s.id && (
                    <View style={styles.checkedPill}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </PressableScale>
              ))}
            </View>
          )}
          {step === 2 && (
            <View>
              <Text style={styles.sec}>PILIH TANGGAL & JAM</Text>

              <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <PressableScale
                    testID="cal-prev"
                    onPress={() => !isCurrentMonth && setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    disabled={isCurrentMonth}
                    style={[styles.calendarNavBtn, isCurrentMonth && { opacity: 0.3 }]}
                    scaleTo={0.9}
                  >
                    <Ionicons name="chevron-back" size={18} color={COLORS.text} />
                  </PressableScale>
                  <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
                  <PressableScale
                    testID="cal-next"
                    onPress={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    style={styles.calendarNavBtn}
                    scaleTo={0.9}
                  >
                    <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
                  </PressableScale>
                </View>

                <View style={styles.calendarRow}>
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((wd) => (
                    <Text key={wd} style={styles.calendarWeekDay}>{wd}</Text>
                  ))}
                </View>

                {calendarWeeks.map((week, wi) => (
                  <View key={wi} style={styles.calendarRow}>
                    {week.map((d) => {
                      const disabled = !d.inMonth || d.isPast;
                      const selected = date === d.iso;
                      return (
                        <Pressable
                          key={d.iso}
                          testID={`day-${d.iso}`}
                          disabled={disabled}
                          onPress={() => { setDate(d.iso); setSlotTime(null); }}
                          style={styles.calendarCell}
                        >
                          <View style={[styles.calendarDayCircle, selected && styles.calendarDayCircleActive]}>
                            <Text
                              style={[
                                styles.calendarDayText,
                                (!d.inMonth || disabled) && styles.calendarDayTextMuted,
                                selected && styles.calendarDayTextActive,
                              ]}
                            >
                              {d.day}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.slotList}>
                {slots.length === 0 && <Text style={styles.empty}>Tidak ada slot tersedia.</Text>}
                {(showAllSlots ? slots : slots.slice(0, 5)).map((sl) => {
                  const selected = slotTime === sl.time;
                  return (
                    <PressableScale
                      key={sl.time}
                      testID={`slot-${sl.time}`}
                      disabled={!sl.available}
                      onPress={() => setSlotTime(sl.time)}
                      style={[
                        styles.slotRow,
                        sl.available ? styles.slotRowAvailable : styles.slotRowOff,
                        selected && styles.slotRowActive,
                      ]}
                      scaleTo={0.98}
                    >
                      <Text style={[styles.slotRowTime, !sl.available && styles.slotRowTimeOff, selected && styles.slotRowTimeActive]}>
                        {sl.time}
                      </Text>
                      {sl.available ? (
                        <View style={[styles.slotBadge, selected && styles.slotBadgeActive]}>
                          <Ionicons name="checkmark-circle" size={14} color={selected ? "#FFFFFF" : COLORS.success} />
                          <Text style={[styles.slotBadgeText, selected && { color: "#FFFFFF" }]}>Anti-bentrok</Text>
                        </View>
                      ) : (
                        <Text style={styles.slotBookedText}>Sudah dipesan</Text>
                      )}
                    </PressableScale>
                  );
                })}
                {!showAllSlots && slots.length > 5 && (
                  <PressableScale testID="slots-see-more" style={styles.seeMoreBtn} onPress={() => setShowAllSlots(true)} scaleTo={0.97}>
                    <Text style={styles.seeMoreText}>Lihat Lebih Banyak</Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.brand} />
                  </PressableScale>
                )}
              </View>
            </View>
          )}
          {step === 3 && (
            <View>
              <View style={styles.homeBox}>
                <Text style={styles.homeFeeNote}>
                  + {rupiah(barber.home_service_fee || 0)} biaya layanan ke rumah
                </Text>
                <Text style={styles.mapHint}>Ketuk peta untuk menandai lokasi rumahmu</Text>
                <View style={styles.mapBox}>
                  <Map mapStyle={OSM_STYLE} style={{ flex: 1 }} attribution logo={false} compass={false} scaleBar={false} onPress={onMapPress}>
                    <Camera center={mapCenter} zoom={15} duration={400} />
                    {customerCoords && (
                      <Marker id="home-pin" lngLat={[customerCoords.lng, customerCoords.lat]}>
                        <View style={styles.mapPin}>
                          <Ionicons name="home" size={16} color="#FFFFFF" />
                        </View>
                      </Marker>
                    )}
                  </Map>
                </View>
                <TextInput
                  style={styles.addrInput}
                  placeholder="Alamat rumah (patokan, nama jalan, dsb)"
                  placeholderTextColor={COLORS.textDim}
                  value={customerAddress}
                  onChangeText={setCustomerAddress}
                  testID="home-address-input"
                  multiline
                />
                <PressableScale style={styles.gpsBtn} onPress={useCurrentLocation} disabled={gpsLoading} testID="use-current-location" scaleTo={0.97}>
                  <Ionicons name={customerCoords ? "checkmark-circle" : "locate"} size={16} color={customerCoords ? COLORS.success : COLORS.brand} />
                  <Text style={[styles.gpsBtnText, customerCoords && { color: COLORS.success }]}>
                    {gpsLoading ? "Mengambil lokasi..." : customerCoords ? "Titik lokasi tersimpan" : "Pakai Lokasi Saat Ini"}
                  </Text>
                </PressableScale>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.sec}>RINGKASAN PESANAN</Text>
                <SummaryRow label="Layanan" value={service?.name} />
                <SummaryRow label="StreetBarber" value={barber?.name} />
                <SummaryRow label="Tanggal" value={date} />
                <SummaryRow label="Jam" value={`${slotTime} WITA`} />
                <View style={styles.divider} />
                {(() => {
                  const servicePrice = (service?.price || 0) + (barber.home_service_fee || 0);
                  const adminFeeEst = Math.round(servicePrice * 0.007);
                  return (
                    <>
                      <SummaryRow label="Harga Layanan" value={rupiah(servicePrice)} />
                      <SummaryRow label="Biaya Admin (estimasi)" value={rupiah(adminFeeEst)} />
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Pembayaran</Text>
                        <Text style={styles.totalValue}>{rupiah(servicePrice + adminFeeEst)}</Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
          )}

          <View style={styles.navRow}>
            {step > 1 && (
              <PressableScale style={styles.navSec} onPress={() => setStep(step - 1)} scaleTo={0.96}>
                <Text style={styles.navSecText}>KEMBALI</Text>
              </PressableScale>
            )}
            {step < 3 && (
              <PressableScale testID="next-step" style={[styles.navPri, ((step === 1 && !service) || (step === 2 && !slotTime)) && { opacity: 0.4 }]}
                disabled={(step === 1 && !service) || (step === 2 && !slotTime)} onPress={() => setStep(step + 1)}>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.navPriGrad}
                >
                  <Text style={styles.navPriText}>LANJUT</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </LinearGradient>
              </PressableScale>
            )}
            {step === 3 && (
              <PressableScale
                testID="confirm-booking"
                style={[styles.navPri, (creating || !customerCoords) && { opacity: 0.4 }]}
                onPress={createBooking}
                disabled={creating || !customerCoords}
              >
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.navPriGrad}
                >
                  <Text style={[styles.navPriText, styles.navPriTextPay]} numberOfLines={1} adjustsFontSizeToFit>
                    {creating ? "..." : "BAYAR SEKARANG"}
                  </Text>
                  <Ionicons name="wallet" size={16} color="#FFFFFF" />
                </LinearGradient>
              </PressableScale>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!payModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHead}
            >
              <View style={styles.modalHeadIcon}>
                <Ionicons name="qr-code" size={22} color={COLORS.brand} />
              </View>
              <Text style={styles.modalTitle}>Pembayaran QRIS</Text>
              <Text style={styles.modalSub}>Scan QR code di bawah ini untuk membayar</Text>
            </LinearGradient>
            <View style={styles.timerBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.warning} />
              <Text style={styles.timerText}>{String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}</Text>
              <Text style={styles.timerLabel}>sisa waktu</Text>
            </View>
            <View style={styles.qrBox}>
              <Ionicons name="qr-code" size={140} color={COLORS.text} />
              <Text style={styles.qrCode}>{payModal?.qris_code}</Text>
            </View>
            {payModal?.amount_total_charged != null ? (
              <View style={styles.payBreakdown}>
                <SummaryRow label="Harga Layanan" value={rupiah(payModal.amount_service)} />
                <SummaryRow label="Biaya Admin" value={rupiah(payModal.amount_admin_fee)} />
                <Text style={styles.payTotal}>{rupiah(payModal.amount_total_charged)}</Text>
              </View>
            ) : (
              <Text style={styles.payTotal}>{rupiah(payModal?.total_price)}</Text>
            )}
            <PressableScale style={styles.payBtn} onPress={doPay} testID="mock-pay" haptic>
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.payBtnGrad}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.navPriText}>SIMULASI BAYAR</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale onPress={() => setPayModal(null)} style={styles.cancelBtn} scaleTo={0.95}>
              <Text style={styles.cancelText}>Batalkan</Text>
            </PressableScale>
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
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: COLORS.surface, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { position: "absolute", top: 12, left: 12, width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  backBtnFlat: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.surface2, marginTop: 24 },
  heroAvatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.brandDim },
  heroInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 32 },
  heroName: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, marginTop: 12 },
  validatorHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 8, textAlign: "center" },
  body: { padding: 20, backgroundColor: COLORS.bg },

  stepper: { flexDirection: "row", justifyContent: "space-between", marginVertical: 24, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  stepCol: { alignItems: "center", flex: 1 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  stepDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepNum: { color: COLORS.textDim, fontFamily: FONT.bold },
  stepLabel: { color: COLORS.textDim, fontSize: 10, marginTop: 6, fontFamily: FONT.semibold },
  stepLine: { position: "absolute", top: 15, left: "50%", width: "100%", height: 2, backgroundColor: COLORS.border, zIndex: -1 },
  stepLineDone: { backgroundColor: COLORS.success },

  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 12 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 1,
  },
  itemActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim, shadowColor: COLORS.brand, shadowOpacity: 0.12 },
  svcIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  checkedPill: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center", position: "absolute", top: -6, right: -6, borderWidth: 2, borderColor: "#FFFFFF" },
  skillBadge: { alignSelf: "center", backgroundColor: COLORS.brandDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  skillText: { color: COLORS.brand, fontSize: 11, fontFamily: FONT.bold },

  calendarCard: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  calendarNavBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  calendarMonthLabel: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, textTransform: "capitalize" },
  calendarRow: { flexDirection: "row" },
  calendarWeekDay: { flex: 1, textAlign: "center", color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold, marginBottom: 6 },
  calendarCell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  calendarDayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  calendarDayCircleActive: { backgroundColor: COLORS.text },
  calendarDayText: { color: COLORS.text, fontSize: 13, fontFamily: FONT.semibold },
  calendarDayTextMuted: { color: COLORS.textDim, opacity: 0.4 },
  calendarDayTextActive: { color: "#FFFFFF", fontFamily: FONT.bold },

  slotList: { gap: 8 },
  slotRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  slotRowAvailable: { backgroundColor: "#ECFDF5", borderColor: "#BBF0D9" },
  slotRowOff: { backgroundColor: COLORS.surface2, borderColor: COLORS.border, opacity: 0.6 },
  slotRowActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  slotRowTime: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  slotRowTimeOff: { color: COLORS.textDim, textDecorationLine: "line-through" },
  slotRowTimeActive: { color: "#FFFFFF" },
  slotBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  slotBadgeActive: {},
  slotBadgeText: { color: COLORS.success, fontFamily: FONT.bold, fontSize: 12 },
  slotBookedText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  empty: { color: COLORS.textDim, marginVertical: 20, textAlign: "center", width: "100%", fontFamily: FONT.medium },
  seeMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: COLORS.brandDim, marginTop: 2 },
  seeMoreText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 13 },

  homeBox: { backgroundColor: COLORS.brandDim, padding: 14, borderRadius: 16, marginBottom: 14, gap: 10 },
  homeFeeNote: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  mapHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  mapBox: { height: 200, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  mapPin: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  addrInput: { backgroundColor: COLORS.surface, color: COLORS.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 13, minHeight: 60, textAlignVertical: "top" },
  gpsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  gpsBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 13 },
  summaryCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  sumLabel: { color: COLORS.textDim, fontFamily: FONT.medium },
  sumVal: { color: COLORS.text, fontFamily: FONT.semibold },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: COLORS.textMuted, fontFamily: FONT.semibold },
  totalValue: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 22 },

  navRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  navPri: { flex: 1, borderRadius: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 14, elevation: 5 },
  navPriGrad: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 16, paddingHorizontal: 8 },
  navPriText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  navPriTextPay: { letterSpacing: 0.2, fontSize: 12, flexShrink: 1 },
  navSec: { flex: 1, padding: 16, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  navSecText: { color: COLORS.textMuted, fontFamily: FONT.bold, letterSpacing: 0.8, fontSize: 13 },

  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  modalHead: { alignItems: "center", padding: 20, borderRadius: 18, marginBottom: 16, overflow: "hidden" },
  modalHeadIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold },
  modalSub: { color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 4, fontFamily: FONT.medium, fontSize: 12 },
  timerBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16, backgroundColor: "#FFF7ED", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#FED7AA" },
  timerText: { color: COLORS.warning, fontSize: 22, fontFamily: FONT.extrabold, letterSpacing: 1 },
  timerLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  qrBox: { backgroundColor: "#FFFFFF", padding: 32, borderRadius: 20, alignItems: "center", marginBottom: 16, borderWidth: 2, borderColor: COLORS.border, borderStyle: "dashed" },
  qrCode: { color: COLORS.text, fontSize: 11, marginTop: 12, letterSpacing: 1, fontFamily: FONT.bold },
  payBreakdown: { width: "100%", paddingHorizontal: 8 },
  payTotal: { color: COLORS.text, fontSize: 26, fontFamily: FONT.extrabold, textAlign: "center", marginBottom: 20 },
  payBtn: { borderRadius: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  payBtnGrad: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 16 },
  cancelBtn: { padding: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.textDim, fontFamily: FONT.medium },
});
