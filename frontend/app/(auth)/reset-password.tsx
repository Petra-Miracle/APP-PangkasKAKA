import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS, FONT } from "@/src/lib/api";
import { AuthHero, GradientButton } from "@/src/components/AuthUI";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

export default function ResetPassword() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const { scrollRef, handleFocus } = useScrollToInput();

  const onSubmit = async () => {
    setErr(null);
    if (!email.trim() || !code.trim()) { setErr("Email dan kode wajib diisi"); return; }
    if (newPassword.length < 8) { setErr("Password minimal 8 karakter"); return; }
    if (newPassword !== confirmPassword) { setErr("Konfirmasi password tidak cocok"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email: email.trim(), code: code.trim(), new_password: newPassword });
      setOk(true);
      setTimeout(() => router.replace("/(auth)/login"), 1500);
    } catch (e: any) { setErr(e.message || "Gagal reset password"); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title="Reset Password" subtitle="Masukkan kode dari email & password baru" />

          <View style={styles.card}>
            {ok ? (
              <View style={styles.okBox}>
                <View style={styles.okIcon}>
                  <Ionicons name="checkmark" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.okText}>Password berhasil diubah. Mengalihkan ke login...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.textDim} />
                  <TextInput testID="reset-email" style={styles.input} value={email} onChangeText={setEmail}
                    placeholder="nama@contoh.com" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" onFocus={handleFocus} />
                </View>

                <Text style={styles.label}>Kode Reset (6 digit)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="key-outline" size={18} color={COLORS.textDim} />
                  <TextInput testID="reset-code" style={styles.input} value={code} onChangeText={setCode}
                    placeholder="123456" placeholderTextColor={COLORS.textDim} keyboardType="number-pad" maxLength={6} onFocus={handleFocus} />
                </View>

                <Text style={styles.label}>Password Baru</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
                  <TextInput testID="reset-new-password" style={styles.input} value={newPassword} onChangeText={setNewPassword}
                    placeholder="Minimal 8 karakter" placeholderTextColor={COLORS.textDim} secureTextEntry={!showPw} onFocus={handleFocus} />
<PressableScale onPress={() => setShowPw((v) => !v)} scaleTo={0.9}>
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textDim} />
                </PressableScale>
                </View>

                <Text style={styles.label}>Konfirmasi Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} />
                  <TextInput testID="reset-confirm-password" style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
                    placeholder="Ulangi password baru" placeholderTextColor={COLORS.textDim} secureTextEntry={!showPw} onFocus={handleFocus} />
                </View>

                {err && (
                  <View style={styles.errBox}>
                    <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                    <Text style={styles.errText} testID="reset-error">{err}</Text>
                  </View>
                )}

                <GradientButton testID="reset-submit" label="RESET PASSWORD" icon="checkmark" onPress={onSubmit} loading={loading} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.surface, marginTop: -36, marginHorizontal: 20, padding: 24, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 24, elevation: 6,
  },
  label: { color: COLORS.textMuted, marginTop: 14, marginBottom: 8, fontSize: 12, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface2, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginTop: 14 },
  errText: { color: COLORS.error, flex: 1, fontFamily: FONT.medium, fontSize: 13 },
  okBox: { alignItems: "center", padding: 20, gap: 12 },
  okIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", shadowColor: COLORS.success, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  okText: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 14, textAlign: "center" },
});
