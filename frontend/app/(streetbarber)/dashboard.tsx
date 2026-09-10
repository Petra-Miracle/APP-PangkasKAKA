import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import Skeleton from "@/src/components/Skeleton";

const LOCATION_PUSH_INTERVAL_MS = 8000;

export default function StreetBarberDashboard() {
  const { user } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locError, setLocError] = useState("");
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPushRef = useRef(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [earnings, setEarnings] = useState<{ monthly_revenue: number; completed_count: number } | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any>(null);
  const { scrollRef, handleFocus } = useScrollToInput();

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [my, sh] = await Promise.allSettled([
        api.get("/karyawan/my"),
        api.get("/shops?sort=rating"),
      ]);
      if (my.status === "fulfilled") setApps(my.value.applications);
      if (sh.status === "fulfilled") setShops(sh.value.shops);
      const [earn, w, bk] = await Promise.allSettled([
        api.get("/karyawan/earnings"),
        api.get("/wallets/me"),
        api.get("/karyawan/bookings"),
      ]);
      if (earn.status === "fulfilled") setEarnings(earn.value); else setEarnings(null);
      if (w.status === "fulfilled") setWallet(w.value.wallet); else setWallet(null);
      // Preview read-only 1 pesanan mendatang terdekat (tanpa endpoint baru).
      if (bk.status === "fulfilled") {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const list = ((bk.value as any).bookings || []).filter((b: any) => b.status === "confirmed");
        list.sort((a: any, b: any) => `${a.booking_date} ${a.booking_time}`.localeCompare(`${b.booking_date} ${b.booking_time}`));
        setUpcoming(list.find((b: any) => new Date(`${b.booking_date}T00:00:00`) >= today) || null);
      } else setUpcoming(null);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasActive = useMemo(() => apps.some((a) => a.status === "active"), [apps]);
  const hasPendingTest = useMemo(() => apps.some((a) => ["menunggu_tes", "seleksi_berkas_lolos"].includes(a.status)), [apps]);
  const hasPending = useMemo(() => apps.some((a) => a.status === "pending"), [apps]);
  const rejectedOnly = useMemo(
    () => apps.length > 0 && !hasActive && !hasPendingTest && !hasPending, [apps, hasActive, hasPendingTest, hasPending]);
  const latestApp = useMemo(() => {
    const sorted = [...apps].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return sorted.find((a) => a.status !== "rejected") || sorted[0] || null;
  }, [apps]);
  const inProcess = !hasActive && (hasPending || hasPendingTest);
  const appliedShopIds = useMemo(() => new Set(apps.map((a) => a.shop_id)), [apps]);
  const availableShops = useMemo(() => shops.filter((s) => !appliedShopIds.has(s.id)), [shops, appliedShopIds]);
  const shopNameOf = useCallback((shopId: string) =>
    shops.find((s: any) => s.id === shopId)?.name || "Toko validator", [shops]);
  const statusPill = !hasActive
    ? (apps.length === 0 || rejectedOnly ? "Belum aktif" : "Diproses")
    : (sharingLocation ? "Online" : "Offline");

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

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 12, width: 90, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 20, width: 150, marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 76 }} />
        <Skeleton style={{ height: 130 }} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.profileHead}>
          {user?.photo ? (
            <Image source={{ uri: user.photo }} style={styles.profileAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
              <Text style={styles.profileInitial}>{user?.name?.[0]?.toUpperCase() || "?"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileHi}>Halo,</Text>
            <Text style={styles.profileName} numberOfLines={1}>{user?.name}</Text>
          </View>
          <View style={[styles.statusPill,
            hasActive && sharingLocation ? styles.statusPillOnline :
            !hasActive && (hasPending || hasPendingTest) ? styles.statusPillProcess : null]}>
            {(hasActive && sharingLocation) && <View style={styles.statusDot} />}
            <Text style={[styles.statusPillText,
              hasActive && sharingLocation ? { color: COLORS.success } :
              !hasActive && (hasPending || hasPendingTest) ? { color: COLORS.brandLight } : null]}>
              {statusPill}
            </Text>
          </View>
        </View>

        {!hasActive && (
          <StatusCard
            app={latestApp}
            rejectedOnly={rejectedOnly}
            hasPendingTest={hasPendingTest}
            shopName={latestApp ? shopNameOf(latestApp.shop_id) : ""}
          />
        )}

        {!hasActive && !rejectedOnly && apps.length === 0 && (
          <>
            <Text style={styles.formLabel}>FORM LAMARAN</Text>
            <Text style={styles.sec}>PILIH TOKO VALIDATOR</Text>
          </>
        )}
        {!hasActive && !rejectedOnly && apps.length > 0 && (
          <Text style={styles.formLabel}>PROGRES LAMARAN</Text>
        )}
        {!hasActive && rejectedOnly && (
          <Text style={styles.formLabel}>AJUKAN LAGI</Text>
        )}

        {inProcess && latestApp && <ProgressTimeline app={latestApp} shopName={shopNameOf(latestApp.shop_id)} />}

        {hasActive && earnings && (
          <View style={styles.incomeCard}>
            <View style={styles.incomeHead}>
              <Text style={styles.incomeTitle}>Pendapatan</Text>
              <View style={styles.incomePeriod}><Text style={styles.incomePeriodText}>Bulan ini</Text></View>
            </View>
            <Text style={styles.incomeValue}>{rupiah(earnings.monthly_revenue)}</Text>
            <Text style={styles.incomeHint}>{earnings.completed_count} pesanan selesai bulan ini</Text>
          </View>
        )}

        {hasActive && wallet && (
          <PressableScale onPress={() => router.push("/(streetbarber)/manage" as any)} scaleTo={0.98} testID="open-wallet">
            <View style={styles.darkWallet}>
              <View style={styles.darkWalletTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.darkWalletLabel}>Saldo bisa ditarik</Text>
                  <Text style={styles.darkWalletValue}>{rupiah(wallet.balance_available || 0)}</Text>
                </View>
                <View style={styles.darkWithdraw}>
                  <Ionicons name="arrow-down" size={15} color={COLORS.onBrand} />
                  <Text style={styles.darkWithdrawText}>Tarik</Text>
                </View>
              </View>
              <View style={styles.darkHeld}>
                <Ionicons name="lock-closed-outline" size={14} color={COLORS.gold} />
                <Text style={styles.darkHeldText} numberOfLines={2}>
                  {rupiah(wallet.balance_pending || 0)} ditahan sampai pesanan selesai
                </Text>
                <Text style={styles.darkWalletLink}>Dompet</Text>
              </View>
            </View>
          </PressableScale>
        )}

        {hasActive && upcoming && (
          <PressableScale style={styles.upcomingCard} onPress={() => router.push("/(streetbarber)/orders" as any)} testID="upcoming-booking" scaleTo={0.98}>
            <View style={styles.upcomingHead}>
              <Text style={styles.upcomingLabel}>PESANAN MENDATANG</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.brandLight} />
            </View>
            <Text style={styles.upcomingName} numberOfLines={1}>{upcoming.customer?.name}</Text>
            <Text style={styles.upcomingMeta} numberOfLines={1}>{upcoming.service?.name} · {upcoming.booking_date} · {upcoming.booking_time} WITA</Text>
            {!!upcoming.customer_address && (
              <Text style={styles.upcomingMeta} numberOfLines={1}>{upcoming.customer_address}</Text>
            )}
          </PressableScale>
        )}

        {hasActive && (
          <View style={[styles.locCard, sharingLocation && styles.locCardOn]}>
            <View style={[styles.locIconBig, sharingLocation && { backgroundColor: COLORS.success }]}>
              <Ionicons name="navigate" size={22} color={sharingLocation ? "#FFFFFF" : COLORS.brandLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locTitle}>Bagikan lokasi</Text>
              <Text style={[styles.locSub, sharingLocation && { color: COLORS.success }]}>
                {sharingLocation ? "Kamu terlihat di peta pelanggan sekitar" : "Aktifkan saat kamu sedang bekerja"}
              </Text>
              {!!locError && <Text style={styles.locErrorText}>{locError}</Text>}
            </View>
            <Switch
              value={sharingLocation}
              onValueChange={toggleSharing}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              thumbColor="#FFFFFF"
              testID="location-share-toggle"
            />
          </View>
        )}

        {!hasActive && (
          <>
            <Text style={styles.sec}>PILIH TOKO VALIDATOR</Text>
            {availableShops.length === 0 && <Text style={styles.empty}>Semua toko sudah dilamar.</Text>}
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
                <View style={styles.shopChevron}><Ionicons name="chevron-forward" size={18} color={COLORS.brandLight} /></View>
              </PressableScale>
            ))}
          </>
        )}
      </ScrollView>

      {showApply && (
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: "85%" }]}>
            <View style={styles.grabber} />
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalHead}>
                <View style={styles.modalHeadIcon}><Ionicons name="briefcase" size={20} color={COLORS.brandLight} /></View>
                <Text style={styles.modalTitle}>Ajukan Diri sebagai StreetBarber</Text>
                <Text style={styles.modalSub}>Divalidasi oleh {selShop?.name}</Text>
              </LinearGradient>
              <Text style={styles.label}>Foto KTP *</Text>
              <PressableScale style={styles.photoPick} onPress={() => pickPhoto("ktp")} testID="pick-ktp" scaleTo={0.99}>
                {ktpPhoto ? <Image source={{ uri: ktpPhoto }} style={styles.photoPreview} contentFit="cover" /> : (
                  <><View style={styles.photoIcon}><Ionicons name="cloud-upload-outline" size={20} color={COLORS.brandLight} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoPickText}>Unggah foto KTP</Text>
                    <Text style={styles.photoPickSub}>JPG atau PNG</Text>
                  </View>
                  <Text style={styles.photoPickAction}>Pilih</Text></>
                )}
              </PressableScale>
              <Text style={styles.label}>Pengalaman Kerja * (min. 20 karakter)</Text>
              <TextInput style={[styles.input, { minHeight: 70 }]} multiline placeholder="Ceritakan pengalaman kerjamu..." placeholderTextColor={COLORS.textDim} value={form.work_experience} onChangeText={(t) => setForm({ ...form, work_experience: t })} onFocus={handleFocus} testID="apply-experience" />
              <Text style={styles.label}>URL Portofolio (opsional)</Text>
              <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={COLORS.textDim} value={form.portfolio_url} onChangeText={(t) => setForm({ ...form, portfolio_url: t })} onFocus={handleFocus} autoCapitalize="none" />
              <Text style={styles.label}>Sertifikat (opsional)</Text>
              <TextInput style={styles.input} placeholder="BNSP, kursus, dll" placeholderTextColor={COLORS.textDim} value={form.certificates} onChangeText={(t) => setForm({ ...form, certificates: t })} onFocus={handleFocus} />
              <PressableScale style={styles.agreeRow} onPress={() => setCriteriaAgreed((v) => !v)} testID="criteria-agree" scaleTo={0.99}>
                <View style={[styles.checkBox, criteriaAgreed && { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight }]}>
                  {criteriaAgreed && <Ionicons name="checkmark" size={14} color={COLORS.onBrand} />}
                </View>
                <Text style={styles.agreeText}>Saya menyetujui kriteria seleksi platform PangkasKAKA</Text>
              </PressableScale>
              {!!applyErr && <View style={styles.applyErrBox}><Ionicons name="alert-circle" size={16} color={COLORS.error} /><Text style={styles.applyErrText} testID="apply-error">{applyErr}</Text></View>}
              <PressableScale style={[styles.btnWrapBig, applying && { opacity: 0.6 }]} onPress={apply} disabled={applying} testID="submit-apply" haptic>
                <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnBig}>
                  <Text style={styles.btnBigText}>{applying ? "..." : "Kirim lamaran"}</Text>
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={() => { setShowApply(false); resetApplyForm(); }} style={styles.cancelBtn} scaleTo={0.97}>
                <Text style={styles.cancelText}>Batal</Text>
              </PressableScale>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function shortDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "-";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Kartu status gelap: judul + stepper sesuai tahap lamaran yang TERCAPAI.
