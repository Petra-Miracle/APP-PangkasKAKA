import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

// AI Face Scan butuh akses kamera native (react-native-vision-camera) yang
// tidak punya implementasi web — file .web.tsx ini otomatis dipilih Metro saat
// build untuk web, supaya modul native itu tidak ikut ter-bundle/dieksekusi di
// browser (yang akan crash). Fitur asli tetap jalan penuh di aplikasi mobile.
export default function AIScanWeb() {
  const router = useRouter();
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
            <Ionicons name="sparkles" size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AI Face Scan</Text>
            <Text style={styles.sub}>Deteksi bentuk wajah real-time, langsung di HP-mu</Text>
          </View>
        </View>

        <View style={styles.box}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait-outline" size={40} color={COLORS.brand} />
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
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </LinearGradient>
          </PressableScale>
        </View>
      </ScrollView>
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
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
});
