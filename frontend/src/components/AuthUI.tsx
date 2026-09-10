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
      <View pointerEvents="none" style={styles.decoRing2} />
      <View style={styles.logoBadge}>
        <Image source={require("@/assets/images/icon-app.png")} style={styles.logoImg} contentFit="contain" />
      </View>
      <Text style={styles.brand}>PangkasKAKA</Text>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </LinearGradient>
  );
}

/** Tombol primary amber — label ink gelap di atas amber (Design System Pendev §4) */
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
          <Ionicons name="sync" size={18} color={COLORS.onBrand} style={{ opacity: 0.9 }} />
        ) : null}
        <Text style={styles.btnText}>{loading ? "MEMPROSES..." : label}</Text>
        {!loading && icon && <Ionicons name={icon} size={16} color={COLORS.onBrand} />}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 36,
    elevation: 14,
    overflow: "hidden",
  },
  decoCircleL: {
    position: "absolute",
    width: 240, height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -100, left: -90,
  },
  decoCircleR: {
    position: "absolute",
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -80, right: -60,
  },
  decoRing: {
    position: "absolute",
    width: 140, height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    top: 30, right: -40,
  },
  decoRing2: {
    position: "absolute",
    width: 80, height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    bottom: 40, left: -20,
  },
  logoBadge: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F1A2E", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  logoImg: { width: 50, height: 50, borderRadius: 14 },
  brand: { color: COLORS.onBrand, fontSize: 26, fontFamily: FONT.extrabold, marginTop: 16, letterSpacing: -0.5 },
  title: { color: COLORS.onBrand, fontSize: 22, fontFamily: FONT.bold, marginTop: 26, textAlign: "center" },
  subtitle: { color: "rgba(15,26,46,0.75)", fontSize: 13, fontFamily: FONT.medium, marginTop: 8, textAlign: "center", lineHeight: 19 },

  btnWrap: { borderRadius: 16, marginTop: 22, shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10, overflow: "hidden" },
  btn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 17, paddingHorizontal: 20, minHeight: 54 },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
});