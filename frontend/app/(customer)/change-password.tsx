import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

export default function ChangePassword() {
  const router = useRouter();
  const { scrollRef, handleFocus } = useScrollToInput();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) { alert("Semua kolom wajib diisi"); return; }
    if (newPassword.length < 8) { alert("Password baru minimal 8 karakter"); return; }
    if (newPassword !== confirmPassword) { alert("Konfirmasi password baru tidak cocok"); return; }
    setSaving(true);
    try {
      await api.put("/auth/change-password", { old_password: oldPassword, new_password: newPassword });
      alert("Password berhasil diubah");
      router.back();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn} scaleTo={0.9}>
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
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>SIMPAN PASSWORD BARU</Text>}
          </LinearGradient>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold },

  label: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: COLORS.surface, color: COLORS.text, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    fontFamily: FONT.medium, fontSize: 15, marginBottom: 16,
  },
  btnWrap: { borderRadius: 14, marginTop: 12, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { padding: 15, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
});
