import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Switch, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api, COLORS, FONT, tanggal, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

const LOCATION_PUSH_INTERVAL_MS = 8000;

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: COLORS.success, bg: "#ECFDF5", label: "STREETBARBER AKTIF" },
  rejected: { color: COLORS.error, bg: "#FEF2F2", label: "DITOLAK" },
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "MENUNGGU VALIDASI" },
  seleksi_berkas_lolos: { color: COLORS.info, bg: "#EFF8FF", label: "BERKAS LOLOS" },
  menunggu_tes: { color: COLORS.info, bg: "#EFF8FF", label: "MENUNGGU TES" },
};

const FUND_STATE_META: Record<string, { color: string; bg: string; label: string }> = {
  unpaid: { color: COLORS.textDim, bg: COLORS.border, label: "Belum Dibayar" },
  held: { color: COLORS.warning, bg: "#FFF7ED", label: "Dana Ditahan Platform" },
  released: { color: COLORS.success, bg: "#ECFDF5", label: "Dana Sudah Cair" },
  refunded: { color: COLORS.error, bg: "#FEF2F2", label: "Dikembalikan ke Customer" },
};

const LEDGER_LABEL: Record<string, string> = {
  payment_in: "Pembayaran Masuk (Ditahan)",
  platform_commission: "Komisi Platform",
  barber_payout: "Dana Cair ke Dompet",
  payment_fee: "Biaya Pembayaran",
  refund: "Pengembalian Dana",
  withdrawal: "Penarikan Saldo",
};

