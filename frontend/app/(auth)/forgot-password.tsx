import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

export default function ForgotPassword() {
  const router = useRouter();
  const { scrollRef, handleFocus } = useScrollToInput();
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title="Lupa Password" subtitle="Masukkan email akunmu, kami kirim kode reset" />

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
              <TextInput testID="forgot-email" style={styles.input} value={email} onChangeText={setEmail} onFocus={handleFocus}
                placeholder="nama@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" />
            </View>

            {err && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errText} testID="forgot-error">{err}</Text>
              </View>
            )}

            <GradientButton testID="forgot-submit" label="KIRIM KODE RESET" icon="arrow-forward" onPress={onSubmit} loading={loading} />

            <PressableScale style={styles.backLink} onPress={() => router.back()} scaleTo={0.96}>
              <Text style={styles.backLinkText}>Kembali ke Login</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.surface, marginTop: -40, marginHorizontal: 20, padding: 28, borderRadius: 28,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 28, elevation: 8,
  },
  label: { color: COLORS.textMuted, marginBottom: 10, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 15, fontFamily: FONT.medium, fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 14, borderRadius: 14, marginTop: 16 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  backLink: { alignSelf: "center", marginTop: 22, padding: 8 },
  backLinkText: { color: COLORS.brandLight, fontFamily: FONT.semibold, fontSize: 13 },
});
