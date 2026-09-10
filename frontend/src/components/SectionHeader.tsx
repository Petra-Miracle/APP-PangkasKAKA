import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  live?: boolean;
};

export default function SectionHeader({ title, actionLabel, onAction, icon, live }: Props) {
  return (
    <View style={styles.row}>
      {live && <View style={styles.liveDot} />}
      {icon && !live && <Ionicons name={icon} size={16} color={COLORS.brand} style={{ marginRight: 6 }} />}
      <Text style={styles.title}>{title}</Text>
      {live && (
        <View style={styles.livePill}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} style={styles.pill} scaleTo={0.95}>
          <Text style={styles.pillText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={12} color={COLORS.brand} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 17, fontFamily: FONT.extrabold, flex: 1, letterSpacing: -0.2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 6 },
  livePill: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginLeft: 6 },
  liveText: { color: COLORS.success, fontSize: 9, fontFamily: FONT.bold, letterSpacing: 0.6 },
});
