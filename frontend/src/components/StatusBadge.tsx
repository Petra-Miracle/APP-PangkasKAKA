import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";

type StatusConfig = {
  label: string;
  color: string;
  bg: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props = {
  status: string;
  map: Record<string, StatusConfig>;
  size?: "sm" | "md";
};

export default function StatusBadge({ status, map, size = "md" }: Props) {
  const meta = map[status] || { label: status, color: COLORS.textDim, bg: COLORS.surface2 };
  const isSmall = size === "sm";
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }, isSmall && styles.badgeSm]}>
      {meta.icon && <Ionicons name={meta.icon} size={isSmall ? 10 : 12} color={meta.color} style={isSmall ? undefined : { marginRight: 4 }} />}
      <Text style={[styles.text, { color: meta.color }, isSmall && styles.textSm]} numberOfLines={1}>{meta.label}</Text>
    </View>
  );
}

export const BOOKING_STATUS: Record<string, StatusConfig> = {
  pending: { label: "Menunggu Bayar", color: COLORS.warning, bg: "#FFF7ED", icon: "time-outline" },
  confirmed: { label: "Terkonfirmasi", color: COLORS.info, bg: "#EFF8FF", icon: "checkmark-circle-outline" },
  completed: { label: "Selesai", color: COLORS.success, bg: "#ECFDF5", icon: "checkmark-done-outline" },
  cancelled: { label: "Dibatalkan", color: COLORS.error, bg: "#FEF2F2", icon: "close-circle-outline" },
};

export const PAYMENT_STATUS: Record<string, StatusConfig> = {
  unpaid: { label: "Belum Dibayar", color: COLORS.textDim, bg: COLORS.surface2, icon: "wallet-outline" },
  paid: { label: "Sudah Dibayar", color: COLORS.success, bg: "#ECFDF5", icon: "checkmark-circle-outline" },
  failed: { label: "Gagal", color: COLORS.error, bg: "#FEF2F2", icon: "alert-circle-outline" },
  expired: { label: "Kadaluarsa", color: COLORS.textDim, bg: COLORS.surface2, icon: "time-outline" },
};

export const FUND_STATUS: Record<string, StatusConfig> = {
  unpaid: { label: "Belum Dibayar", color: COLORS.textDim, bg: COLORS.surface2 },
  held: { label: "Ditahan Platform", color: COLORS.warning, bg: "#FFF7ED" },
  released: { label: "Dana Sudah Cair", color: COLORS.success, bg: "#ECFDF5" },
  refunded: { label: "Dikembalikan", color: COLORS.error, bg: "#FEF2F2" },
};

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: "flex-start" },
  badgeSm: { paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.3 },
  textSm: { fontSize: 10 },
});
