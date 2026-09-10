import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

const SLIDES = [
  {
    icon: "cut" as const,
    title: "Potong rambut, kamu yang atur.",
    desc: "Pilih barbershop favorit atau panggil StreetBarber ke rumahmu. Semua dalam satu aplikasi.",
  },
  {
    icon: "shield-checkmark" as const,
    title: "Bayar aman dengan QRIS.",
    desc: "Uangmu ditahan PangkasKAKA sampai layanan selesai. Baru diteruskan ke toko.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;
  const s = SLIDES[idx];

  const finish = async () => {
    try { await AsyncStorage.setItem("onboarding_seen", "1"); } catch {}
    router.replace("/(auth)/login" as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <PressableScale onPress={finish} testID="onboarding-skip" scaleTo={0.96} style={styles.skipBtn}>
          <Text style={styles.skipText}>Lewati</Text>
        </PressableScale>

        <LinearGradient
          colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.deco} />
          <View style={styles.logoBadge}>
            <Ionicons name={s.icon} size={44} color={COLORS.text} />
          </View>
        </LinearGradient>

        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.desc}>{s.desc}</Text>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>

        <PressableScale
          onPress={() => (last ? finish() : setIdx(idx + 1))}
          testID="onboarding-next"
          haptic
          style={styles.btnWrap}
        >
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>{last ? "MULAI" : "LANJUT"}</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
          </LinearGradient>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { flex: 1, padding: 24, paddingBottom: 32 },
  skipBtn: { alignSelf: "flex-end", padding: 8 },
  skipText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 13 },
  hero: {
    marginTop: 24, borderRadius: 28, paddingVertical: 56, alignItems: "center", overflow: "hidden",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  deco: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.18)", top: -80, right: -60 },
  logoBadge: {
    width: 96, height: 96, borderRadius: 30, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F1A2E", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, letterSpacing: -0.4, marginTop: 28, textAlign: "center" },
  desc: { color: COLORS.textDim, fontSize: 14, fontFamily: FONT.medium, marginTop: 10, textAlign: "center", lineHeight: 21 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 24, marginBottom: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderStrong },
  dotActive: { width: 24, backgroundColor: COLORS.brand },
  btnWrap: { borderRadius: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 },
  btn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 17, minHeight: 54 },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
});
