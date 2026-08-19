import { useEffect } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "@/src/lib/api";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Skeleton shimmer reusable — loop opacity pulse tanpa library tambahan. */
export default function Skeleton({ width = "100%", height, radius = 12, style }: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: COLORS.border }, animStyle, style]}
    />
  );
}

/** Skeleton khas kartu barbershop (gambar + baris teks). */
export function SkeletonShopCard() {
  return (
    <View style={styles.card}>
      <Skeleton height={150} radius={16} />
      <View style={{ padding: 14, gap: 8 }}>
        <Skeleton width="70%" height={16} radius={6} />
        <Skeleton width="90%" height={12} radius={6} />
        <Skeleton width="45%" height={12} radius={6} />
      </View>
    </View>
  );
}

/** Skeleton khas kartu pesanan / daftar (avatar + teks). */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={56} height={56} radius={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={14} radius={6} />
        <Skeleton width="85%" height={11} radius={6} />
        <Skeleton width="40%" height={11} radius={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: COLORS.radiusLg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: COLORS.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
});