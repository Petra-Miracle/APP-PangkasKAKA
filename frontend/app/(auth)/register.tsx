import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { COLORS } from "@/src/lib/api";

const ROLES = [
  { key: "customer", label: "Pelanggan" },
  { key: "owner", label: "Pemilik Toko" },
  { key: "karyawan", label: "Barber" },
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
          <Text style={styles.title}>Daftar Akun</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Nama</Text>
            <TextInput testID="reg-name" style={styles.input} value={name} onChangeText={setName} placeholder="Nama lengkap" placeholderTextColor={COLORS.textDim} />
            <Text style={styles.label}>Email</Text>
            <TextInput testID="reg-email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email@contoh.com" placeholderTextColor={COLORS.textDim} />
            <Text style={styles.label}>No. HP</Text>
            <TextInput testID="reg-phone" style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08xx" placeholderTextColor={COLORS.textDim} />
            <Text style={styles.label}>Password</Text>
            <TextInput testID="reg-password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 8 karakter" placeholderTextColor={COLORS.textDim} />

            <Text style={styles.label}>Daftar sebagai</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <Pressable key={r.key} testID={`role-${r.key}`} onPress={() => setRole(r.key)}
                  style={[styles.rolePill, role === r.key && styles.rolePillActive]}>
                  <Text style={[styles.rolePillText, role === r.key && styles.rolePillTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>

            {err && <Text style={styles.err} testID="reg-error">{err}</Text>}
            <Pressable testID="reg-submit" style={styles.btn} onPress={onSubmit} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "MEMPROSES..." : "DAFTAR"}</Text>
            </Pressable>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="goto-login"><Text style={styles.link}>Sudah punya akun? Masuk</Text></Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: 24, gap: 12, paddingTop: 32 },
  title: { fontSize: 28, color: COLORS.text, fontWeight: "900", marginBottom: 12 },
  card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  label: { color: COLORS.textMuted, marginTop: 8, marginBottom: 6, fontSize: 12, letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", backgroundColor: COLORS.surface2 },
  rolePillActive: { backgroundColor: COLORS.brandDim, borderColor: COLORS.brand },
  rolePillText: { color: COLORS.textDim, fontSize: 12, fontWeight: "700" },
  rolePillTextActive: { color: COLORS.brandLight },
  err: { color: COLORS.error, marginTop: 12 },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 4, alignItems: "center", marginTop: 20 },
  btnText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  link: { color: COLORS.brandLight, marginTop: 16, textAlign: "center" },
});