export default function KaryawanStatus() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [selShop, setSelShop] = useState<any>(null);
  const [form, setForm] = useState({ portfolio_url: "", work_experience: "", certificates: "" });
  const [ktpPhoto, setKtpPhoto] = useState("");
  const [diplomaPhoto, setDiplomaPhoto] = useState("");
  const [criteriaAgreed, setCriteriaAgreed] = useState(false);
  const [applyErr, setApplyErr] = useState("");
  const [applying, setApplying] = useState(false);
  const { scrollRef, handleFocus } = useScrollToInput();
  const [loading, setLoading] = useState(true);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locError, setLocError] = useState("");
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPushRef = useRef(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const stopSharing = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setSharingLocation(false);
    if (lastCoordsRef.current) {
      try { await api.post("/karyawan/location", { ...lastCoordsRef.current, is_online: false }); } catch {}
    }
  }, []);

  const startSharing = useCallback(async () => {
    setLocError("");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setLocError("Izin lokasi ditolak"); return; }
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: LOCATION_PUSH_INTERVAL_MS, distanceInterval: 20 },
      async (loc) => {
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        lastCoordsRef.current = coords;
        const now = Date.now();
        if (now - lastPushRef.current < LOCATION_PUSH_INTERVAL_MS - 500) return;
        lastPushRef.current = now;
        try { await api.post("/karyawan/location", { ...coords, is_online: true }); } catch {}
      }
    );
    setSharingLocation(true);
  }, []);

  const toggleSharing = async (value: boolean) => {
    if (value) await startSharing(); else await stopSharing();
  };

  useEffect(() => () => { watchRef.current?.remove(); }, []);

  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<{ monthly_revenue: number; completed_count: number } | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [walletModal, setWalletModal] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [payingOut, setPayingOut] = useState(false);

  // Layanan, jadwal & rekening milik StreetBarber sendiri — mandiri dari toko validator.
  const [servicesModal, setServicesModal] = useState(false);
  const [myServices, setMyServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: "", duration: "30", price: "" });
  const [editingSvcId, setEditingSvcId] = useState<string | null>(null);
  const [savingSvc, setSavingSvc] = useState(false);

  const DAY_ROWS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
  const [scheduleModal, setScheduleModal] = useState(false);
  const [mySchedule, setMySchedule] = useState<Record<string, { open_time: string; close_time: string; is_closed: boolean }>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [bankModal, setBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", account_holder: "" });
  const [homeFeeInput, setHomeFeeInput] = useState("0");
  const [savingBank, setSavingBank] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [my, sh] = await Promise.allSettled([
        api.get("/karyawan/my"),
        api.get("/shops?sort=rating"),
      ]);
      if (my.status === "fulfilled") {
        setApps(my.value.applications);
        const active = (my.value.applications || []).find((a: any) => a.status === "active");
        if (active) {
          setBankForm({
            bank_name: active.bank_name || "", account_number: active.bank_account_number || "",
            account_holder: active.bank_account_holder || "",
          });
          setHomeFeeInput(String(active.home_service_fee ?? 0));
        }
      }
      if (sh.status === "fulfilled") setShops(sh.value.shops);
      const [bk, earn, w] = await Promise.allSettled([
        api.get("/karyawan/bookings"),
        api.get("/karyawan/earnings"),
        api.get("/wallets/me"),
      ]);
      if (bk.status === "fulfilled") setMyBookings(bk.value.bookings); else setMyBookings([]);
      if (earn.status === "fulfilled") setEarnings(earn.value); else setEarnings(null);
      if (w.status === "fulfilled") setWallet(w.value.wallet); else setWallet(null);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const completeBooking = async (id: string) => {
    setCompletingId(id);
    try {
      await api.post(`/karyawan/bookings/${id}/complete`);
      await load();
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyelesaikan pesanan"); } finally { setCompletingId(null); }
  };

  const openWallet = async () => {
    setWalletModal(true);
    setLoadingLedger(true);
    try { const r = await api.get("/wallets/me/ledger"); setLedger(r.entries || []); } catch {} finally { setLoadingLedger(false); }
  };

  const doPayout = async () => {
    setPayingOut(true);
    try {
      const r = await api.post("/payouts");
      Alert.alert("Penarikan Diajukan", `${rupiah(r.amount)} akan diproses tim secara manual (belum ada transfer otomatis).`);
      try { const w = await api.get("/wallets/me"); setWallet(w.wallet); } catch {}
      setLedger([]);
      setWalletModal(false);
    } catch (e: any) { Alert.alert("Penarikan Gagal", e.message); } finally { setPayingOut(false); }
  };

  const openServices = async () => {
    setServicesModal(true);
    setLoadingServices(true);
    try { const r = await api.get("/streetbarber/services"); setMyServices(r.services || []); } catch {} finally { setLoadingServices(false); }
  };

  const resetSvcForm = () => { setSvcForm({ name: "", duration: "30", price: "" }); setEditingSvcId(null); };

  const editService = (s: any) => {
    setEditingSvcId(s.id);
    setSvcForm({ name: s.name, duration: String(s.duration), price: String(s.price) });
  };

  const saveService = async () => {
    if (!svcForm.name.trim()) return Alert.alert("Gagal", "Nama layanan wajib diisi");
    const body = { name: svcForm.name.trim(), duration: parseInt(svcForm.duration || "0", 10), price: parseInt(svcForm.price || "0", 10) };
    if (!body.duration || !body.price) return Alert.alert("Gagal", "Durasi & harga wajib diisi dengan angka");
    setSavingSvc(true);
    try {
      if (editingSvcId) await api.put(`/streetbarber/services/${editingSvcId}`, body);
      else await api.post("/streetbarber/services", body);
      resetSvcForm();
      const r = await api.get("/streetbarber/services"); setMyServices(r.services || []);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan layanan"); } finally { setSavingSvc(false); }
  };

  const deleteService = async (sid: string) => {
    try {
      await api.del(`/streetbarber/services/${sid}`);
      setMyServices((prev) => prev.filter((s) => s.id !== sid));
      if (editingSvcId === sid) resetSvcForm();
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menghapus layanan"); }
  };

  const openSchedule = async () => {
    setScheduleModal(true);
    setLoadingSchedule(true);
    try {
      const r = await api.get("/streetbarber/schedules");
      const byDay: Record<string, any> = {};
      for (const row of r.schedules || []) byDay[row.day_name] = row;
      const merged: typeof mySchedule = {};
      for (const d of DAY_ROWS) {
        merged[d] = byDay[d]
          ? { open_time: byDay[d].open_time, close_time: byDay[d].close_time, is_closed: byDay[d].is_closed }
          : { open_time: "09:00", close_time: "21:00", is_closed: false };
      }
      setMySchedule(merged);
    } catch {} finally { setLoadingSchedule(false); }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const schedules = DAY_ROWS.map((d) => ({ day_name: d, ...mySchedule[d] }));
      await api.post("/streetbarber/schedules", { schedules });
      setScheduleModal(false);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan jadwal"); } finally { setSavingSchedule(false); }
  };

  const saveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_number.trim() || !bankForm.account_holder.trim()) {
      return Alert.alert("Gagal", "Semua kolom rekening wajib diisi");
    }
    setSavingBank(true);
    try {
      await api.put("/streetbarber/bank-account", bankForm);
      await api.put("/streetbarber/home-service-fee", { fee: parseInt(homeFeeInput || "0", 10) });
      setBankModal(false);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan data"); } finally { setSavingBank(false); }
  };

  const pickPhoto = async (target: "ktp" | "diploma") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
    if (target === "ktp") setKtpPhoto(uri); else setDiplomaPhoto(uri);
  };

  const resetApplyForm = () => {
    setForm({ portfolio_url: "", work_experience: "", certificates: "" });
    setKtpPhoto(""); setDiplomaPhoto(""); setCriteriaAgreed(false); setApplyErr("");
  };

  const apply = async () => {
    if (!selShop) return;
    setApplyErr("");
    if (!ktpPhoto) return setApplyErr("Foto KTP wajib diunggah");
    if (form.work_experience.trim().length < 20) return setApplyErr("Pengalaman kerja wajib diisi minimal 20 karakter");
    if (!criteriaAgreed) return setApplyErr("Anda harus menyetujui kriteria platform");
    setApplying(true);
    try {
      await api.post("/karyawan/apply", { shop_id: selShop.id, ...form, ktp_photo: ktpPhoto, diploma_photo: diplomaPhoto, criteria_agreed: criteriaAgreed });
      setShowApply(false); resetApplyForm(); await load();
    } catch (e: any) { setApplyErr(e.message || "Gagal mengirim lamaran"); }
    setApplying(false);
  };
  const doLogout = async () => { await logout(); router.replace("/(auth)/login"); };

  const appliedShopIds = useMemo(() => new Set(apps.map((a) => a.shop_id)), [apps]);
  const availableShops = useMemo(() => shops.filter((s) => !appliedShopIds.has(s.id)), [shops, appliedShopIds]);

  const hasActive = useMemo(() => apps.some((a) => a.status === "active"), [apps]);
  const hasPendingTest = useMemo(() => apps.some((a) => ["menunggu_tes", "seleksi_berkas_lolos"].includes(a.status)), [apps]);
  const hasPending = useMemo(() => apps.some((a) => a.status === "pending"), [apps]);

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 12, width: 90, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 20, width: 150, marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 76 }} />
        <Skeleton style={{ height: 130 }} />
        <Skeleton style={{ height: 130 }} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <View style={{ flex: 1 }}>
          <View style={styles.brandBadge}>
            <Ionicons name="cut" size={12} color={COLORS.gold} />
            <Text style={styles.brandBadgeText}>STREETBARBER PORTAL</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name}</Text>
          <Text style={styles.headerSub}>{user?.email}</Text>
        </View>
        <PressableScale onPress={doLogout} testID="k-logout" style={styles.logoutBtn} scaleTo={0.88} haptic>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
        </PressableScale>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {!hasActive && hasPendingTest && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingIcon}>
              <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Berkas Lolos — Menunggu Tes Keterampilan</Text>
              <Text style={styles.pendingSub}>Validator akan menghubungimu lewat chat untuk menjadwalkan tes keterampilan. Fitur pesanan &amp; bagikan lokasi otomatis aktif begitu kamu lulus.</Text>
            </View>
          </View>
        )}
        {!hasActive && !hasPendingTest && hasPending && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingIcon}>
              <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Mohon Tunggu</Text>
              <Text style={styles.pendingSub}>Mohon tunggu. Anda sedang dalam proses validasi oleh validator.</Text>
            </View>
          </View>
        )}

        {hasActive && earnings && (
          <LinearGradient
            colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.earningsCard}
          >
            <View pointerEvents="none" style={styles.earningsDeco} />
            <View style={styles.earningsIcon}><Ionicons name="cash" size={20} color={COLORS.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsLabel}>Pendapatan Bulan Ini</Text>
              <Text style={styles.earningsValue}>{rupiah(earnings.monthly_revenue)}</Text>
              <Text style={styles.earningsHint}>{earnings.completed_count} booking terbayar</Text>
            </View>
          </LinearGradient>
        )}

        {apps.some((a) => a.status === "active") && wallet && (
          <PressableScale onPress={openWallet} scaleTo={0.98} testID="open-wallet">
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.earningsCard}
            >
              <View pointerEvents="none" style={styles.earningsDeco} />
              <View style={styles.earningsIcon}><Ionicons name="wallet" size={20} color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningsLabel}>Dompet Saya</Text>
                <Text style={styles.earningsValue}>{rupiah(wallet.balance_available || 0)}</Text>
                <Text style={styles.earningsHint}>{rupiah(wallet.balance_pending || 0)} masih ditahan platform · Ketuk untuk detail</Text>
              </View>
            </LinearGradient>
          </PressableScale>
        )}

        {apps.some((a) => a.status === "active") && (
          <View style={[styles.locCard, sharingLocation && styles.locCardActive]}>
            <View style={[styles.locIcon, sharingLocation && { backgroundColor: COLORS.brand }]}>
              <Ionicons name={sharingLocation ? "navigate" : "navigate-outline"} size={18} color={sharingLocation ? "#FFFFFF" : COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locTitle}>Bagikan Lokasi Real-Time</Text>
              <Text style={styles.locSub}>
                {sharingLocation
                  ? "Aktif — pelanggan bisa menemukanmu di sekitar mereka"
                  : "Aktifkan saat kamu sedang bekerja, tetap buka aplikasi"}
              </Text>
              {!!locError && <Text style={styles.locErrorText}>{locError}</Text>}
            </View>
            <Switch value={sharingLocation} onValueChange={toggleSharing} trackColor={{ true: COLORS.brand }} testID="location-share-toggle" />
          </View>
        )}

        {hasActive && (
          <>
            <PressableScale style={styles.manageRow} onPress={openServices} testID="open-services" scaleTo={0.97}>
              <View style={styles.locIcon}><Ionicons name="cut-outline" size={18} color={COLORS.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locTitle}>Kelola Layanan</Text>
                <Text style={styles.locSub}>Atur sendiri layanan & harga panggilan ke rumahmu</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
            </PressableScale>
            <PressableScale style={styles.manageRow} onPress={openSchedule} testID="open-schedule" scaleTo={0.97}>
              <View style={styles.locIcon}><Ionicons name="calendar-outline" size={18} color={COLORS.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locTitle}>Atur Jadwal</Text>
                <Text style={styles.locSub}>Jam kerja mingguan & tanggal libur milikmu sendiri</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
            </PressableScale>
            <PressableScale style={styles.manageRow} onPress={() => setBankModal(true)} testID="open-bank" scaleTo={0.97}>
              <View style={styles.locIcon}><Ionicons name="card-outline" size={18} color={COLORS.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locTitle}>Rekening & Biaya</Text>
                <Text style={styles.locSub}>
                  {bankForm.bank_name ? `${bankForm.bank_name} a.n. ${bankForm.account_holder}` : "Belum diisi — tambahkan rekening tujuan pencairan"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
            </PressableScale>
          </>
        )}

        {myBookings.length > 0 && (
          <>
            <Text style={styles.sec}>PESANAN SAYA</Text>
            {myBookings.map((b: any) => (
              <View key={b.id} style={styles.appCard}>
                <View style={styles.rowTop}>
                  <View style={styles.bookingIcon}><Ionicons name="cut" size={18} color={COLORS.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cName}>{b.customer?.name}</Text>
                    <Text style={styles.cMeta}>{b.service?.name} · {b.shop?.name}</Text>
                    <Text style={styles.cMeta}>{tanggal(b.booking_date)} · {b.booking_time} WITA</Text>
                  </View>
                  {b.fund_state && FUND_STATE_META[b.fund_state] && (
                    <View style={[styles.badge, { backgroundColor: FUND_STATE_META[b.fund_state].bg }]}>
                      <Text style={[styles.badgeText, { color: FUND_STATE_META[b.fund_state].color }]}>{FUND_STATE_META[b.fund_state].label}</Text>
                    </View>
                  )}
                </View>
                <PressableScale style={styles.chatBtnWrap} onPress={() => router.push(`/chat/booking/${b.id}` as any)} testID={`booking-chat-${b.id}`} scaleTo={0.96}>
                  <LinearGradient
                    colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chatBtn}
                  >
                    <Ionicons name="chatbubbles" size={14} color="#FFFFFF" />
                    <Text style={styles.chatBtnText}>CHAT DENGAN PELANGGAN</Text>
                  </LinearGradient>
                </PressableScale>
                {b.delivery_mode === "rumah" && b.status === "confirmed" && (
                  <PressableScale
                    style={[styles.chatBtnWrap, completingId === b.id && { opacity: 0.6 }]}
                    onPress={() => completeBooking(b.id)}
                    disabled={completingId === b.id}
                    testID={`booking-complete-${b.id}`}
                    scaleTo={0.96}
                  >
                    <LinearGradient colors={["#16A34A", "#22C55E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chatBtn}>
                      <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                      <Text style={styles.chatBtnText}>{completingId === b.id ? "..." : "SELESAI"}</Text>
                    </LinearGradient>
                  </PressableScale>
                )}
              </View>
            ))}
          </>
        )}

        <Text style={styles.sec}>LAMARAN SAYA</Text>
        {apps.length === 0 && (
          <EmptyState
            icon="briefcase-outline"
            title="Belum ada lamaran"
            description="Pilih toko validator di bawah untuk mulai mendaftar sebagai StreetBarber."
          />
        )}
        {apps.map((a: any) => {
          const meta = STATUS_META[a.status] || STATUS_META.pending;
          return (
            <View key={a.id} style={styles.appCard}>
              <View style={styles.rowTop}>
                <Image source={{ uri: a.shop?.image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cName}>{a.shop?.name}</Text>
                  <Text style={styles.cMeta}>Skor: {a.total_score}/120</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              {a.status === "active" && (
                <View style={styles.congrats}>
                  <View style={styles.trophyWrap}><Ionicons name="trophy" size={14} color={COLORS.success} /></View>
                  <Text style={styles.congratsText}>Anda resmi menjadi StreetBarber, tervalidasi oleh toko ini!</Text>
                </View>
              )}
              {["menunggu_tes", "seleksi_berkas_lolos", "active"].includes(a.status) && (
                <PressableScale style={styles.chatBtnWrap} onPress={() => router.push(`/chat/recruitment/${a.id}` as any)} testID={`recruitment-chat-${a.id}`} scaleTo={0.96}>
                  <LinearGradient
                    colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chatBtn}
                  >
                    <Ionicons name="chatbubbles" size={14} color="#FFFFFF" />
                    <Text style={styles.chatBtnText}>CHAT DENGAN VALIDATOR</Text>
                  </LinearGradient>
                </PressableScale>
              )}
              {a.status === "rejected" && (
                <PressableScale
                  style={styles.reapplyBtnWrap}
                  testID={`reapply-${a.id}`}
                  scaleTo={0.96}
                  onPress={() => {
                    if (availableShops.length === 0) { setApplyErr(""); alert("Belum ada toko validator lain yang tersedia saat ini."); return; }
                    setSelShop(availableShops[0]); setShowApply(true);
                  }}
                >
                  <Ionicons name="refresh" size={14} color={COLORS.brand} />
                  <Text style={styles.reapplyBtnText}>Ajukan Lamaran Baru</Text>
                </PressableScale>
              )}
            </View>
          );
        })}

        <Text style={styles.sec}>PILIH TOKO VALIDATOR</Text>
        {availableShops.length === 0 && <Text style={styles.empty}>Anda sudah melamar ke semua toko.</Text>}
        {availableShops.map((s: any) => (
          <PressableScale key={s.id} style={styles.shopRow} testID={`apply-shop-${s.id}`} onPress={() => { setSelShop(s); setShowApply(true); }} scaleTo={0.98}>
            <Image source={{ uri: s.image }} style={styles.shopImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{s.name}</Text>
              <Text style={styles.cMeta} numberOfLines={1}>{s.address}</Text>
              <View style={styles.starRow}>
                <Ionicons name="star" size={11} color={COLORS.gold} />
                <Text style={styles.starText}>{s.rating?.toFixed(1)} · {s.reviews_count} ulasan</Text>
              </View>
            </View>
            <View style={styles.shopChevron}><Ionicons name="chevron-forward" size={18} color={COLORS.brand} /></View>
          </PressableScale>
        ))}
      </ScrollView>

      <Modal visible={showApply} transparent animationType="slide" onRequestClose={() => setShowApply(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modal, { maxHeight: "85%" }]}>
            <View style={styles.grabber} />
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalHead}
              >
                <View style={styles.modalHeadIcon}><Ionicons name="briefcase" size={20} color={COLORS.brand} /></View>
                <Text style={styles.modalTitle}>Ajukan Diri sebagai StreetBarber</Text>
                <Text style={styles.modalSub}>Divalidasi oleh {selShop?.name}</Text>
              </LinearGradient>

              <Text style={styles.label}>Foto KTP *</Text>
              <PressableScale style={styles.photoPick} onPress={() => pickPhoto("ktp")} testID="pick-ktp" scaleTo={0.99}>
                {ktpPhoto ? (
                  <Image source={{ uri: ktpPhoto }} style={styles.photoPreview} contentFit="cover" />
                ) : (
                  <>
                    <View style={styles.photoIcon}><Ionicons name="camera-outline" size={20} color={COLORS.brand} /></View>
                    <Text style={styles.photoPickText}>Unggah foto KTP</Text>
                  </>
                )}
              </PressableScale>

              <Text style={styles.label}>Pengalaman Kerja * (min. 20 karakter)</Text>
              <TextInput style={[styles.input, { minHeight: 70 }]} multiline placeholder="Ceritakan pengalaman kerjamu, mis. 2 tahun di Barber X sebagai..." placeholderTextColor={COLORS.textDim} value={form.work_experience} onChangeText={(t) => setForm({ ...form, work_experience: t })} onFocus={handleFocus} testID="apply-experience" />

              <Text style={styles.label}>URL Portofolio (opsional)</Text>
              <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={COLORS.textDim} value={form.portfolio_url} onChangeText={(t) => setForm({ ...form, portfolio_url: t })} onFocus={handleFocus} autoCapitalize="none" />

              <Text style={styles.label}>Sertifikat (opsional)</Text>
              <TextInput style={styles.input} placeholder="BNSP, kursus, dll" placeholderTextColor={COLORS.textDim} value={form.certificates} onChangeText={(t) => setForm({ ...form, certificates: t })} onFocus={handleFocus} />

              <PressableScale style={styles.agreeRow} onPress={() => setCriteriaAgreed((v) => !v)} testID="criteria-agree" scaleTo={0.99}>
                <View style={[styles.checkBox, criteriaAgreed && { backgroundColor: COLORS.brand, borderColor: COLORS.brand }]}>
                  {criteriaAgreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.agreeText}>Saya menyetujui kriteria seleksi platform PangkasKAKA</Text>
              </PressableScale>

              {!!applyErr && (
                <View style={styles.applyErrBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.applyErrText} testID="apply-error">{applyErr}</Text>
                </View>
              )}

              <PressableScale style={[styles.btnWrap, applying && { opacity: 0.6 }]} onPress={apply} disabled={applying} testID="submit-apply" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  {applying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>KIRIM LAMARAN</Text>}
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={() => { setShowApply(false); resetApplyForm(); }} style={styles.cancelBtn} scaleTo={0.97}>
                <Text style={styles.cancelText}>Batal</Text>
              </PressableScale>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={walletModal} transparent animationType="slide" onRequestClose={() => setWalletModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: "85%" }]}>
            <View style={styles.grabber} />
            <Text style={styles.sec}>DOMPET SAYA</Text>
            <View style={styles.walletBalRow}>
              <View style={styles.walletBalBox}>
                <Text style={styles.walletBalLabel}>Ditahan Platform</Text>
                <Text style={styles.walletBalValue}>{rupiah(wallet?.balance_pending || 0)}</Text>
              </View>
              <View style={styles.walletBalBox}>
                <Text style={styles.walletBalLabel}>Bisa Ditarik</Text>
                <Text style={styles.walletBalValue}>{rupiah(wallet?.balance_available || 0)}</Text>
              </View>
            </View>
            {bankForm.bank_name ? (
              <Text style={styles.payoutDestText}>
                Akan dicairkan ke {bankForm.bank_name} a.n. {bankForm.account_holder} — {bankForm.account_number}
              </Text>
            ) : (
              <Text style={[styles.payoutDestText, { color: COLORS.error }]}>
                Rekening tujuan belum diisi — atur dulu di "Rekening & Biaya"
              </Text>
            )}
            <PressableScale
              style={[styles.btnWrap, styles.payoutBtn, (payingOut || (wallet?.balance_available || 0) < 50000) && { opacity: 0.5 }]}
              onPress={doPayout}
              disabled={payingOut || (wallet?.balance_available || 0) < 50000}
              testID="request-payout"
            >
              <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                <Text style={styles.btnText}>{payingOut ? "..." : "TARIK SALDO"}</Text>
              </LinearGradient>
            </PressableScale>
            {(wallet?.balance_available || 0) < 50000 && (
              <Text style={styles.walletMinHint}>Minimum penarikan Rp50.000</Text>
            )}
            <Text style={[styles.sec, { marginTop: 16 }]}>RIWAYAT DOMPET</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {loadingLedger ? (
                <Skeleton style={{ height: 60 }} />
              ) : ledger.length === 0 ? (
                <Text style={styles.walletEmpty}>Belum ada riwayat</Text>
              ) : ledger.map((l: any) => (
                <View key={l.id} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerMemo}>{LEDGER_LABEL[l.entry_type] || l.entry_type}</Text>
                    <Text style={styles.ledgerDate}>{new Date(l.created_at).toLocaleString("id-ID")}</Text>
                  </View>
                  <Text style={[styles.ledgerAmount, { color: l.direction === "credit" ? COLORS.success : COLORS.error }]}>
                    {l.direction === "credit" ? "+" : "-"}{rupiah(l.amount)}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <PressableScale style={styles.cancelBtn} onPress={() => setWalletModal(false)}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <Modal visible={servicesModal} transparent animationType="slide" onRequestClose={() => setServicesModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modal, { maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            <Text style={styles.sec}>KELOLA LAYANAN</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nama Layanan</Text>
              <TextInput style={styles.input} placeholder="mis. Low Fade" placeholderTextColor={COLORS.textDim} value={svcForm.name} onChangeText={(t) => setSvcForm({ ...svcForm, name: t })} testID="svc-name-input" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Durasi (menit)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="30" placeholderTextColor={COLORS.textDim} value={svcForm.duration} onChangeText={(t) => setSvcForm({ ...svcForm, duration: t.replace(/[^0-9]/g, "") })} testID="svc-duration-input" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Harga (Rp)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="15000" placeholderTextColor={COLORS.textDim} value={svcForm.price} onChangeText={(t) => setSvcForm({ ...svcForm, price: t.replace(/[^0-9]/g, "") })} testID="svc-price-input" />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <PressableScale style={[styles.btnWrap, { flex: 1, marginTop: 0 }, savingSvc && { opacity: 0.6 }]} onPress={saveService} disabled={savingSvc} testID="svc-save">
                  <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                    <Text style={styles.btnText}>{savingSvc ? "..." : editingSvcId ? "SIMPAN PERUBAHAN" : "TAMBAH LAYANAN"}</Text>
                  </LinearGradient>
                </PressableScale>
                {editingSvcId && (
                  <PressableScale style={[styles.cancelBtn, { marginTop: 0 }]} onPress={resetSvcForm}>
                    <Text style={styles.cancelText}>Batal</Text>
                  </PressableScale>
                )}
              </View>

              <Text style={[styles.sec, { marginTop: 20 }]}>LAYANAN AKTIF</Text>
              {loadingServices ? (
                <Skeleton style={{ height: 60 }} />
              ) : myServices.length === 0 ? (
                <Text style={styles.walletEmpty}>Belum ada layanan. Tambahkan di atas.</Text>
              ) : myServices.map((s: any) => (
                <View key={s.id} style={styles.appCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.bookingIcon}><Ionicons name="cut" size={18} color={COLORS.brand} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cName}>{s.name}</Text>
                      <Text style={styles.cMeta}>{s.duration} menit · {rupiah(s.price)}</Text>
                    </View>
                    <PressableScale onPress={() => editService(s)} style={styles.svcActionBtn} testID={`svc-edit-${s.id}`}>
                      <Ionicons name="pencil" size={16} color={COLORS.brand} />
                    </PressableScale>
                    <PressableScale onPress={() => deleteService(s.id)} style={styles.svcActionBtn} testID={`svc-delete-${s.id}`}>
                      <Ionicons name="trash" size={16} color={COLORS.error} />
                    </PressableScale>
                  </View>
                </View>
              ))}
            </ScrollView>
            <PressableScale style={styles.cancelBtn} onPress={() => { setServicesModal(false); resetSvcForm(); }}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={scheduleModal} transparent animationType="slide" onRequestClose={() => setScheduleModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            <Text style={styles.sec}>ATUR JADWAL KERJA</Text>
            {loadingSchedule ? (
              <Skeleton style={{ height: 200 }} />
            ) : (
              <ScrollView>
                {DAY_ROWS.map((d) => {
                  const row = mySchedule[d] || { open_time: "09:00", close_time: "21:00", is_closed: false };
                  return (
                    <View key={d} style={styles.dayRow}>
                      <View style={styles.dayRowTop}>
                        <Text style={styles.dayName}>{d}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.dayLiburLabel}>Libur</Text>
                          <Switch
                            value={row.is_closed}
                            onValueChange={(v) => setMySchedule({ ...mySchedule, [d]: { ...row, is_closed: v } })}
                            trackColor={{ true: COLORS.brand }}
                            testID={`sched-closed-${d}`}
                          />
                        </View>
                      </View>
                      {!row.is_closed && (
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="09:00"
                            placeholderTextColor={COLORS.textDim}
                            value={row.open_time}
                            onChangeText={(t) => setMySchedule({ ...mySchedule, [d]: { ...row, open_time: t } })}
                            testID={`sched-open-${d}`}
                          />
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="21:00"
                            placeholderTextColor={COLORS.textDim}
                            value={row.close_time}
                            onChangeText={(t) => setMySchedule({ ...mySchedule, [d]: { ...row, close_time: t } })}
                            testID={`sched-close-${d}`}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <PressableScale style={[styles.btnWrap, savingSchedule && { opacity: 0.6 }]} onPress={saveSchedule} disabled={savingSchedule} testID="save-schedule">
              <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                <Text style={styles.btnText}>{savingSchedule ? "..." : "SIMPAN JADWAL"}</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale style={styles.cancelBtn} onPress={() => setScheduleModal(false)}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <Modal visible={bankModal} transparent animationType="slide" onRequestClose={() => setBankModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modal, { maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sec}>REKENING & BIAYA KE RUMAH</Text>
              <Text style={styles.dayLiburLabel}>Rekening ini jadi tujuan saat kamu menarik saldo dompet — tim mencairkan secara manual ke sini (belum ada transfer otomatis).</Text>
              <Text style={styles.label}>Nama Bank</Text>
              <TextInput style={styles.input} placeholder="mis. BRI" placeholderTextColor={COLORS.textDim} value={bankForm.bank_name} onChangeText={(t) => setBankForm({ ...bankForm, bank_name: t })} testID="bank-name-input" />
              <Text style={styles.label}>Nomor Rekening</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="1234567890" placeholderTextColor={COLORS.textDim} value={bankForm.account_number} onChangeText={(t) => setBankForm({ ...bankForm, account_number: t })} testID="bank-number-input" />
              <Text style={styles.label}>Nama Pemilik Rekening</Text>
              <TextInput style={styles.input} placeholder="Nama sesuai buku tabungan" placeholderTextColor={COLORS.textDim} value={bankForm.account_holder} onChangeText={(t) => setBankForm({ ...bankForm, account_holder: t })} testID="bank-holder-input" />
              <Text style={styles.label}>Biaya Layanan ke Rumah (Rp)</Text>
              <Text style={[styles.dayLiburLabel, { marginBottom: 6 }]}>Ditambahkan ke harga layanan saat customer booking panggilan ke rumah.</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={homeFeeInput} onChangeText={(t) => setHomeFeeInput(t.replace(/[^0-9]/g, ""))} testID="home-fee-input" />
              <PressableScale style={[styles.btnWrap, savingBank && { opacity: 0.6 }]} onPress={saveBank} disabled={savingBank} testID="save-bank">
                <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                  <Text style={styles.btnText}>{savingBank ? "..." : "SIMPAN"}</Text>
                </LinearGradient>
              </PressableScale>
            </ScrollView>
            <PressableScale style={styles.cancelBtn} onPress={() => setBankModal(false)}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -70, right: -40 },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  brandBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold, marginTop: 8 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  logoutBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },
  earningsCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 20, marginBottom: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6 },
  earningsDeco: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30 },
  earningsIcon: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  earningsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: FONT.semibold },
  earningsValue: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  earningsHint: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: FONT.medium, marginTop: 2 },
  locCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  locCardActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  locIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  locTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  locSub: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  locErrorText: { color: COLORS.error, fontSize: 11, marginTop: 4, fontFamily: FONT.semibold },
  manageRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  payoutDestText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, textAlign: "center", marginTop: 10, lineHeight: 15 },
  svcActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  dayRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dayRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  dayLiburLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  pendingBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFF7ED", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#FDE4C4", marginBottom: 16 },
  pendingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pendingTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  pendingSub: { color: COLORS.textDim, fontSize: 12, marginTop: 3, fontFamily: FONT.medium, lineHeight: 17 },
  appCard: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  bookingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  thumb: { width: 52, height: 52, borderRadius: 13 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.5 },
  empty: { color: COLORS.textDim, textAlign: "center", fontFamily: FONT.medium, fontSize: 13, marginTop: 8 },
  congrats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, backgroundColor: "#ECFDF5", borderRadius: 12 },
  trophyWrap: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  congratsText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },
  chatBtnWrap: { borderRadius: 11, marginTop: 10, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 },
  chatBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 10 },
  chatBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.4 },
  reapplyBtnWrap: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  reapplyBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.4 },
  shopRow: {
    flexDirection: "row", gap: 12, padding: 12, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, alignItems: "center",
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  shopImg: { width: 60, height: 60, borderRadius: 12 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  starText: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  shopChevron: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  modalHead: { alignItems: "center", padding: 16, borderRadius: 18, marginBottom: 4, overflow: "hidden" },
  modalHeadIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 2, fontFamily: FONT.medium, fontSize: 12 },
  label: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  input: {
    backgroundColor: COLORS.surface2, color: COLORS.text, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14,
  },
  btnWrap: { borderRadius: 14, marginTop: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
  photoPick: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface2,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 14, height: 90, overflow: "hidden",
  },
  photoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  photoPickText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  photoPreview: { width: "100%", height: "100%" },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  checkBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  agreeText: { flex: 1, color: COLORS.text, fontFamily: FONT.medium, fontSize: 12, lineHeight: 17 },
  applyErrBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  applyErrText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 12 },
  cancelBtn: { padding: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.textDim, fontFamily: FONT.medium },

  walletBalRow: { flexDirection: "row", gap: 10 },
  walletBalBox: { flex: 1, backgroundColor: COLORS.surface2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  walletBalLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  walletBalValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, marginTop: 4 },
  payoutBtn: { marginTop: 14 },
  walletMinHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, textAlign: "center", marginTop: 6 },
  walletEmpty: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, paddingVertical: 10 },
  ledgerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  ledgerMemo: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13 },
  ledgerDate: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
  ledgerAmount: { fontFamily: FONT.extrabold, fontSize: 13 },
});