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
  { key: "owner", label: "Pemilik Toko", icon: "storefront", desc: "Daftarkan toko + kelola barber" },
  { key: "karyawan", label: "StreetBarber", icon: "cut", desc: "Pangkas rambut panggilan ke rumah, divalidasi toko mitra" },
];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"customer" | "owner" | "karyawan">("customer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [basic, setBasic] = useState({ name: "", email: "", phone: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [regAddress, setRegAddress] = useState("");
  const [regCoords, setRegCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [regGpsLoading, setRegGpsLoading] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: "", address: "", price_range: "Rp 25.000 - Rp 75.000",
    bank_name: "", account_number: "", account_holder: "",
    doc_ktp: "", doc_nib: "", doc_npwp: "", doc_surat_usaha: "", doc_toko: "",
  });
  const [karyawanForm, setKaryawanForm] = useState({
    portfolio_url: "", work_experience: "", certificates: "",
    tools_photo: "", bnsp_cert: "", diploma_photo: "", ktp_photo: "", shop_id: "",
  });
  const [karyawanCriteriaAgreed, setKaryawanCriteriaAgreed] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const { scrollRef, handleFocus } = useScrollToInput();

  useEffect(() => {
    if (role === "karyawan" && step === 2 && shops.length === 0) {
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
  const validOwner = () => {
    if (!shopForm.name || !shopForm.address) return "Nama & alamat toko wajib diisi";
    if (!shopForm.doc_ktp || !shopForm.doc_nib || !shopForm.doc_npwp || !shopForm.doc_surat_usaha || !shopForm.doc_toko)
      return "Kelima dokumen wajib di-upload (KTP, NIB, NPWP, Surat Usaha, Foto Toko)";
    return null;
  };
  const validKaryawan = () => {
    if (!karyawanForm.shop_id) return "Pilih toko tujuan lamaran";
    if (!karyawanForm.ktp_photo) return "Foto KTP wajib diunggah";
    if (!karyawanForm.diploma_photo) return "Foto/scan ijazah wajib diunggah";
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
      if (u.role === "owner") {
        const v = validOwner();
        if (v) { setErr(v); setLoading(false); return; }
        await api.post("/owner/shop", {
          name: shopForm.name, address: shopForm.address, price_range: shopForm.price_range,
          latitude: -10.1789 + (Math.random() - 0.5) * 0.05, longitude: 123.607 + (Math.random() - 0.5) * 0.05,
          image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
          bank_name: shopForm.bank_name, account_number: shopForm.account_number, account_holder: shopForm.account_holder,
          doc_ktp: shopForm.doc_ktp, doc_nib: shopForm.doc_nib, doc_npwp: shopForm.doc_npwp, doc_surat_usaha: shopForm.doc_surat_usaha, doc_toko: shopForm.doc_toko,
        });
        router.replace("/(owner)/dashboard");
      } else if (u.role === "karyawan") {
        const v = validKaryawan();
        if (v) { setErr(v); setLoading(false); return; }
        await api.post("/karyawan/apply", { ...karyawanForm, criteria_agreed: karyawanCriteriaAgreed });
        router.replace("/(karyawan)/status");
      } else {
        router.replace("/(customer)/home");
      }
    } catch (e: any) { setErr(e.message || "Gagal daftar"); }
    setLoading(false);
  };

  const submitOwner = () => { const v = validOwner(); if (v) return setErr(v); submit(); };
  const submitKaryawan = () => { const v = validKaryawan(); if (v) return setErr(v); submit(); };

  const heroTitle = step === 1 ? "Buat Akun" : role === "owner" ? "Data Toko" : "Data StreetBarber";
  const heroSub = step === 1 ? "Bergabunglah dengan PangkasKAKA" : role === "owner" ? "Toko diverifikasi admin sebelum aktif" : "Pilih toko + portofolio Anda";

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title={heroTitle} subtitle={heroSub} />

          <Pressable style={styles.backLink} onPress={() => step === 2 ? setStep(1) : router.back()} testID="reg-back">
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <View style={styles.card}>
            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>1</Text></View>
              <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 2 && styles.stepDotActive, role === "customer" && { opacity: 0.3 }]}>
                <Text style={[styles.stepDotText, step !== 2 && { color: COLORS.textDim }]}>2</Text>
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
                        <Ionicons name={r.icon as any} size={20} color={role === r.key ? "#FFFFFF" : COLORS.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleTitle, role === r.key && { color: COLORS.brand }]}>{r.label}</Text>
                        <Text style={styles.roleDesc}>{r.desc}</Text>
                      </View>
                      {role === r.key && <Ionicons name="checkmark-circle" size={22} color={COLORS.brand} />}
                    </PressableScale>
                  ))}
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
                      {regGpsLoading ? <ActivityIndicator size="small" color={COLORS.brand} /> : <Ionicons name="locate" size={16} color={COLORS.brand} />}
                      <Text style={styles.locBtnText}>{regCoords ? "Lokasi terdeteksi ✓" : "Gunakan Lokasi Saat Ini"}</Text>
                    </PressableScale>
                  </>
                )}

                {err && <ErrorMsg testID="reg-error" msg={err} />}
                <GradientButton testID="reg-next" label={role === "customer" ? "DAFTAR SEKARANG" : "LANJUT"} icon="arrow-forward" onPress={nextFromBasic} loading={loading} />

                <Link href="/(auth)/login" asChild>
                  <Pressable testID="goto-login" style={styles.loginLink}>
                    <Text style={styles.loginLinkText}>Sudah punya akun? </Text>
                    <Text style={[styles.loginLinkText, { color: COLORS.brand, fontFamily: FONT.bold }]}>Masuk</Text>
                  </Pressable>
                </Link>
              </View>
            )}

            {step === 2 && role === "owner" && (
              <View>
                <Text style={styles.sectionLabel}>INFORMASI TOKO</Text>
                <Text style={styles.label}>Nama Toko</Text>
                <FormInput icon="storefront-outline" value={shopForm.name} onChangeText={(t: string) => setShopForm({ ...shopForm, name: t })} placeholder="Barber Kupang Modern" testID="shop-name" onFocus={handleFocus} />
                <Text style={styles.label}>Alamat Lengkap</Text>
                <FormInput icon="location-outline" value={shopForm.address} onChangeText={(t: string) => setShopForm({ ...shopForm, address: t })} placeholder="Jl. Timor Raya No. 12, Kupang" testID="shop-address" onFocus={handleFocus} />
                <Text style={styles.label}>Range Harga</Text>
                <FormInput icon="pricetag-outline" value={shopForm.price_range} onChangeText={(t: string) => setShopForm({ ...shopForm, price_range: t })} placeholder="Rp 25.000 - Rp 75.000" onFocus={handleFocus} />

                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>REKENING BANK</Text>
                <Text style={styles.label}>Nama Bank</Text>
                <FormInput icon="business-outline" value={shopForm.bank_name} onChangeText={(t: string) => setShopForm({ ...shopForm, bank_name: t })} placeholder="BNI / BCA / BRI / Mandiri" onFocus={handleFocus} />
                <Text style={styles.label}>Nomor Rekening</Text>
                <FormInput icon="card-outline" value={shopForm.account_number} onChangeText={(t: string) => setShopForm({ ...shopForm, account_number: t })} placeholder="123-456-7890" keyboardType="numeric" onFocus={handleFocus} />
                <Text style={styles.label}>Atas Nama</Text>
                <FormInput icon="person-outline" value={shopForm.account_holder} onChangeText={(t: string) => setShopForm({ ...shopForm, account_holder: t })} placeholder="Nama pemegang rekening" onFocus={handleFocus} />

                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>DOKUMEN LEGAL (WAJIB)</Text>
                <Text style={styles.hint}>Upload kelima dokumen dalam format gambar JPG/PNG (maks 2MB). Admin akan memverifikasi setiap dokumen satu per satu.</Text>
                <DocPicker label="KTP Pemilik" testID="doc-ktp" value={shopForm.doc_ktp} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_ktp: v }))} />
                <DocPicker label="NIB (Nomor Induk Berusaha)" testID="doc-nib" value={shopForm.doc_nib} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_nib: v }))} />
                <DocPicker label="NPWP" testID="doc-npwp" value={shopForm.doc_npwp} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_npwp: v }))} />
                <DocPicker label="Surat Izin Usaha" testID="doc-surat" value={shopForm.doc_surat_usaha} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_surat_usaha: v }))} />
                <DocPicker label="Foto Toko (tampak depan)" testID="doc-toko" value={shopForm.doc_toko} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_toko: v }))} />

                {err && <ErrorMsg msg={err} />}
                <GradientButton testID="reg-submit-owner" label="KIRIM PENGAJUAN" icon="checkmark-circle" onPress={submitOwner} loading={loading} />
              </View>
            )}

            {step === 2 && role === "karyawan" && (
              <View>
                <Text style={styles.sectionLabel}>PILIH TOKO VALIDATOR</Text>
                <Text style={styles.hint}>Toko ini hanya memvalidasi dokumen & keterampilanmu — StreetBarber tidak bekerja di toko dan tidak menjadi karyawan toko manapun. Setelah lulus, kamu melayani panggilan ke rumah secara mandiri.</Text>
                {shops.length === 0 ? <ActivityIndicator color={COLORS.brand} style={{ marginVertical: 20 }} /> : (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {shops.map((s) => (
                      <PressableScale key={s.id} testID={`k-shop-${s.id}`} onPress={() => setKaryawanForm({ ...karyawanForm, shop_id: s.id })}
                        style={[styles.roleRow, karyawanForm.shop_id === s.id && styles.roleRowActive]} scaleTo={0.98}>
                        <View style={styles.roleIcon}><Ionicons name="storefront" size={18} color={COLORS.brand} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roleTitle}>{s.name}</Text>
                          <Text style={styles.roleDesc} numberOfLines={1}>{s.address}</Text>
                        </View>
                        {karyawanForm.shop_id === s.id && <Ionicons name="checkmark-circle" size={22} color={COLORS.brand} />}
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
                <Text style={styles.hint}>KTP dan ijazah/scan diploma wajib diunggah untuk verifikasi lamaran.</Text>
                <DocPicker label="Foto KTP" testID="ktp-photo" value={karyawanForm.ktp_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, ktp_photo: v }))} />
                <DocPicker label="Ijazah / Diploma" testID="diploma-photo" value={karyawanForm.diploma_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, diploma_photo: v }))} />

                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>UPLOAD BUKTI (OPSIONAL)</Text>
                <Text style={styles.hint}>Owner akan menilai skor lamaran (portofolio, sertifikat, bukti alat kerja).</Text>
                <DocPicker label="Foto Alat Kerja" testID="tools-photo" value={karyawanForm.tools_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, tools_photo: v }))} />
                <DocPicker label="Sertifikat BNSP" testID="bnsp-cert" value={karyawanForm.bnsp_cert} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, bnsp_cert: v }))} />

                <PressableScale style={styles.agreeRow} onPress={() => setKaryawanCriteriaAgreed((v) => !v)} testID="k-criteria-agree" scaleTo={0.99}>
                  <View style={[styles.checkBox, karyawanCriteriaAgreed && { backgroundColor: COLORS.brand, borderColor: COLORS.brand }]}>
                    {karyawanCriteriaAgreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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
        <Ionicons name={value ? "checkmark" : "cloud-upload"} size={18} color="#FFFFFF" />
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
  backText: { color: "#FFFFFF", fontFamily: FONT.semibold, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surface, marginTop: -36, marginHorizontal: 20, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 24, elevation: 6,
  },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  stepDotText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 12 },
  stepLine: { height: 2, width: 32, backgroundColor: COLORS.border },
  stepLineActive: { backgroundColor: COLORS.brand },
  sectionLabel: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold },
  hint: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 4, marginBottom: 4, lineHeight: 16 },
  label: { color: COLORS.textMuted, marginTop: 14, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 12, fontFamily: FONT.medium, fontSize: 14 },
  multi: { backgroundColor: COLORS.surface2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, minHeight: 68, textAlignVertical: "top", color: COLORS.text, fontFamily: FONT.medium, paddingVertical: 12 },
  locBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.brandDim, borderRadius: 12, paddingVertical: 12, marginTop: 10 },
  locBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 13 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  agreeText: { flex: 1, color: COLORS.text, fontFamily: FONT.medium, fontSize: 12, lineHeight: 17 },
  checkBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface2 },
  roleRowActive: { backgroundColor: COLORS.brandDim, borderColor: COLORS.brand },
  roleIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  roleTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  roleDesc: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  docPicker: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.surface2, marginTop: 8 },
  docPickerDone: { borderStyle: "solid", backgroundColor: "#F0FDF4", borderColor: COLORS.success },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  docLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docStatus: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  loginLink: { flexDirection: "row", justifyContent: "center", marginTop: 20, padding: 8 },
  loginLinkText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
});
