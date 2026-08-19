import React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** Target scale saat ditekan (default 0.97). */
  scaleTo?: number;
  /** Getar ringan saat tap (pakai secukupnya — CTA utama). */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pressable dengan micro-interaction scale-down spring yang halus. */
export default function PressableScale({
  scaleTo = 0.97,
  haptic = false,
  onPress,
  onPressIn,
  onPressOut,
  style,
  disabled,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 18, stiffness: 260 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && !disabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      style={[animStyle, style]}
    />
  );
}