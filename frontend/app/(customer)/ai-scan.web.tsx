import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

const APK_URL =
  "https://github.com/Petra-Miracle/APP-PangkasKAKA/releases/latest";

// AI Face Scan butuh akses kamera native (react-native-vision-camera) yang
// tidak punya implementasi web — file .web.tsx ini otomatis dipilih Metro saat
// build untuk web, supaya modul native itu tidak ikut ter-bundle/dieksekusi di
// browser (yang akan crash). Fitur asli tetap jalan penuh di aplikasi mobile.
export default function AIScanWeb() {
  const router = useRouter();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.head}>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Ionicons name="sparkles" size={24} color={COLORS.onBrand} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Face Scan</Text>
            <Text style={styles.sub}>Deteksi bentuk wajah real-time, langsung di HP-mu</Text>
          </View>
        </View>

        <View style={styles.box}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait-outline" size={40} color={COLORS.brandLight} />
          </View>
          <Text style={styles.boxTitle}>Tersedia di Aplikasi Mobile</Text>
          <Text style={styles.boxText}>
            Fitur ini pakai kamera & pemrosesan langsung di perangkat (tidak ada foto yang dikirim ke server), jadi hanya bisa dijalankan lewat aplikasi Android/iOS — bukan di browser.
          </Text>
          <PressableScale style={styles.btnWrap} onPress={() => router.push("/(customer)/explore" as any)} haptic>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>JELAJAHI BARBER</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.onBrand} />
            </LinearGradient>
          </PressableScale>
        </View>
      </ScrollView>

      {!bannerDismissed && (
        <View style={styles.a2hsWrap}>
          <View style={styles.a2hsCard}>
            <Image
              source={require("@/assets/images/icon-app.png")}
              style={styles.a2hsIcon}
              contentFit="cover"
            />
            <Text style={styles.a2hsText} numberOfLines={1}>
              Pasang aplikasi PangkasKAKA untuk coba AI Face Scan
            </Text>
            <Pressable
              onPress={() => {
                if (typeof window !== "undefined") window.open(APK_URL, "_blank");
              }}
              style={styles.a2hsAction}
              hitSlop={8}
            >
              <Ionicons name="download-outline" size={18} color={COLORS.onBrand} />
            </Pressable>
            <Pressable onPress={() => setBannerDismissed(true)} style={styles.a2hsClose} hitSlop={8}>
              <Ionicons name="close" size={16} color={COLORS.textDim} />
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  sub: { color: COLORS.textDim, marginTop: 2, fontSize: 12, fontFamily: FONT.medium },

  box: {
    backgroundColor: COLORS.surface, borderRadius: 24, padding: 32, alignItems: "center", borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  boxTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 17, textAlign: "center" },
  boxText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 },
  btnWrap: { borderRadius: 14, marginTop: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },

  // Banner ala "Add to Home Screen" — pola familiar yang sudah dikenal user
  // dari PWA/app install prompt di browser lain, dipakai ulang di sini
  // sebagai ajakan install aplikasi khusus untuk fitur AI Face Scan.
  a2hsWrap: { position: "absolute", left: 0, right: 0, bottom: 16, paddingHorizontal: 16, alignItems: "center" },
  a2hsCard: {
    flexDirection: "row", alignItems: "center", gap: 10, width: "100%", maxWidth: 380,
    backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 10, paddingHorizontal: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  a2hsIcon: { width: 36, height: 36, borderRadius: 10 },
  a2hsText: { flex: 1, color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 13 },
  a2hsAction: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.brand,
  },
  a2hsClose: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
});
