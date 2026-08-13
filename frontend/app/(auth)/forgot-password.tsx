import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) { setErr("Email wajib diisi"); return; }
    setErr(null); setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      router.push({ pathname: "/(auth)/reset-password", params: { email: email.trim() } } as any);
    } catch (e: any) { setErr(e.message || "Gagal mengirim kode reset"); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title="Lupa Password" subtitle="Masukkan email akunmu, kami kirim kode reset" />

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="forgot-email" style={styles.input} value={email} onChangeText={setEmail}
                placeholder="nama@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" />
            </View>

            {err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errText} testID="forgot-error">{err}</Text>
              </View>
            )}

            <GradientButton testID="forgot-submit" label="KIRIM KODE RESET" icon="arrow-forward" onPress={onSubmit} loading={loading} />

            <Pressable style={styles.backLink} onPress={() => router.back()}>
              <Text style={styles.backLinkText}>Kembali ke Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: "#FFFFFF", marginTop: -36, marginHorizontal: 20, padding: 24, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  label: { color: COLORS.textMuted, marginBottom: 8, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  backLink: { alignSelf: "center", marginTop: 20, padding: 8 },
  backLinkText: { color: COLORS.brand, fontFamily: FONT.semibold, fontSize: 13 },
});
