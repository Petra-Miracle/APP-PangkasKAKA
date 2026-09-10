import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAuth } from "@/src/lib/auth";
import { api, COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

const ROLES = [
  { key: "customer", label: "Pelanggan", icon: "person", desc: "Cari & booking barbershop" },
  { key: "streetbarber", label: "StreetBarber", icon: "cut", desc: "Pangkas rambut panggilan ke rumah, divalidasi toko mitra" },
];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"customer" | "streetbarber">("customer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [basic, setBasic] = useState({ name: "", email: "", phone: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [regAddress, setRegAddress] = useState("");
  const [regCoords, setRegCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [regGpsLoading, setRegGpsLoading] = useState(false);
  const [karyawanForm, setKaryawanForm] = useState({
    portfolio_url: "", work_experience: "", certificates: "",
    tools_photo: "", bnsp_cert: "", diploma_photo: "", ktp_photo: "", shop_id: "",
  });
  const [karyawanCriteriaAgreed, setKaryawanCriteriaAgreed] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const { scrollRef, handleFocus } = useScrollToInput();

  useEffect(() => {
    if (role === "streetbarber" && step === 2 && shops.length === 0) {
      api.get("/shops?sort=rating").then((r) => setShops(r.shops)).catch(() => {});
    }
  }, [role, step, shops.length]);

  const useRegCurrentLocation = async () => {
    setRegGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { alert("Izin lokasi dibutuhkan untuk mendeteksi toko terdekat"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRegCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch { alert("Gagal mengambil lokasi, coba lagi"); } finally { setRegGpsLoading(false); }
  };

  const pickDoc = async (setter: (val: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { alert("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setter(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const validBasic = () => {
    if (!basic.name || !basic.email || !basic.phone || !basic.password) return "Semua field wajib diisi";
    if (basic.password.length < 8) return "Password minimal 8 karakter";
    if (!/^08/.test(basic.phone) || basic.phone.length < 10) return "Nomor HP harus format 08xx (min 10 digit)";
    return null;
  };
  const validKaryawan = () => {
    if (!karyawanForm.shop_id) return "Pilih toko tujuan lamaran";
    if (!karyawanForm.ktp_photo) return "Foto KTP wajib diunggah";
    if (karyawanForm.work_experience.trim().length < 20) return "Pengalaman kerja wajib diisi minimal 20 karakter";
    if (!karyawanCriteriaAgreed) return "Anda harus menyetujui kriteria platform";
    return null;
  };

  const nextFromBasic = () => {
    const v = validBasic();
    if (v) { setErr(v); return; }
    setErr(null);
    if (role === "customer") { submit(); return; }
    setStep(2);
  };

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const u = await register({
        ...basic, role,
        ...(role === "customer" ? { address: regAddress, lat: regCoords?.lat, lng: regCoords?.lng } : {}),
      });
      if (u.role === "streetbarber") {
        const v = validKaryawan();
        if (v) { setErr(v); setLoading(false); return; }
        await api.post("/karyawan/apply", { ...karyawanForm, criteria_agreed: karyawanCriteriaAgreed });
        router.replace("/(streetbarber)/dashboard" as any);
      } else {
        router.replace("/(customer)/home");
      }
    } catch (e: any) { setErr(e.message || "Gagal daftar"); }
    setLoading(false);
  };

  const submitKaryawan = () => { const v = validKaryawan(); if (v) return setErr(v); submit(); };

  const heroTitle = step === 1 ? "Buat Akun" : "Data StreetBarber";
  const heroSub = step === 1 ? "Bergabunglah dengan PangkasKAKA" : "Pilih toko + portofolio Anda";

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title={heroTitle} subtitle={heroSub} />

          <Pressable style={styles.backLink} onPress={() => step === 2 ? setStep(1) : router.back()} testID="reg-back">
            <Ionicons name="arrow-back" size={18} color={COLORS.text} />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <View style={styles.card}>
            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotActive]}><Text style={[styles.stepDotText, { color: COLORS.onBrand }]}>1</Text></View>
              <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 2 && styles.stepDotActive, role === "customer" && { opacity: 0.3 }]}>
                <Text style={[styles.stepDotText, { color: step === 2 ? COLORS.onBrand : COLORS.textDim }]}>2</Text>
              </View>
            </View>

            {step === 1 && (
              <View>
                <Text style={styles.sectionLabel}>PILIH PERAN ANDA</Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  {ROLES.map((r) => (
                    <PressableScale key={r.key} testID={`role-${r.key}`} onPress={() => setRole(r.key as any)}
                      style={[styles.roleRow, role === r.key && styles.roleRowActive]} scaleTo={0.98}>
                      <View style={[styles.roleIcon, role === r.key && { backgroundColor: COLORS.brand }]}>
                        <Ionicons name={r.icon as any} size={20} color={role === r.key ? COLORS.onBrand : COLORS.brandLight} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleTitle, role === r.key && { color: COLORS.brandLight }]}>{r.label}</Text>
                        <Text style={styles.roleDesc}>{r.desc}</Text>
                      </View>
                      {role === r.key && <Ionicons name="checkmark-circle" size={22} color={COLORS.brandLight} />}
                    </PressableScale>
                  ))}
                  {/* Kartu visual ke-3 (§1c): bukan role form ini — langsung ke alur shop-apply */}
                  <PressableScale testID="role-owner" onPress={() => router.push("/(auth)/shop-apply" as any)}
                    style={styles.roleRow} scaleTo={0.98}>
                    <View style={styles.roleIcon}>
                      <Ionicons name="storefront" size={20} color={COLORS.brandLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleTitle}>Pemilik Barbershop</Text>
                      <Text style={styles.roleDesc}>Daftarkan tokomu sebagai mitra</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={22} color={COLORS.brandLight} />
                  </PressableScale>
                </View>

                <Text style={styles.label}>Nama Lengkap</Text>
                <FormInput icon="person-outline" value={basic.name} onChangeText={(t: string) => setBasic({ ...basic, name: t })} placeholder="Nama Anda" testID="reg-name" onFocus={handleFocus} />
                <Text style={styles.label}>Email</Text>
                <FormInput icon="mail-outline" value={basic.email} onChangeText={(t: string) => setBasic({ ...basic, email: t })} placeholder="email@contoh.com" testID="reg-email" keyboardType="email-address" autoCapitalize="none" onFocus={handleFocus} />
                <Text style={styles.label}>Nomor HP</Text>
                <FormInput icon="call-outline" value={basic.phone} onChangeText={(t: string) => setBasic({ ...basic, phone: t })} placeholder="08xx-xxxx-xxxx" testID="reg-phone" keyboardType="phone-pad" onFocus={handleFocus} />
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
                  <TextInput testID="reg-password" style={styles.input} value={basic.password} onChangeText={(t: string) => setBasic({ ...basic, password: t })} onFocus={handleFocus}
                    placeholder="Min. 8 karakter" placeholderTextColor={COLORS.textDim} secureTextEntry={!showPw} />
                  <PressableScale onPress={() => setShowPw((v) => !v)} testID="toggle-reg-pw" scaleTo={0.9}>
                    <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textDim} />
                  </PressableScale>
                </View>

                {role === "customer" && (
                  <>
                    <Text style={styles.label}>Alamat</Text>
                    <FormInput icon="home-outline" value={regAddress} onChangeText={setRegAddress} placeholder="Jl. Timor Raya No. 12, Kupang" testID="reg-address" onFocus={handleFocus} />
                    <Text style={styles.hint}>Dipakai untuk menampilkan barbershop terdekat dari lokasimu di Beranda.</Text>
                    <PressableScale onPress={useRegCurrentLocation} testID="reg-use-location" style={styles.locBtn} scaleTo={0.98}>
                      {regGpsLoading ? <ActivityIndicator size="small" color={COLORS.brandLight} /> : <Ionicons name="locate" size={16} color={COLORS.brandLight} />}
                      <Text style={styles.locBtnText}>{regCoords ? "Lokasi terdeteksi ✓" : "Gunakan Lokasi Saat Ini"}</Text>
                    </PressableScale>
                  </>
                )}

                {err && <ErrorMsg testID="reg-error" msg={err} />}
                <GradientButton testID="reg-next" label={role === "customer" ? "DAFTAR SEKARANG" : "LANJUT"} icon="arrow-forward" onPress={nextFromBasic} loading={loading} />

                <Link href="/(auth)/login" asChild>
                  <Pressable testID="goto-login" style={styles.loginLink}>
                    <Text style={styles.loginLinkText}>Sudah punya akun? </Text>
                    <Text style={[styles.loginLinkText, { color: COLORS.brandLight, fontFamily: FONT.bold }]}>Masuk</Text>
                  </Pressable>
                </Link>

                <Link href="/(auth)/shop-apply" asChild>
                  <Pressable testID="goto-shop-apply" style={styles.shopApplyLink}>
                    <Ionicons name="storefront-outline" size={16} color={COLORS.brandLight} />
                    <Text style={styles.shopApplyLinkText}>Punya toko? Daftarkan Toko Anda</Text>
                  </Pressable>
                </Link>
              </View>
            )}

            {step === 2 && role === "streetbarber" && (
              <View>
                <Text style={styles.sectionLabel}>PILIH TOKO VALIDATOR</Text>
                <Text style={styles.hint}>Toko ini hanya memvalidasi dokumen & keterampilanmu — StreetBarber tidak bekerja di toko dan tidak menjadi karyawan toko manapun. Setelah lulus, kamu melayani panggilan ke rumah secara mandiri.</Text>
                {shops.length === 0 ? <ActivityIndicator color={COLORS.brand} style={{ marginVertical: 20 }} /> : (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {shops.map((s) => (
                      <PressableScale key={s.id} testID={`k-shop-${s.id}`} onPress={() => setKaryawanForm({ ...karyawanForm, shop_id: s.id })}
                        style={[styles.roleRow, karyawanForm.shop_id === s.id && styles.roleRowActive]} scaleTo={0.98}>
                        <View style={styles.roleIcon}><Ionicons name="storefront" size={18} color={COLORS.brandLight} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roleTitle}>{s.name}</Text>
                          <Text style={styles.roleDesc} numberOfLines={1}>{s.address}</Text>
                        </View>
                        {karyawanForm.shop_id === s.id && <Ionicons name="checkmark-circle" size={22} color={COLORS.brandLight} />}
                      </PressableScale>
                    ))}
                  </View>
                )}

                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>PORTOFOLIO & PENGALAMAN</Text>
                <Text style={styles.label}>URL Portofolio</Text>
                <FormInput icon="link-outline" value={karyawanForm.portfolio_url} onChangeText={(t: string) => setKaryawanForm({ ...karyawanForm, portfolio_url: t })} placeholder="https://instagram.com/..." autoCapitalize="none" onFocus={handleFocus} />
                <Text style={styles.label}>Pengalaman Kerja</Text>
                <TextInput style={styles.multi} value={karyawanForm.work_experience} onChangeText={(t: string) => setKaryawanForm({ ...karyawanForm, work_experience: t })} placeholder="Cth: 2 tahun di Barber Kupang, spesialis fade..." placeholderTextColor={COLORS.textDim} multiline onFocus={handleFocus} />
                <Text style={styles.label}>Sertifikat / Kursus</Text>
                <TextInput style={styles.multi} value={karyawanForm.certificates} onChangeText={(t: string) => setKaryawanForm({ ...karyawanForm, certificates: t })} placeholder="Cth: Kursus Barber Master 2024" placeholderTextColor={COLORS.textDim} multiline onFocus={handleFocus} />

                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>DOKUMEN WAJIB</Text>
                <Text style={styles.hint}>KTP wajib diunggah untuk verifikasi lamaran.</Text>
                <DocPicker label="Foto KTP" testID="ktp-photo" value={karyawanForm.ktp_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, ktp_photo: v }))} />

                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>UPLOAD BUKTI (OPSIONAL)</Text>
                <Text style={styles.hint}>Owner akan menilai skor lamaran (portofolio, sertifikat, bukti alat kerja).</Text>
                <DocPicker label="Foto Alat Kerja" testID="tools-photo" value={karyawanForm.tools_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, tools_photo: v }))} />

                <PressableScale style={styles.agreeRow} onPress={() => setKaryawanCriteriaAgreed((v) => !v)} testID="k-criteria-agree" scaleTo={0.99}>
                  <View style={[styles.checkBox, karyawanCriteriaAgreed && { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight }]}>
                    {karyawanCriteriaAgreed && <Ionicons name="checkmark" size={14} color={COLORS.onBrand} />}
                  </View>
                  <Text style={styles.agreeText}>Saya menyetujui kriteria seleksi platform PangkasKAKA</Text>
                </PressableScale>

                {err && <ErrorMsg msg={err} />}
                <GradientButton testID="reg-submit-karyawan" label="KIRIM LAMARAN" icon="paper-plane" onPress={submitKaryawan} loading={loading} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormInput({ icon, ...p }: any) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={COLORS.textDim} />
      <TextInput {...p} style={styles.input} placeholderTextColor={COLORS.textDim} />
    </View>
  );
}
function ErrorMsg({ msg, testID }: any) {
  return (
    <View style={styles.errBox}>
      <Ionicons name="alert-circle" size={16} color={COLORS.error} />
      <Text testID={testID} style={styles.errText}>{msg}</Text>
    </View>
  );
}
function DocPicker({ label, value, onPick, testID }: any) {
  return (
    <PressableScale testID={testID} style={[styles.docPicker, !!value && styles.docPickerDone]} onPress={onPick} scaleTo={0.98}>
      <View style={[styles.docIcon, !!value && { backgroundColor: COLORS.success }]}>
        <Ionicons name={value ? "checkmark" : "cloud-upload"} size={18} color={value ? "#FFFFFF" : COLORS.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docStatus}>{value ? "Terupload ✓ Ketuk untuk ganti" : "Ketuk untuk pilih foto"}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  backLink: { position: "absolute", top: 52, left: 20, flexDirection: "row", alignItems: "center", gap: 4, zIndex: 10 },
  backText: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surface, marginTop: -40, marginHorizontal: 20, padding: 28, borderRadius: 28, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 28, elevation: 8,
  },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 22 },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  stepDotText: { color: COLORS.onBrand, fontFamily: FONT.bold, fontSize: 12 },
  stepLine: { height: 2, width: 36, backgroundColor: COLORS.border },
  stepLineActive: { backgroundColor: COLORS.brand },
  sectionLabel: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold },
  hint: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 4, marginBottom: 4, lineHeight: 16 },
  label: { color: COLORS.textMuted, marginTop: 16, marginBottom: 8, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  multi: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 16, minHeight: 72, textAlignVertical: "top", color: COLORS.text, fontFamily: FONT.medium, paddingVertical: 14 },
  locBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.brandDim, borderRadius: 14, paddingVertical: 14, marginTop: 12, borderWidth: 1, borderColor: COLORS.brand },
  locBtnText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 13 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 22 },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  agreeText: { flex: 1, color: COLORS.text, fontFamily: FONT.medium, fontSize: 12, lineHeight: 18 },
  checkBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  roleRowActive: { backgroundColor: COLORS.brandDim, borderColor: COLORS.brandLight },
  roleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  roleTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  roleDesc: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  docPicker: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.surface2, marginTop: 10 },
  docPickerDone: { borderStyle: "solid", backgroundColor: "#F0FDF4", borderColor: COLORS.success },
  docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  docLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docStatus: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 14, borderRadius: 14, marginTop: 16 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  loginLink: { flexDirection: "row", justifyContent: "center", marginTop: 22, padding: 8 },
  loginLinkText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  shopApplyLink: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 4, padding: 8 },
  shopApplyLinkText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 13 },
});
