import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";

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
          <View style={styles.logoBox}>
            <View style={styles.logoBadge}>
              <Ionicons name="cut" size={26} color={COLORS.brand} />
            </View>
            <Text style={styles.brand} testID="brand-title">
              PANGKAS<Text style={{ color: COLORS.brand }}>KAKA</Text>
            </Text>
            <Text style={styles.sub}>Barbershop On-Demand · Kupang NTT</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Masuk ke Akun</Text>
            <Text style={styles.headingSub}>Selamat datang kembali</Text>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="login-email" style={styles.input} value={email} onChangeText={setEmail}
                placeholder="email@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="login-password" style={styles.input} value={password} onChangeText={setPassword}
                placeholder="Masukkan password" placeholderTextColor={COLORS.textDim} secureTextEntry />
            </View>

            {err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errText} testID="login-error">{err}</Text>
              </View>
            )}

            <Pressable testID="login-submit-button" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]} onPress={onSubmit} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "MEMPROSES..." : "MASUK"}</Text>
            </Pressable>

            <Link href="/(auth)/register" asChild>
              <Pressable testID="goto-register">
                <Text style={styles.linkText}>Belum punya akun? <Text style={{ color: COLORS.brand, fontFamily: FONT.bold }}>Daftar</Text></Text>
              </Pressable>
            </Link>
          </View>

          <Text style={styles.demoTitle}>Demo Login Cepat</Text>
          <View style={styles.demoRow}>
            {[
              { key: "customer", label: "Pelanggan", icon: "person" },
              { key: "owner", label: "Owner", icon: "storefront" },
              { key: "admin", label: "Admin", icon: "shield-checkmark" },
              { key: "karyawan", label: "Barber", icon: "cut" },
            ].map((r) => (
              <Pressable key={r.key} testID={`demo-${r.key}`} style={styles.demoBtn} onPress={() => fill(r.key)}>
                <Ionicons name={r.icon as any} size={16} color={COLORS.brand} />
                <Text style={styles.demoText}>{r.label}</Text>
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
  wrap: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  logoBox: { alignItems: "center", marginBottom: 24 },
  logoBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  brand: { fontSize: 32, color: COLORS.text, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  sub: { color: COLORS.textDim, marginTop: 6, fontFamily: FONT.medium, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surface, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4,
  },
  heading: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  headingSub: { color: COLORS.textDim, fontFamily: FONT.regular, marginTop: 4, marginBottom: 8 },
  label: { color: COLORS.textMuted, marginTop: 16, marginBottom: 8, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24, shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
  linkText: { color: COLORS.textDim, marginTop: 20, textAlign: "center", fontFamily: FONT.medium },
  demoTitle: { color: COLORS.textDim, marginTop: 32, marginBottom: 12, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.5, textTransform: "uppercase" },
  demoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  demoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  demoText: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
});
