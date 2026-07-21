import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { COLORS, FONT } from "@/src/lib/api";

const PALETTE = [COLORS.brand, "#00B27A", "#F5A524", "#8B5CF6", "#EC4899", "#0EA5E9"];

export default function Donut({ data, size = 140, centerLabel, centerValue }: any) {
  const items = (data || []).filter((d: any) => d.pct > 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.surface2} strokeWidth={stroke} fill="none" />
            {items.map((seg: any, i: number) => {
              const len = (seg.pct / 100) * c;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2} cy={size / 2} r={r}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  fill="none"
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        <View style={styles.center}>
          <Text style={styles.centerValue}>{centerValue}</Text>
          <Text style={styles.centerLabel}>{centerLabel}</Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 16, gap: 8 }}>
        {items.map((seg: any, i: number) => (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
            <Text style={styles.legendName} numberOfLines={1}>{seg.name}</Text>
            <Text style={styles.legendPct}>{seg.pct}%</Text>
          </View>
        ))}
        {items.length === 0 && <Text style={{ color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 }}>Belum ada data</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  center: { position: "absolute", alignItems: "center" },
  centerValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 20 },
  centerLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10, marginTop: 2 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  legendName: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },
  legendPct: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 12 },
});
