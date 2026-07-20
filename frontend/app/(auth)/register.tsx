import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";

const ROLES = [
  { key: "customer", label: "Pelanggan", icon: "person" },
  { key: "owner", label: "Pemilik Toko", icon: "storefront" },
  { key: "karyawan", label: "Barber", icon: "cut" },
];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (password.length < 8) { setErr("Password minimal 8 karakter"); return; }
    setLoading(true);
    try {
      const u = await register({ name, email: email.trim(), phone, password, role });
      if (u.role === "owner") router.replace("/(owner)/dashboard");
      else if (u.role === "karyawan") router.replace("/(karyawan)/status");
      else router.replace("/(customer)/home");
    } catch (e: any) { setErr(e.message || "Gagal daftar"); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>
          <Text style={styles.title}>Daftar Akun Baru</Text>
          <Text style={styles.subtitle}>Bergabunglah dengan PangkasKAKA</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Daftar sebagai</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <Pressable key={r.key} testID={`role-${r.key}`} onPress={() => setRole(r.key)}
                  style={[styles.rolePill, role === r.key && styles.rolePillActive]}>
                  <Ionicons name={r.icon as any} size={18} color={role === r.key ? COLORS.brand : COLORS.textDim} />
                  <Text style={[styles.rolePillText, role === r.key && styles.rolePillTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Nama Lengkap</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="reg-name" style={styles.input} value={name} onChangeText={setName} placeholder="Nama Anda" placeholderTextColor={COLORS.textDim} />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="reg-email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email@contoh.com" placeholderTextColor={COLORS.textDim} />
            </View>

            <Text style={styles.label}>Nomor HP</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="reg-phone" style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08xx-xxxx-xxxx" placeholderTextColor={COLORS.textDim} />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="reg-password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Min. 8 karakter" placeholderTextColor={COLORS.textDim} />
            </View>

            {err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errText} testID="reg-error">{err}</Text>
              </View>
            )}

            <Pressable testID="reg-submit" style={styles.btn} onPress={onSubmit} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "MEMPROSES..." : "DAFTAR SEKARANG"}</Text>
            </Pressable>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="goto-login">
                <Text style={styles.link}>Sudah punya akun? <Text style={{ color: COLORS.brand, fontFamily: FONT.bold }}>Masuk</Text></Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: 24, paddingBottom: 40 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { color: COLORS.text, fontFamily: FONT.semibold },
  title: { fontSize: 26, color: COLORS.text, fontFamily: FONT.extrabold },
  subtitle: { color: COLORS.textDim, fontFamily: FONT.medium, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: COLORS.surface, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4,
  },
  label: { color: COLORS.textMuted, marginTop: 16, marginBottom: 8, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  rolePill: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", backgroundColor: COLORS.surface2, gap: 4 },
  rolePillActive: { backgroundColor: COLORS.brandDim, borderColor: COLORS.brand },
  rolePillText: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold },
  rolePillTextActive: { color: COLORS.brand },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24, shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
  link: { color: COLORS.textDim, marginTop: 16, textAlign: "center", fontFamily: FONT.medium },
});
