import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

/** Hero blue header dengan logo + curved bottom untuk auth screens */
export function AuthHero({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <LinearGradient
      colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={styles.decoCircleL} />
      <View pointerEvents="none" style={styles.decoCircleR} />
      <View pointerEvents="none" style={styles.decoRing} />
      <View style={styles.logoBadge}>
        <Image source={require("@/assets/images/icon-app.png")} style={styles.logoImg} contentFit="contain" />
      </View>
      <Text style={styles.brand}>PangkasKAKA</Text>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </LinearGradient>
  );
}

/** Tombol gradient primary — untuk CTA di auth screens */
export function GradientButton({ label, onPress, loading, icon, testID, disabled }: any) {
  return (
    <PressableScale testID={testID} onPress={onPress} disabled={disabled || loading} haptic style={styles.btnWrap}>
      <LinearGradient
        colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {loading ? (
          <Ionicons name="sync" size={18} color="#FFFFFF" style={{ opacity: 0.9 }} />
        ) : null}
        <Text style={styles.btnText}>{loading ? "MEMPROSES..." : label}</Text>
        {!loading && icon && <Ionicons name={icon} size={16} color="#FFFFFF" />}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 12,
    overflow: "hidden",
  },
  decoCircleL: {
    position: "absolute",
    width: 220, height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -90, left: -80,
  },
  decoCircleR: {
    position: "absolute",
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -70, right: -50,
  },
  decoRing: {
    position: "absolute",
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    top: 30, right: -34,
  },
  logoBadge: {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  logoImg: { width: 46, height: 46, borderRadius: 12 },
  brand: { color: "#FFFFFF", fontSize: 24, fontFamily: FONT.extrabold, marginTop: 14, letterSpacing: -0.5 },
  title: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.bold, marginTop: 24, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: FONT.medium, marginTop: 6, textAlign: "center" },

  btnWrap: { borderRadius: 16, marginTop: 20, shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8, overflow: "hidden" },
  btn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 20 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
});