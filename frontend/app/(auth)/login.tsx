import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

export default function Login() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const { scrollRef, handleFocus } = useScrollToInput();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null); setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role === "admin") {
        Alert.alert("Akun Admin", "Akun Admin hanya bisa diakses lewat website Admin, bukan aplikasi ini.");
        await logout();
      }
      else if (u.role === "superadmin") router.replace("/(superadmin)/dashboard");
      else if (u.role === "owner") router.replace("/(owner)/dashboard");
      else if (u.role === "streetbarber") router.replace("/(streetbarber)/dashboard" as any);
      else router.replace("/(customer)/home");
    } catch (e: any) { setErr(e.message || "Login gagal"); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero />

          <View style={styles.card}>
            <Text style={styles.heading}>Selamat Datang</Text>
            <Text style={styles.headingSub}>Masuk ke akun PangkasKAKA Anda</Text>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="login-email" style={styles.input} value={email} onChangeText={setEmail} onFocus={handleFocus}
                placeholder="nama@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="login-password" style={styles.input} value={password} onChangeText={setPassword} onFocus={handleFocus}
                placeholder="Password Anda" placeholderTextColor={COLORS.textDim} secureTextEntry={!showPw} />
              <PressableScale onPress={() => setShowPw((v) => !v)} testID="toggle-pw" scaleTo={0.9}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textDim} />
              </PressableScale>
            </View>

            {err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errText} testID="login-error">{err}</Text>
              </View>
            )}

            <GradientButton testID="login-submit-button" label="MASUK" icon="arrow-forward" onPress={onSubmit} loading={loading} />

            <PressableScale style={styles.forgotBtn} onPress={() => router.push("/(auth)/forgot-password" as any)} testID="forgot-password-link" scaleTo={0.96}>
              <Text style={styles.forgotText}>Lupa password?</Text>
            </PressableScale>

            <Link href="/(auth)/register" asChild>
              <Pressable testID="goto-register" style={styles.regLink}>
                <Text style={styles.regLinkText}>Belum punya akun? </Text>
                <Text style={[styles.regLinkText, { color: COLORS.brandLight, fontFamily: FONT.bold }]}>Daftar Sekarang</Text>
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
    backgroundColor: COLORS.surface,
    marginTop: -40,
    marginHorizontal: 20,
    padding: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 28, elevation: 8,
  },
  heading: { color: COLORS.text, fontSize: 26, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  headingSub: { color: COLORS.textDim, fontFamily: FONT.medium, marginTop: 8, fontSize: 13, marginBottom: 12 },
  label: { color: COLORS.textMuted, marginTop: 16, marginBottom: 10, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 15, fontFamily: FONT.medium, fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 14, borderRadius: 14, marginTop: 16 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  forgotBtn: { alignSelf: "center", marginTop: 14 },
  forgotText: { color: COLORS.brandLight, fontFamily: FONT.semibold, fontSize: 13 },
  regLink: { flexDirection: "row", justifyContent: "center", marginTop: 26, padding: 8 },
  regLinkText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
});
