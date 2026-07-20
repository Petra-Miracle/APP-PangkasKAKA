import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/lib/auth";
import { api, COLORS, FONT } from "@/src/lib/api";

const ROLES = [
  { key: "customer", label: "Pelanggan", icon: "person", desc: "Cari & booking barbershop" },
  { key: "owner", label: "Pemilik Toko", icon: "storefront", desc: "Daftarkan toko + kelola barber" },
  { key: "karyawan", label: "Barber", icon: "cut", desc: "Lamar kerja dengan portofolio" },
];

type DocKey = "doc_ktp" | "doc_nib" | "doc_npwp" | "doc_surat_usaha";
type KaryawanDocKey = "tools_photo" | "bnsp_cert" | "diploma_photo";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"customer" | "owner" | "karyawan">("customer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1: basic
  const [basic, setBasic] = useState({ name: "", email: "", phone: "", password: "" });

  // Step 2 - Owner
  const [shopForm, setShopForm] = useState({
    name: "", address: "", price_range: "Rp 25.000 - Rp 75.000",
    bank_name: "", account_number: "", account_holder: "",
    doc_ktp: "", doc_nib: "", doc_npwp: "", doc_surat_usaha: "",
  });

  // Step 2 - Karyawan
  const [karyawanForm, setKaryawanForm] = useState({
    portfolio_url: "", work_experience: "", certificates: "",
    tools_photo: "", bnsp_cert: "", diploma_photo: "",
    shop_id: "",
  });
  const [shops, setShops] = useState<any[]>([]);

  useEffect(() => {
    if (role === "karyawan" && step === 2 && shops.length === 0) {
      api.get("/shops?sort=rating").then((r) => setShops(r.shops)).catch(() => {});
    }
  }, [role, step, shops.length]);

  const pickDoc = async (setter: (val: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { alert("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
    setter(uri);
  };

  const validBasic = () => {
    if (!basic.name || !basic.email || !basic.phone || !basic.password) return "Semua field wajib diisi";
    if (basic.password.length < 8) return "Password minimal 8 karakter";
    if (!/^08/.test(basic.phone) || basic.phone.length < 10) return "Nomor HP harus format 08xx (min 10 digit)";
    return null;
  };
  const validOwner = () => {
    if (!shopForm.name || !shopForm.address) return "Nama & alamat toko wajib diisi";
    if (!shopForm.doc_ktp || !shopForm.doc_nib || !shopForm.doc_npwp || !shopForm.doc_surat_usaha)
      return "Keempat dokumen legal wajib di-upload";
    return null;
  };
  const validKaryawan = () => {
    if (!karyawanForm.shop_id) return "Pilih toko tujuan lamaran";
    if (!karyawanForm.portfolio_url && !karyawanForm.work_experience) return "Isi portofolio atau pengalaman kerja";
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
      const u = await register({ ...basic, role });

      if (u.role === "owner") {
        const v = validOwner();
        if (v) { setErr(v); setLoading(false); return; }
        await api.post("/owner/shop", {
          name: shopForm.name, address: shopForm.address, price_range: shopForm.price_range,
          latitude: -10.1789 + (Math.random() - 0.5) * 0.05,
          longitude: 123.607 + (Math.random() - 0.5) * 0.05,
          image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
          bank_name: shopForm.bank_name, account_number: shopForm.account_number, account_holder: shopForm.account_holder,
          doc_ktp: shopForm.doc_ktp, doc_nib: shopForm.doc_nib, doc_npwp: shopForm.doc_npwp, doc_surat_usaha: shopForm.doc_surat_usaha,
        });
        router.replace("/(owner)/dashboard");
      } else if (u.role === "karyawan") {
        await api.post("/karyawan/apply", {
          shop_id: karyawanForm.shop_id,
          portfolio_url: karyawanForm.portfolio_url,
          work_experience: karyawanForm.work_experience,
          certificates: karyawanForm.certificates,
          tools_photo: karyawanForm.tools_photo,
          bnsp_cert: karyawanForm.bnsp_cert,
          diploma_photo: karyawanForm.diploma_photo,
        });
        router.replace("/(karyawan)/status");
      } else {
        router.replace("/(customer)/home");
      }
    } catch (e: any) { setErr(e.message || "Gagal daftar"); }
    setLoading(false);
  };

  const submitOwner = () => {
    const v = validOwner();
    if (v) { setErr(v); return; }
    submit();
  };
  const submitKaryawan = () => {
    const v = validKaryawan();
    if (v) { setErr(v); return; }
    submit();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backLink} onPress={() => step === 2 ? setStep(1) : router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]}>
              <Text style={styles.stepDotText}>1</Text>
            </View>
            <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
            <View style={[styles.stepDot, step === 2 && styles.stepDotActive, role === "customer" && { opacity: 0.3 }]}>
              <Text style={styles.stepDotText}>2</Text>
            </View>
          </View>

          {step === 1 && (
            <View>
              <Text style={styles.title}>Daftar Akun Baru</Text>
              <Text style={styles.subtitle}>Pilih peran & isi data dasar</Text>

              <View style={styles.card}>
                <Text style={styles.label}>Daftar sebagai</Text>
                <View style={{ gap: 8 }}>
                  {ROLES.map((r) => (
                    <Pressable key={r.key} testID={`role-${r.key}`} onPress={() => setRole(r.key as any)}
                      style={[styles.roleRow, role === r.key && styles.roleRowActive]}>
                      <View style={[styles.roleIcon, role === r.key && { backgroundColor: COLORS.brand }]}>
                        <Ionicons name={r.icon as any} size={20} color={role === r.key ? "#FFFFFF" : COLORS.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleTitle, role === r.key && { color: COLORS.brand }]}>{r.label}</Text>
                        <Text style={styles.roleDesc}>{r.desc}</Text>
                      </View>
                      {role === r.key && <Ionicons name="checkmark-circle" size={22} color={COLORS.brand} />}
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Nama Lengkap</Text>
                <FormInput icon="person-outline" value={basic.name} onChangeText={(t) => setBasic({ ...basic, name: t })} placeholder="Nama Anda" testID="reg-name" />

                <Text style={styles.label}>Email</Text>
                <FormInput icon="mail-outline" value={basic.email} onChangeText={(t) => setBasic({ ...basic, email: t })} placeholder="email@contoh.com" testID="reg-email" keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.label}>Nomor HP</Text>
                <FormInput icon="call-outline" value={basic.phone} onChangeText={(t) => setBasic({ ...basic, phone: t })} placeholder="08xx-xxxx-xxxx" testID="reg-phone" keyboardType="phone-pad" />

                <Text style={styles.label}>Password</Text>
                <FormInput icon="lock-closed-outline" value={basic.password} onChangeText={(t) => setBasic({ ...basic, password: t })} placeholder="Min. 8 karakter" testID="reg-password" secureTextEntry />

                {err && <ErrorMsg testID="reg-error" msg={err} />}

                <Pressable testID="reg-next" style={styles.btn} onPress={nextFromBasic} disabled={loading}>
                  <Text style={styles.btnText}>{role === "customer" ? (loading ? "MEMPROSES..." : "DAFTAR SEKARANG") : "LANJUT"}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
                <Link href="/(auth)/login" asChild>
                  <Pressable testID="goto-login"><Text style={styles.link}>Sudah punya akun? <Text style={{ color: COLORS.brand, fontFamily: FONT.bold }}>Masuk</Text></Text></Pressable>
                </Link>
              </View>
            </View>
          )}

          {step === 2 && role === "owner" && (
            <View>
              <Text style={styles.title}>Data Toko Anda</Text>
              <Text style={styles.subtitle}>Toko akan diverifikasi admin sebelum bisa menerima pesanan</Text>

              <View style={styles.card}>
                <Text style={styles.sectionLabel}>INFORMASI TOKO</Text>
                <Text style={styles.label}>Nama Toko</Text>
                <FormInput icon="storefront-outline" value={shopForm.name} onChangeText={(t) => setShopForm({ ...shopForm, name: t })} placeholder="Barber Kupang Modern" testID="shop-name" />
                <Text style={styles.label}>Alamat Lengkap</Text>
                <FormInput icon="location-outline" value={shopForm.address} onChangeText={(t) => setShopForm({ ...shopForm, address: t })} placeholder="Jl. Timor Raya No. 12, Kupang" testID="shop-address" />
                <Text style={styles.label}>Range Harga</Text>
                <FormInput icon="pricetag-outline" value={shopForm.price_range} onChangeText={(t) => setShopForm({ ...shopForm, price_range: t })} placeholder="Rp 25.000 - Rp 75.000" />

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>REKENING BANK (untuk transfer revenue)</Text>
                <Text style={styles.label}>Nama Bank</Text>
                <FormInput icon="business-outline" value={shopForm.bank_name} onChangeText={(t) => setShopForm({ ...shopForm, bank_name: t })} placeholder="BNI / BCA / BRI / Mandiri" />
                <Text style={styles.label}>Nomor Rekening</Text>
                <FormInput icon="card-outline" value={shopForm.account_number} onChangeText={(t) => setShopForm({ ...shopForm, account_number: t })} placeholder="123-456-7890" keyboardType="numeric" />
                <Text style={styles.label}>Atas Nama</Text>
                <FormInput icon="person-outline" value={shopForm.account_holder} onChangeText={(t) => setShopForm({ ...shopForm, account_holder: t })} placeholder="Nama pemegang rekening" />

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>DOKUMEN LEGAL (wajib)</Text>
                <Text style={styles.hint}>Upload keempat dokumen dalam format gambar (JPG/PNG). Admin akan memverifikasi manual.</Text>

                <DocPicker label="KTP Pemilik" testID="doc-ktp" value={shopForm.doc_ktp} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_ktp: v }))} />
                <DocPicker label="NIB (Nomor Induk Berusaha)" testID="doc-nib" value={shopForm.doc_nib} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_nib: v }))} />
                <DocPicker label="NPWP" testID="doc-npwp" value={shopForm.doc_npwp} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_npwp: v }))} />
                <DocPicker label="Surat Izin Usaha" testID="doc-surat" value={shopForm.doc_surat_usaha} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_surat_usaha: v }))} />

                {err && <ErrorMsg msg={err} />}

                <Pressable testID="reg-submit-owner" style={styles.btn} onPress={submitOwner} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <>
                    <Text style={styles.btnText}>KIRIM PENGAJUAN</Text>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  </>}
                </Pressable>
              </View>
            </View>
          )}

          {step === 2 && role === "karyawan" && (
            <View>
              <Text style={styles.title}>Data Barber</Text>
              <Text style={styles.subtitle}>Pilih toko tujuan lamaran + isi portofolio</Text>

              <View style={styles.card}>
                <Text style={styles.sectionLabel}>TOKO TUJUAN LAMARAN</Text>
                {shops.length === 0 ? <ActivityIndicator color={COLORS.brand} style={{ marginVertical: 20 }} /> : (
                  <View style={{ gap: 8 }}>
                    {shops.map((s) => (
                      <Pressable key={s.id} testID={`k-shop-${s.id}`} onPress={() => setKaryawanForm({ ...karyawanForm, shop_id: s.id })}
                        style={[styles.shopChip, karyawanForm.shop_id === s.id && styles.shopChipActive]}>
                        <View style={styles.shopIcon}><Ionicons name="storefront" size={16} color={COLORS.brand} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shopChipName}>{s.name}</Text>
                          <Text style={styles.shopChipMeta}>{s.address}</Text>
                        </View>
                        {karyawanForm.shop_id === s.id && <Ionicons name="checkmark-circle" size={22} color={COLORS.brand} />}
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>PORTOFOLIO & PENGALAMAN</Text>
                <Text style={styles.label}>URL Portofolio (Instagram / website)</Text>
                <FormInput icon="link-outline" value={karyawanForm.portfolio_url} onChangeText={(t) => setKaryawanForm({ ...karyawanForm, portfolio_url: t })} placeholder="https://instagram.com/..." autoCapitalize="none" />
                <Text style={styles.label}>Pengalaman Kerja</Text>
                <FormInputMulti value={karyawanForm.work_experience} onChangeText={(t) => setKaryawanForm({ ...karyawanForm, work_experience: t })} placeholder="Cth: 2 tahun di Barber Kupang, spesialis fade..." />
                <Text style={styles.label}>Sertifikat / Kursus</Text>
                <FormInputMulti value={karyawanForm.certificates} onChangeText={(t) => setKaryawanForm({ ...karyawanForm, certificates: t })} placeholder="Cth: Kursus Barber Master 2024, ..." />

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>UPLOAD BUKTI (opsional)</Text>
                <Text style={styles.hint}>Owner akan menilai skor lamaran berdasarkan portofolio, sertifikat, dan bukti alat kerja.</Text>

                <DocPicker label="Foto Alat Kerja" testID="tools-photo" value={karyawanForm.tools_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, tools_photo: v }))} />
                <DocPicker label="Sertifikat BNSP" testID="bnsp-cert" value={karyawanForm.bnsp_cert} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, bnsp_cert: v }))} />
                <DocPicker label="Ijazah / Diploma" testID="diploma-photo" value={karyawanForm.diploma_photo} onPick={() => pickDoc((v) => setKaryawanForm({ ...karyawanForm, diploma_photo: v }))} />

                {err && <ErrorMsg msg={err} />}

                <Pressable testID="reg-submit-karyawan" style={styles.btn} onPress={submitKaryawan} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <>
                    <Text style={styles.btnText}>KIRIM LAMARAN</Text>
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                  </>}
                </Pressable>
              </View>
            </View>
          )}
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
function FormInputMulti({ ...p }: any) {
  return <TextInput {...p} style={[styles.input, styles.multi]} placeholderTextColor={COLORS.textDim} multiline />;
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
    <Pressable testID={testID} style={[styles.docPicker, !!value && styles.docPickerDone]} onPress={onPick}>
      <View style={[styles.docIcon, !!value && { backgroundColor: COLORS.success }]}>
        <Ionicons name={value ? "checkmark" : "cloud-upload"} size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docStatus}>{value ? "Terupload ✓ Ketuk untuk ganti" : "Ketuk untuk pilih foto"}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: 20, paddingBottom: 40 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  backText: { color: COLORS.text, fontFamily: FONT.semibold },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  stepDotText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13 },
  stepLine: { height: 2, width: 40, backgroundColor: COLORS.border },
  stepLineActive: { backgroundColor: COLORS.brand },
  title: { fontSize: 24, color: COLORS.text, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  subtitle: { color: COLORS.textDim, fontFamily: FONT.medium, marginTop: 4, marginBottom: 16, fontSize: 13 },
  card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#0A2540", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4 },
  sectionLabel: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold, marginTop: 4, marginBottom: 4 },
  hint: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 4, marginBottom: 8, lineHeight: 16 },
  label: { color: COLORS.textMuted, marginTop: 14, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 12, fontFamily: FONT.medium, fontSize: 14 },
  multi: { backgroundColor: COLORS.surface2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, minHeight: 70, textAlignVertical: "top" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface2 },
  roleRowActive: { backgroundColor: COLORS.brandDim, borderColor: COLORS.brand },
  roleIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  roleTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  roleDesc: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  shopChip: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: COLORS.surface2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  shopChipActive: { backgroundColor: COLORS.brandDim, borderColor: COLORS.brand },
  shopIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  shopChipName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  shopChipMeta: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  docPicker: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.surface2, marginTop: 8 },
  docPickerDone: { borderStyle: "solid", backgroundColor: "#F0FDF4", borderColor: COLORS.success },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  docLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docStatus: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  btn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, marginTop: 24, shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
  link: { color: COLORS.textDim, marginTop: 16, textAlign: "center", fontFamily: FONT.medium },
});
