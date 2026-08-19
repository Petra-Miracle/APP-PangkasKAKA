import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Switch, KeyboardAvoidingView, Platform } from "react-native";
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
  active: { color: COLORS.success, bg: "#ECFDF5", label: "DITERIMA" },
  rejected: { color: COLORS.error, bg: "#FEF2F2", label: "DITOLAK" },
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "MENUNGGU" },
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const my = await api.get("/karyawan/my");
      const sh = await api.get("/shops?sort=rating");
      setApps(my.applications); setShops(sh.shops);
      try { const bk = await api.get("/karyawan/bookings"); setMyBookings(bk.bookings); } catch { setMyBookings([]); }
      try { setEarnings(await api.get("/karyawan/earnings")); } catch { setEarnings(null); }
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    if (!diplomaPhoto) return setApplyErr("Foto/scan ijazah wajib diunggah");
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

  const appliedShopIds = new Set(apps.map((a) => a.shop_id));
  const availableShops = shops.filter((s) => !appliedShopIds.has(s.id));

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
            <Text style={styles.brandBadgeText}>BARBER PORTAL</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name}</Text>
          <Text style={styles.headerSub}>{user?.email}</Text>
        </View>
        <PressableScale onPress={doLogout} testID="k-logout" style={styles.logoutBtn} scaleTo={0.88} haptic>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
        </PressableScale>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {apps.length > 0 && !apps.some((a) => a.status === "active") && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingIcon}>
              <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Akun Belum Aktif Sebagai Barber</Text>
              <Text style={styles.pendingSub}>Menunggu persetujuan pemilik toko. Fitur pesanan &amp; bagikan lokasi akan otomatis aktif begitu lamaran kamu diterima.</Text>
            </View>
          </View>
        )}

        {apps.some((a) => a.status === "active") && earnings && (
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
              </View>
            ))}
          </>
        )}

        <Text style={styles.sec}>LAMARAN SAYA</Text>
        {apps.length === 0 && (
          <EmptyState
            icon="briefcase-outline"
            title="Belum ada lamaran"
            description="Pilih toko di bawah untuk mulai melamar."
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
                  <Text style={styles.congratsText}>Anda diterima sebagai barber di toko ini!</Text>
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
                    <Text style={styles.chatBtnText}>CHAT DENGAN OWNER</Text>
                  </LinearGradient>
                </PressableScale>
              )}
            </View>
          );
        })}

        <Text style={styles.sec}>LAMAR KE TOKO</Text>
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
                <Text style={styles.modalTitle}>Lamar Kerja</Text>
                <Text style={styles.modalSub}>{selShop?.name}</Text>
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

              <Text style={styles.label}>Foto/Scan Ijazah *</Text>
              <PressableScale style={styles.photoPick} onPress={() => pickPhoto("diploma")} testID="pick-diploma" scaleTo={0.99}>
                {diplomaPhoto ? (
                  <Image source={{ uri: diplomaPhoto }} style={styles.photoPreview} contentFit="cover" />
                ) : (
                  <>
                    <View style={styles.photoIcon}><Ionicons name="camera-outline" size={20} color={COLORS.brand} /></View>
                    <Text style={styles.photoPickText}>Unggah foto ijazah</Text>
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
});