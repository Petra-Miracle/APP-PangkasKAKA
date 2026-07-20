import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { COLORS } from "@/src/lib/api";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null); setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role === "admin") router.replace("/(admin)/dashboard");
      else if (u.role === "owner") router.replace("/(owner)/dashboard");
      else if (u.role === "karyawan") router.replace("/(karyawan)/status");
      else router.replace("/(customer)/home");
    } catch (e: any) { setErr(e.message || "Login gagal"); }
    setLoading(false);
  };

  const fill = (r: string) => {
    const m: Record<string, [string, string]> = {
      customer: ["customer@pangkaskaka.id", "Customer123!"],
      owner: ["owner@pangkaskaka.id", "Owner123!"],
      admin: ["admin@pangkaskaka.id", "Admin123!"],
      karyawan: ["karyawan@pangkaskaka.id", "Karyawan123!"],
    };
    setEmail(m[r][0]); setPassword(m[r][1]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand} testID="brand-title">PANGKAS<Text style={{ color: COLORS.brand }}>KAKA</Text></Text>
          <Text style={styles.sub}>Barbershop On-Demand · Kupang</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput testID="login-email" style={styles.input} value={email} onChangeText={setEmail}
              placeholder="email@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.label}>Password</Text>
            <TextInput testID="login-password" style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Password" placeholderTextColor={COLORS.textDim} secureTextEntry />
            {err && <Text style={styles.err} testID="login-error">{err}</Text>}
            <Pressable testID="login-submit-button" style={styles.btn} onPress={onSubmit} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "MEMPROSES..." : "MASUK"}</Text>
            </Pressable>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="goto-register"><Text style={styles.linkText}>Belum punya akun? Daftar</Text></Pressable>
            </Link>
          </View>

          <Text style={styles.demoTitle}>Demo Login</Text>
          <View style={styles.demoRow}>
            {["customer", "owner", "admin", "karyawan"].map((r) => (
              <Pressable key={r} testID={`demo-${r}`} style={styles.demoBtn} onPress={() => fill(r)}>
                <Text style={styles.demoText}>{r.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: 24, gap: 12, paddingTop: 48 },
  brand: { fontSize: 40, color: COLORS.text, fontWeight: "900", letterSpacing: 1 },
  sub: { color: COLORS.textDim, marginBottom: 24 },
  card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  label: { color: COLORS.textMuted, marginTop: 8, marginBottom: 6, fontSize: 12, letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  err: { color: COLORS.error, marginTop: 12 },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 4, alignItems: "center", marginTop: 20 },
  btnText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  linkText: { color: COLORS.brandLight, marginTop: 16, textAlign: "center" },
  demoTitle: { color: COLORS.textDim, marginTop: 24, marginBottom: 8, fontSize: 12, letterSpacing: 0.5 },
  demoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  demoBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.surface2, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  demoText: { color: COLORS.brandLight, fontSize: 11, fontWeight: "700" },
});
