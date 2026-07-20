import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONT } from "@/src/lib/api";

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Filter out hidden dynamic routes (href: null)
  const visibleRoutes = state.routes.filter((r) => {
    const opts = descriptors[r.key]?.options as any;
    // hide dynamic routes and explicit href:null
    if (r.name.includes("[")) return false;
    if (opts?.href === null) return false;
    return true;
  });

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
          const focused = state.routes[state.index]?.key === route.key;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };
          const Icon: any = options.tabBarIcon;
          return (
            <Pressable key={route.key} style={styles.item} onPress={onPress} testID={`tab-${route.name}`} android_ripple={{ color: COLORS.brandDim, borderless: true }}>
              {focused ? (
                <View style={styles.activeBadge}>
                  {Icon ? Icon({ focused: true, color: "#FFFFFF", size: 22 }) : null}
                </View>
              ) : (
                <View style={styles.iconWrap}>
                  {Icon ? Icon({ focused: false, color: COLORS.textDim, size: 22 }) : null}
                </View>
              )}
              <Text style={[styles.label, focused && { color: COLORS.brand, fontFamily: FONT.bold }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: "row",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: 36,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 2 },
  activeBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.brand,
    alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  iconWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  label: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold, marginTop: 2 },
});
