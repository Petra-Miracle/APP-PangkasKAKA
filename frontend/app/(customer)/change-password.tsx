import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

export default function ChangePassword() {
  const router = useRouter();
  const { user } = useAuth();
  const { scrollRef, handleFocus } = useScrollToInput();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Sama seperti edit-profile: layar ini di grup (customer) tapi dibuka lintas
  // grup oleh owner/streetbarber — kembali eksplisit per role (lihat sana).
  const goBackToProfile = () => {
    if (user?.role === "owner") router.replace("/(owner)/profile" as any);
    else if (user?.role === "streetbarber") router.replace("/(streetbarber)/profile" as any);
    else router.back();
  };

  const save = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) { alert("Semua kolom wajib diisi"); return; }
    if (newPassword.length < 8) { alert("Password baru minimal 8 karakter"); return; }
    if (newPassword !== confirmPassword) { alert("Konfirmasi password baru tidak cocok"); return; }
    setSaving(true);
    try {
      await api.put("/auth/change-password", { old_password: oldPassword, new_password: newPassword });
      alert("Password berhasil diubah");
      goBackToProfile();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale onPress={goBackToProfile} style={styles.backBtn} scaleTo={0.9}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Ubah Password</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.label}>PASSWORD LAMA</Text>
        <TextInput
          style={styles.input}
          value={oldPassword}
          onChangeText={setOldPassword}
          placeholder="Password saat ini"
          placeholderTextColor={COLORS.textDim}
          secureTextEntry
          testID="old-password-input"
          onFocus={handleFocus}
        />
        <Text style={styles.label}>PASSWORD BARU</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Minimal 8 karakter"
          placeholderTextColor={COLORS.textDim}
          secureTextEntry
          testID="new-password-input"
          onFocus={handleFocus}
        />
        <Text style={styles.label}>KONFIRMASI PASSWORD BARU</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Ulangi password baru"
          placeholderTextColor={COLORS.textDim}
          secureTextEntry
          testID="confirm-password-input"
          onFocus={handleFocus}
        />

        <PressableScale style={[styles.btnWrap, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="save-password" haptic>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btn}
          >
            {saving ? <ActivityIndicator color={COLORS.onBrand} /> : <Text style={styles.btnText}>SIMPAN PASSWORD BARU</Text>}
          </LinearGradient>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, letterSpacing: -0.4 },

  label: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold, marginBottom: 10, marginTop: 6 },
  input: {
    backgroundColor: COLORS.surface, color: COLORS.text, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    fontFamily: FONT.medium, fontSize: 15, marginBottom: 18,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  btnWrap: { borderRadius: 16, marginTop: 14, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  btn: { padding: 17, alignItems: "center" },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
});
