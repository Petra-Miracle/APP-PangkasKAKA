import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Switch, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api, COLORS, FONT, tanggal } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useScrollToInput } from "@/src/lib/useScrollToInput";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const my = await api.get("/karyawan/my");
      const sh = await api.get("/shops?sort=rating");
      setApps(my.applications); setShops(sh.shops);
      try { const bk = await api.get("/karyawan/bookings"); setMyBookings(bk.bookings); } catch { setMyBookings([]); }
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

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  const appliedShopIds = new Set(apps.map((a) => a.shop_id));
  const availableShops = shops.filter((s) => !appliedShopIds.has(s.id));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.brandBadge}>
            <Ionicons name="cut" size={12} color={COLORS.brand} />
            <Text style={styles.brandBadgeText}>BARBER PORTAL</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name}</Text>
          <Text style={styles.headerSub}>{user?.email}</Text>
        </View>
        <Pressable onPress={doLogout} testID="k-logout" style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {apps.some((a) => a.status === "active") && (
          <View style={styles.locCard}>
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
                <Text style={styles.cName}>{b.customer?.name}</Text>
                <Text style={styles.cMeta}>{b.service?.name} · {b.shop?.name}</Text>
                <Text style={styles.cMeta}>{tanggal(b.booking_date)} · {b.booking_time} WITA</Text>
                <Pressable style={styles.chatBtn} onPress={() => router.push(`/chat/booking/${b.id}` as any)} testID={`booking-chat-${b.id}`}>
                  <Ionicons name="chatbubbles" size={14} color="#FFFFFF" />
                  <Text style={styles.chatBtnText}>CHAT DENGAN PELANGGAN</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sec}>LAMARAN SAYA</Text>
        {apps.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={32} color={COLORS.textDim} />
            <Text style={styles.empty}>Belum ada lamaran. Pilih toko di bawah untuk mulai.</Text>
          </View>
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
                  <Ionicons name="trophy" size={16} color={COLORS.success} />
                  <Text style={styles.congratsText}>Anda diterima sebagai barber di toko ini!</Text>
                </View>
              )}
              {["menunggu_tes", "seleksi_berkas_lolos", "active"].includes(a.status) && (
                <Pressable style={styles.chatBtn} onPress={() => router.push(`/chat/recruitment/${a.id}` as any)} testID={`recruitment-chat-${a.id}`}>
                  <Ionicons name="chatbubbles" size={14} color="#FFFFFF" />
                  <Text style={styles.chatBtnText}>CHAT DENGAN OWNER</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <Text style={styles.sec}>LAMAR KE TOKO</Text>
        {availableShops.length === 0 && <Text style={styles.empty}>Anda sudah melamar ke semua toko.</Text>}
        {availableShops.map((s: any) => (
          <Pressable key={s.id} style={styles.shopRow} testID={`apply-shop-${s.id}`} onPress={() => { setSelShop(s); setShowApply(true); }}>
            <Image source={{ uri: s.image }} style={styles.shopImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{s.name}</Text>
              <Text style={styles.cMeta} numberOfLines={1}>{s.address}</Text>
              <View style={styles.starRow}>
                <Ionicons name="star" size={11} color={COLORS.warning} />
                <Text style={styles.starText}>{s.rating?.toFixed(1)} · {s.reviews_count} ulasan</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={showApply} transparent animationType="slide" onRequestClose={() => setShowApply(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modal, { maxHeight: "85%" }]}>
            <View style={styles.grabber} />
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Lamar Kerja</Text>
              <Text style={styles.modalSub}>{selShop?.name}</Text>

              <Text style={styles.label}>Foto KTP *</Text>
              <Pressable style={styles.photoPick} onPress={() => pickPhoto("ktp")} testID="pick-ktp">
                {ktpPhoto ? (
                  <Image source={{ uri: ktpPhoto }} style={styles.photoPreview} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={20} color={COLORS.textDim} />
                    <Text style={styles.photoPickText}>Unggah foto KTP</Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.label}>Foto/Scan Ijazah *</Text>
              <Pressable style={styles.photoPick} onPress={() => pickPhoto("diploma")} testID="pick-diploma">
                {diplomaPhoto ? (
                  <Image source={{ uri: diplomaPhoto }} style={styles.photoPreview} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={20} color={COLORS.textDim} />
                    <Text style={styles.photoPickText}>Unggah foto ijazah</Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.label}>Pengalaman Kerja * (min. 20 karakter)</Text>
              <TextInput style={[styles.input, { minHeight: 70 }]} multiline placeholder="Ceritakan pengalaman kerjamu, mis. 2 tahun di Barber X sebagai..." placeholderTextColor={COLORS.textDim} value={form.work_experience} onChangeText={(t) => setForm({ ...form, work_experience: t })} onFocus={handleFocus} testID="apply-experience" />

              <Text style={styles.label}>URL Portofolio (opsional)</Text>
              <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={COLORS.textDim} value={form.portfolio_url} onChangeText={(t) => setForm({ ...form, portfolio_url: t })} onFocus={handleFocus} autoCapitalize="none" />

              <Text style={styles.label}>Sertifikat (opsional)</Text>
              <TextInput style={styles.input} placeholder="BNSP, kursus, dll" placeholderTextColor={COLORS.textDim} value={form.certificates} onChangeText={(t) => setForm({ ...form, certificates: t })} onFocus={handleFocus} />

              <Pressable style={styles.agreeRow} onPress={() => setCriteriaAgreed((v) => !v)} testID="criteria-agree">
                <Ionicons name={criteriaAgreed ? "checkbox" : "square-outline"} size={20} color={criteriaAgreed ? COLORS.brand : COLORS.textDim} />
                <Text style={styles.agreeText}>Saya menyetujui kriteria seleksi platform PangkasKAKA</Text>
              </Pressable>

              {!!applyErr && (
                <View style={styles.applyErrBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.applyErrText} testID="apply-error">{applyErr}</Text>
                </View>
              )}

              <Pressable style={[styles.btn, applying && { opacity: 0.6 }]} onPress={apply} disabled={applying} testID="submit-apply">
                {applying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>KIRIM LAMARAN</Text>}
              </Pressable>
              <Pressable onPress={() => { setShowApply(false); resetApplyForm(); }} style={{ padding: 12, alignItems: "center" }}>
                <Text style={{ color: COLORS.textDim, fontFamily: FONT.medium }}>Batal</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  brandBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold, marginTop: 8 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  logoutBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },
  locCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  locTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  locSub: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  locErrorText: { color: COLORS.error, fontSize: 11, marginTop: 4, fontFamily: FONT.semibold },
  emptyCard: { alignItems: "center", padding: 24, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  empty: { color: COLORS.textDim, textAlign: "center", fontFamily: FONT.medium, fontSize: 13 },
  appCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.5 },
  congrats: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, backgroundColor: "#ECFDF5", borderRadius: 10 },
  congratsText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },
  chatBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: COLORS.brand, padding: 10, borderRadius: 10, marginTop: 10 },
  chatBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.4 },
  shopRow: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, alignItems: "center" },
  shopImg: { width: 60, height: 60, borderRadius: 10 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  starText: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 2, marginBottom: 4, fontFamily: FONT.medium },
  label: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium },
  btn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 20 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
  photoPick: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 12, height: 90, overflow: "hidden" },
  photoPickText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  photoPreview: { width: "100%", height: "100%" },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  agreeText: { flex: 1, color: COLORS.text, fontFamily: FONT.medium, fontSize: 12, lineHeight: 17 },
  applyErrBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  applyErrText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 12 },
});
