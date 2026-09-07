import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

/**
 * Pengajuan toko PUBLIK — tanpa akun/login. Akun Owner baru dibuat otomatis oleh sistem
 * hanya saat SuperAdmin menyetujui pengajuan ini (lihat POST /shop-applications di backend).
 * Password akan disampaikan manual oleh SuperAdmin setelah disetujui.
 */
export default function ShopApply() {
  const router = useRouter();
  const { scrollRef, handleFocus } = useScrollToInput();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [applicant, setApplicant] = useState({ applicant_name: "", applicant_email: "", applicant_phone: "" });
  const [shopForm, setShopForm] = useState({
    name: "", address: "", price_range: "Rp 25.000 - Rp 75.000",
    bank_name: "", account_number: "", account_holder: "",
    doc_ktp: "", doc_nib: "", doc_npwp: "", doc_surat_usaha: "", doc_toko: "",
  });

  const pickDoc = async (setter: (val: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { alert("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setter(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const validate = () => {
    if (!applicant.applicant_name || !applicant.applicant_email || !applicant.applicant_phone) return "Data pemohon wajib diisi";
    if (!shopForm.name || !shopForm.address) return "Nama & alamat toko wajib diisi";
    if (!shopForm.doc_ktp || !shopForm.doc_nib || !shopForm.doc_npwp || !shopForm.doc_surat_usaha || !shopForm.doc_toko)
      return "Kelima dokumen wajib di-upload (KTP, NIB, NPWP, Surat Usaha, Foto Toko)";
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(null); setLoading(true);
    try {
      await api.post("/shop-applications", {
        ...applicant,
        name: shopForm.name, address: shopForm.address, price_range: shopForm.price_range,
        latitude: -10.1789 + (Math.random() - 0.5) * 0.05, longitude: 123.607 + (Math.random() - 0.5) * 0.05,
        image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
        bank_name: shopForm.bank_name, account_number: shopForm.account_number, account_holder: shopForm.account_holder,
        doc_ktp: shopForm.doc_ktp, doc_nib: shopForm.doc_nib, doc_npwp: shopForm.doc_npwp, doc_surat_usaha: shopForm.doc_surat_usaha, doc_toko: shopForm.doc_toko,
      });
      setDone(true);
    } catch (e: any) { setErr(e.message || "Gagal mengirim pengajuan"); }
    setLoading(false);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}><Ionicons name="checkmark-circle" size={48} color={COLORS.success} /></View>
          <Text style={styles.doneTitle}>Pengajuan Terkirim</Text>
          <Text style={styles.doneText}>
            Tim kami akan meninjau dokumen toko Anda. Setelah disetujui, akun pemilik toko akan
            dibuatkan dan kredensial login akan dihubungi lewat kontak yang Anda daftarkan.
          </Text>
          <GradientButton testID="shop-apply-done-login" label="KEMBALI KE MASUK" icon="arrow-forward" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title="Daftarkan Toko" subtitle="Toko diverifikasi SuperAdmin sebelum aktif" />

          <Pressable style={styles.backLink} onPress={() => router.back()} testID="shop-apply-back">
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.hint}>
              Belum perlu akun — cukup isi data toko & dokumen di bawah. Akun pemilik toko akan
              dibuatkan otomatis setelah pengajuan ini disetujui.
            </Text>

            <Text style={styles.sectionLabel}>DATA PEMOHON</Text>
            <Text style={styles.label}>Nama Lengkap</Text>
            <FormInput icon="person-outline" value={applicant.applicant_name} onChangeText={(t: string) => setApplicant({ ...applicant, applicant_name: t })} placeholder="Nama Anda" testID="applicant-name" onFocus={handleFocus} />
            <Text style={styles.label}>Email</Text>
            <FormInput icon="mail-outline" value={applicant.applicant_email} onChangeText={(t: string) => setApplicant({ ...applicant, applicant_email: t })} placeholder="email@contoh.com" testID="applicant-email" keyboardType="email-address" autoCapitalize="none" onFocus={handleFocus} />
            <Text style={styles.label}>Nomor HP</Text>
            <FormInput icon="call-outline" value={applicant.applicant_phone} onChangeText={(t: string) => setApplicant({ ...applicant, applicant_phone: t })} placeholder="08xx-xxxx-xxxx" testID="applicant-phone" keyboardType="phone-pad" onFocus={handleFocus} />

            <View style={styles.divider} />
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
            <Text style={styles.hint}>Upload kelima dokumen dalam format gambar JPG/PNG (maks 2MB). SuperAdmin akan memverifikasi setiap dokumen satu per satu.</Text>
            <DocPicker label="KTP Pemilik" testID="doc-ktp" value={shopForm.doc_ktp} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_ktp: v }))} />
            <DocPicker label="NIB (Nomor Induk Berusaha)" testID="doc-nib" value={shopForm.doc_nib} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_nib: v }))} />
            <DocPicker label="NPWP" testID="doc-npwp" value={shopForm.doc_npwp} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_npwp: v }))} />
            <DocPicker label="Surat Izin Usaha" testID="doc-surat" value={shopForm.doc_surat_usaha} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_surat_usaha: v }))} />
            <DocPicker label="Foto Toko (tampak depan)" testID="doc-toko" value={shopForm.doc_toko} onPick={() => pickDoc((v) => setShopForm({ ...shopForm, doc_toko: v }))} />

            {err && <ErrorMsg testID="shop-apply-error" msg={err} />}
            <GradientButton testID="shop-apply-submit" label="KIRIM PENGAJUAN" icon="checkmark-circle" onPress={submit} loading={loading} />
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
  sectionLabel: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold },
  hint: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 4, marginBottom: 8, lineHeight: 16 },
  label: { color: COLORS.textMuted, marginTop: 14, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 12, fontFamily: FONT.medium, fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  docPicker: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.surface2, marginTop: 8 },
  docPickerDone: { borderStyle: "solid", backgroundColor: "#F0FDF4", borderColor: COLORS.success },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  docLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docStatus: { color: COLORS.textDim, fontSize: 11, marginTop: 2, fontFamily: FONT.medium },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  doneTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, marginBottom: 10 },
  doneText: { color: COLORS.textDim, fontSize: 13, fontFamily: FONT.medium, textAlign: "center", lineHeight: 20, marginBottom: 28 },
});