// Tidak ada tanggal palsu — tanggal hanya tampil di timeline untuk tahap tercapai.
function StatusCard({ app, rejectedOnly, hasPendingTest, shopName }: any) {
  const stage = !app || rejectedOnly ? 0 : app.status === "pending" ? 1 : 2;
  const title = !app ? "Akunmu belum aktif"
    : rejectedOnly ? "Lamaran belum disetujui"
    : app.status === "pending" ? "Menunggu verifikasi dokumen"
    : "Berkas lolos, menunggu tes";
  const sub = !app ? "Kirim lamaran ke satu barbershop sebagai toko validator dulu."
    : rejectedOnly ? "Coba ajukan ke toko validator lain di bawah."
    : app.status === "pending" ? `Tim ${shopName} sedang memeriksa berkasmu.`
    : "Koordinasi jadwal tes via chat dengan validator.";
  const steps = ["Kirim lamaran", "Verifikasi", "Tes cukur"];
  return (
    <View style={styles.darkCard}>
      <View style={styles.darkCardTop}>
        <View style={styles.darkCardIcon}>
          <Ionicons name={rejectedOnly ? "close-circle-outline" : "id-card-outline"} size={22} color={COLORS.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.darkCardTitle}>{title}</Text>
          <Text style={styles.darkCardSub}>{sub}</Text>
        </View>
      </View>
      <View style={styles.miniSteps}>
        {steps.map((s, i) => {
          const done = i < stage;
          const current = i === stage && !rejectedOnly;
          return (
            <View key={s} style={styles.miniStep}>
              <View style={[styles.miniDot, done && styles.miniDotDone, current && styles.miniDotCurrent]}>
                {done
                  ? <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                  : <Text style={[styles.miniNum, current && { color: COLORS.onBrand }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.miniLabel, (done || current) && styles.miniLabelDone]}>{s}</Text>
              {i < steps.length - 1 && <View style={[styles.miniLine, done && styles.miniLineDone]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Timeline progres: tanggal HANYA dari data nyata (created_at,
// berkas_reviewed_at bila tahapnya sudah lewat).
function ProgressTimeline({ app, shopName }: any) {
  const pastPending = app.status !== "pending";
  const isTest = ["menunggu_tes", "seleksi_berkas_lolos"].includes(app.status);
  const rows: { title: string; sub: string; state: "done" | "current" | "todo" }[] = [
    { title: "Lamaran terkirim", sub: shortDate(app.created_at), state: "done" },
    {
      title: "Verifikasi dokumen",
      sub: pastPending
        ? `Berkas lolos${app.berkas_reviewed_at ? " · " + shortDate(app.berkas_reviewed_at) : ""}`
        : "Sedang diperiksa toko validator",
      state: pastPending ? "done" : "current",
    },
    {
      title: "Tes keterampilan",
      sub: isTest ? "Menunggu jadwal dari toko" : "Menunggu giliran",
      state: isTest ? "current" : "todo",
    },
    { title: "Akun aktif", sub: "Kamu bisa mulai terima panggilan", state: "todo" },
  ];
  return (
    <View>
      <View style={styles.timelineCard}>
        {rows.map((r, i) => (
          <View key={r.title} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDot,
                r.state === "done" && styles.tlDotDone,
                r.state === "current" && styles.tlDotCurrent]}>
                {r.state === "done"
                  ? <Ionicons name="checkmark" size={12} color={COLORS.success} />
                  : r.state === "current" ? <View style={styles.tlCore} /> : <View style={styles.tlHollow} />}
              </View>
              {i < rows.length - 1 && <View style={[styles.tlLine, r.state === "done" && styles.tlLineDone]} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Text style={[styles.tlTitle, r.state === "todo" && { color: COLORS.textDim }]}>{r.title}</Text>
              <Text style={[styles.tlSub, r.state === "current" && { color: COLORS.brandLight }]}>{r.sub}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.infoBox}>
        <Ionicons name="time-outline" size={18} color={COLORS.info} />
        <Text style={styles.infoText}>Estimasi 1–2 hari kerja. Kami kirim notifikasi begitu ada kabar.</Text>
      </View>
      <View style={styles.detailCard}>
        <DetailRow icon="storefront-outline" label="Toko validator" value={shopName} />
        <DetailRow icon="calendar-outline" label="Tanggal kirim" value={shortDate(app.created_at)} />
        <DetailRow icon="id-card-outline" label="Dokumen" value={app.ktp_photo ? "KTP terunggah" : "—"} last />
      </View>
    </View>
  );
}

function DetailRow({ icon, label, value, last }: any) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Ionicons name={icon} size={16} color={COLORS.textDim} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -70, right: -40 },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  brandBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold, marginTop: 8 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },
  profileHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  profileAvatar: { width: 52, height: 52, borderRadius: 26 },
  profileAvatarFallback: { backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  profileInitial: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 20 },
  profileHi: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  profileName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 19, marginTop: 1 },
  statusPill: { backgroundColor: COLORS.surface2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 5 },
  statusPillOnline: { backgroundColor: "#E7F9F0" },
  statusPillProcess: { backgroundColor: COLORS.brandDim },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  statusPillText: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 12 },
  formLabel: { color: COLORS.brandLight, letterSpacing: 1.5, fontSize: 12, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },
  darkCard: { backgroundColor: COLORS.text, borderRadius: 24, padding: 20, marginBottom: 4, overflow: "hidden" },
  darkCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  darkCardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  darkCardTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 19 },
  darkCardSub: { color: "rgba(255,255,255,0.65)", fontFamily: FONT.medium, fontSize: 13, marginTop: 4, lineHeight: 19 },
  miniSteps: { flexDirection: "row", marginTop: 18 },
  miniStep: { flex: 1, alignItems: "center", position: "relative" },
  miniDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  miniDotDone: { backgroundColor: COLORS.success },
  miniDotCurrent: { backgroundColor: COLORS.brand },
  miniNum: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.bold, fontSize: 13 },
  miniLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: FONT.semibold, marginTop: 6, textAlign: "center" },
  miniLabelDone: { color: "#FFFFFF", fontFamily: FONT.bold },
  miniLine: { position: "absolute", top: 14, left: "68%", width: "64%", height: 2, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 1 },
  miniLineDone: { backgroundColor: COLORS.success },
  incomeCard: {
    backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  incomeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  incomeTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18 },
  incomePeriod: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  incomePeriodText: { color: COLORS.textMuted, fontFamily: FONT.bold, fontSize: 12 },
  incomeValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 34, marginTop: 10, letterSpacing: -0.5 },
  incomeHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 4 },
  darkWallet: { backgroundColor: COLORS.text, borderRadius: 24, padding: 20, marginBottom: 12, overflow: "hidden" },
  darkWalletTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  darkWalletLabel: { color: "rgba(255,255,255,0.65)", fontFamily: FONT.medium, fontSize: 13 },
  darkWalletValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 30, marginTop: 4, letterSpacing: -0.5 },
  darkWithdraw: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.brand, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  darkWithdrawText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 15 },
  darkHeld: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14 },
  darkHeldText: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.medium, fontSize: 12, flex: 1 },
  darkWalletLink: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 13 },
  locIconBig: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  locCardOn: { borderColor: COLORS.success, backgroundColor: "#F0FDF6" },
  photoPickSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  photoPickAction: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 14 },
  btnWrapBig: { borderRadius: 18, marginTop: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  btnBig: { padding: 18, alignItems: "center", minHeight: 56 },
  btnBigText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 16 },
  timelineCard: {
    backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 20, paddingBottom: 4, marginBottom: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  tlRow: { flexDirection: "row", gap: 14 },
  tlRail: { alignItems: "center" },
  tlDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  tlDotDone: { backgroundColor: "#E7F9F0", borderColor: COLORS.success },
  tlDotCurrent: { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight },
  tlCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.onBrand },
  tlHollow: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderStrong },
  tlLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: COLORS.border, borderRadius: 1, marginVertical: 4 },
  tlLineDone: { backgroundColor: COLORS.success },
  tlTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, marginTop: 3 },
  tlSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", padding: 14, borderRadius: 16, marginBottom: 12 },
  infoText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, flex: 1, lineHeight: 19 },
  detailCard: {
    backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 4,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, flex: 1 },
  detailValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 13, maxWidth: "55%", textAlign: "right" },
  stepper: { flexDirection: "row", backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  stepCol: { alignItems: "center", flex: 1 },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  stepDotDone: { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight },
  stepLabel: { color: COLORS.textDim, fontSize: 10, marginTop: 6, fontFamily: FONT.semibold, textAlign: "center" },
  stepLabelDone: { color: COLORS.brandLight, fontFamily: FONT.bold },
  stepLine: { position: "absolute", top: 14, left: "50%", width: "100%", height: 2, backgroundColor: COLORS.border, zIndex: -1 },
  stepLineDone: { backgroundColor: COLORS.brand },
  walletDeco: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.25)", top: -50, right: -30 },
  walletIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(15,26,46,0.12)", alignItems: "center", justifyContent: "center" },
  walletLabel: { color: "rgba(15,26,46,0.65)", fontSize: 11, fontFamily: FONT.semibold },
  walletValue: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  walletHint: { color: "rgba(15,26,46,0.6)", fontSize: 11, fontFamily: FONT.medium, marginTop: 2 },
  upcomingCard: {
    backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  upcomingHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  upcomingLabel: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold },
  upcomingName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  upcomingMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 3, fontFamily: FONT.medium },
  earningsCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 20, marginBottom: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6 },
  earningsDeco: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30 },
  earningsIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  earningsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: FONT.semibold },
  earningsValue: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  earningsHint: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: FONT.medium, marginTop: 2 },
  locCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  locCardActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  locIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  locTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  locSub: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  locErrorText: { color: COLORS.error, fontSize: 11, marginTop: 4, fontFamily: FONT.semibold },
  pendingBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFF7ED", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#FDE4C4", marginBottom: 16 },
  pendingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pendingTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  pendingSub: { color: COLORS.textDim, fontSize: 12, marginTop: 3, fontFamily: FONT.medium, lineHeight: 17 },
  shopRow: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, alignItems: "center", shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  shopImg: { width: 60, height: 60, borderRadius: 12 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  starRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  starText: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  shopChevron: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  empty: { color: COLORS.textDim, textAlign: "center", fontFamily: FONT.medium, fontSize: 13, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  modalHead: { alignItems: "center", padding: 16, borderRadius: 18, marginBottom: 4, overflow: "hidden" },
  modalHeadIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: "rgba(15,26,46,0.7)", textAlign: "center", marginTop: 2, fontFamily: FONT.medium, fontSize: 12 },
  label: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  input: { backgroundColor: COLORS.surface, color: COLORS.text, padding: 13, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  btnWrap: { borderRadius: 14, marginTop: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1 },
  photoPick: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 14, height: 90, overflow: "hidden" },
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
});
