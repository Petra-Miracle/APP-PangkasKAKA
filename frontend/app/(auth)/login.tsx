import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero />

          <View style={styles.card}>
            <Text style={styles.heading}>Selamat Datang</Text>
            <Text style={styles.headingSub}>Masuk ke akun PangkasKAKA Anda</Text>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="login-email" style={styles.input} value={email} onChangeText={setEmail}
                placeholder="nama@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="login-password" style={styles.input} value={password} onChangeText={setPassword}
                placeholder="Password Anda" placeholderTextColor={COLORS.textDim} secureTextEntry={!showPw} />
              <Pressable onPress={() => setShowPw((v) => !v)} testID="toggle-pw">
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textDim} />
              </Pressable>
            </View>

            {err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errText} testID="login-error">{err}</Text>
              </View>
            )}

            <GradientButton testID="login-submit-button" label="MASUK" icon="arrow-forward" onPress={onSubmit} loading={loading} />

            <Pressable style={styles.forgotBtn} onPress={() => router.push("/(auth)/forgot-password" as any)} testID="forgot-password-link">
              <Text style={styles.forgotText}>Lupa password?</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>DEMO CEPAT</Text>
              <View style={styles.dividerLine} />
            </View>

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

            <Link href="/(auth)/register" asChild>
              <Pressable testID="goto-register" style={styles.regLink}>
                <Text style={styles.regLinkText}>Belum punya akun? </Text>
                <Text style={[styles.regLinkText, { color: COLORS.brand, fontFamily: FONT.bold }]}>Daftar Sekarang</Text>
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
  card: {
    backgroundColor: "#FFFFFF",
    marginTop: -36,
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  heading: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  headingSub: { color: COLORS.textDim, fontFamily: FONT.medium, marginTop: 4, fontSize: 13, marginBottom: 8 },
  label: { color: COLORS.textMuted, marginTop: 14, marginBottom: 8, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  forgotBtn: { alignSelf: "center", marginTop: 12 },
  forgotText: { color: COLORS.brand, fontFamily: FONT.semibold, fontSize: 13 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 1 },
  demoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  demoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: COLORS.brandDim, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  demoText: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
  regLink: { flexDirection: "row", justifyContent: "center", marginTop: 24, padding: 8 },
  regLinkText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
});
