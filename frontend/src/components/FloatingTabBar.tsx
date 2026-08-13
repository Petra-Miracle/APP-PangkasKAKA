import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/lib/api";

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
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };
          const Icon: any = options.tabBarIcon;
          return (
            <Pressable key={route.key} style={styles.item} onPress={onPress} testID={`tab-${route.name}`} android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}>
              {focused ? (
                <View style={styles.activeBadge}>
                  {Icon ? Icon({ focused: true, color: COLORS.sidebar, size: 22 }) : null}
                </View>
              ) : (
                <View style={styles.iconWrap}>
                  {Icon ? Icon({ focused: false, color: COLORS.sidebarTextDim, size: 22 }) : null}
                </View>
              )}
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
    paddingHorizontal: 28,
  },
  bar: {
    flexDirection: "row",
    alignSelf: "stretch",
    backgroundColor: COLORS.sidebar,
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 14,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  activeBadge: {
    width: 46, height: 40, borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  iconWrap: { width: 46, height: 40, alignItems: "center", justifyContent: "center" },
});
