import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";

export default function EditProfile() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { scrollRef, handleFocus } = useScrollToInput();
  const [name, setName] = useState(user?.name || "");
  const [photo, setPhoto] = useState(user?.photo || "");
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { alert("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled) return;
    const resized = await ImageManipulator.manipulateAsync(
      res.assets[0].uri,
      [{ resize: { width: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    setPhoto(`data:image/jpeg;base64,${resized.base64}`);
  };

  // Layar ini hidup di grup (customer) tapi dibuka juga oleh owner/streetbarber
  // lintas grup. router.back() polos dari stack grup yang tak punya riwayat
  // intra-grup jatuh ke rute awal grup (Beranda customer) — jadi kembali
  // eksplisit ke profil role masing-masing. Alur customer tidak berubah.
  const goBackToProfile = () => {
    if (user?.role === "owner") router.replace("/(owner)/profile" as any);
    else if (user?.role === "streetbarber") router.replace("/(streetbarber)/profile" as any);
    else router.back();
  };

  const save = async () => {
    if (!name.trim()) { alert("Nama tidak boleh kosong"); return; }
    setSaving(true);
    try {
      const body: any = { name: name.trim() };
      if (photo && photo !== user?.photo) body.photo = photo;
      await api.put("/auth/profile", body);
      await refresh();
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
        <Text style={styles.title}>Edit Profil</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.avatarSection}>
          <PressableScale onPress={pickPhoto} testID="pick-avatar" scaleTo={0.96}>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatar}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || "?"}</Text>
                )}
              </View>
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={14} color={COLORS.onBrand} />
              </View>
            </LinearGradient>
          </PressableScale>
          <Text style={styles.avatarHint}>Ketuk untuk ganti foto profil</Text>
        </View>

        <Text style={styles.label}>NAMA</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nama lengkap"
          placeholderTextColor={COLORS.textDim}
          testID="edit-name-input"
          onFocus={handleFocus}
        />

        <PressableScale style={[styles.btnWrap, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="save-profile" haptic>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btn}
          >
            {saving ? <ActivityIndicator color={COLORS.onBrand} /> : <Text style={styles.btnText}>SIMPAN PERUBAHAN</Text>}
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

  avatarSection: { alignItems: "center", marginTop: 16, marginBottom: 32 },
  avatarRing: { width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center" },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 104, height: 104, borderRadius: 52 },
  avatarText: { color: COLORS.brandLight, fontSize: 40, fontFamily: FONT.extrabold },
  editBadge: {
    position: "absolute", bottom: 4, right: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.brand,
    alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: COLORS.bg,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  avatarHint: { color: COLORS.textDim, fontSize: 13, fontFamily: FONT.medium, marginTop: 14 },

  label: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.surface, color: COLORS.text, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    fontFamily: FONT.medium, fontSize: 15, marginBottom: 22,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  btnWrap: { borderRadius: 16, marginTop: 6, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  btn: { padding: 17, alignItems: "center" },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
});
