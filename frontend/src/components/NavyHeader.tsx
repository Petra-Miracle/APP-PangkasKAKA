import React, { type ReactNode } from "react";
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/api";

type Props = {
  children: ReactNode;
  back?: boolean;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
  bottomRadius?: boolean;
};

/** Header navy bergradasi untuk layar Owner / StreetBarber / Admin. */
export default function NavyHeader({ children, back, onBack, style, bottomRadius = true }: Props) {
  return (
    <LinearGradient
      colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, bottomRadius && styles.bottomRadius, style]}
    >
      {back && (
        <Pressable style={styles.backBtn} onPress={onBack} testID="navy-back" hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
      )}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bottomRadius: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
});