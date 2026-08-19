import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tint?: string;
};

/** Empty state konsisten di semua layar: ikon besar + judul + deskripsi + CTA opsional. */
export default function EmptyState({ icon, title, description, actionLabel, onAction, tint = COLORS.brand }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={34} color={tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale style={styles.actionBtn} onPress={onAction} haptic>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 28 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, textAlign: "center" },
  desc: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 19 },
  actionBtn: {
    marginTop: 18,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  actionText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 13, letterSpacing: 0.4 },
});