import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";

/** Hero blue header dengan logo + curved bottom untuk auth screens */
export function AuthHero({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <LinearGradient colors={["#0059C9", COLORS.brand, "#3B8CFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.logoBadge}>
        <Ionicons name="cut" size={26} color={COLORS.brand} />
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
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.btnWrap, pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={["#0059C9", COLORS.brand, "#4C9FFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        <Text style={styles.btnText}>{loading ? "MEMPROSES..." : label}</Text>
        {!loading && icon && <Ionicons name={icon} size={16} color="#FFFFFF" />}
      </LinearGradient>
    </Pressable>
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  logoBadge: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0A2540", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  brand: { color: "#FFFFFF", fontSize: 24, fontFamily: FONT.extrabold, marginTop: 14, letterSpacing: -0.5 },
  title: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.bold, marginTop: 24, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: FONT.medium, marginTop: 6, textAlign: "center" },

  btnWrap: { borderRadius: 16, marginTop: 20, shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, overflow: "hidden" },
  btn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 20 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 14 },
});
