import React, { useEffect } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS, FONT } from "@/src/lib/api";

/**
 * Tema terang (customer): pill mengambang ala mockup — ikon di atas label,
 * item aktif pill amber-soft + ikon/label amber-dark.
 * Tema gelap (Owner/Admin): lingkaran solid + label hanya saat tidak aktif (identitas lama).
 */
function TabItem({ route, descriptor, focused, navigation, light }: any) {
  const { options } = descriptor;
  const dotScale = useSharedValue(0);
  const dotY = useSharedValue(0);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      dotScale.value = withSpring(1, { damping: 14, stiffness: 240 });
      dotY.value = withSpring(-10, { damping: 16, stiffness: 220 });
      iconScale.value = withSpring(1.08, { damping: 14, stiffness: 260 });
    } else {
      dotScale.value = withSpring(0, { damping: 16, stiffness: 260 });
      dotY.value = withSpring(0, { damping: 16, stiffness: 260 });
      iconScale.value = withSpring(1, { damping: 16, stiffness: 260 });
    }
  }, [focused, dotScale, dotY, iconScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }, { translateY: dotY.value }],
  }));
  // Ikon dianimasikan terpisah dari lingkaran latar (dot) — dot boleh
  // mengecil ke 0 saat tidak fokus, tapi ikonnya sendiri harus selalu
  // terlihat penuh (hanya scale 1 <-> 1.08 + ikut naik saat aktif).
  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { translateY: dotY.value }],
  }));
  const iconScaleOnly = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const onPress = () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      Haptics.selectionAsync().catch(() => {});
      navigation.navigate(route.name as never);
    }
  };

  const Icon: any = options.tabBarIcon;
  // Customer (light): pill aktif amber-soft + ikon amber-dark (§1a/§4).
  // Owner/Admin (dark): lingkaran biru solid + ikon putih (identitas lama).
  const inactiveColor = light ? "#9AA3B2" : COLORS.sidebarText;
  const activeIconColor = light ? COLORS.brandLight : "#FFFFFF";

  if (light) {
    return (
      <Pressable
        key={route.key}
        style={[styles.item, styles.itemLight, focused && styles.itemActive]}
        onPress={onPress}
        testID={`tab-${route.name}`}
        android_ripple={{ color: "rgba(15,26,46,0.08)", borderless: true }}
      >
        <Animated.View style={iconScaleOnly}>
          {Icon ? Icon({ focused, color: focused ? activeIconColor : inactiveColor, size: 20 }) : null}
        </Animated.View>
        <Text
          style={[styles.labelLight, { color: focused ? activeIconColor : inactiveColor }, focused && styles.labelLightActive]}
          numberOfLines={1}
        >
          {options.title || route.name}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      key={route.key}
      style={styles.item}
      onPress={onPress}
      testID={`tab-${route.name}`}
      android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: true }}
    >
      <View style={styles.iconZone}>
        <Animated.View style={[styles.dot, styles.dotDark, dotStyle]} />
        <Animated.View style={[styles.iconWrap, iconAnimStyle]}>
          {Icon ? Icon({ focused, color: focused ? activeIconColor : inactiveColor, size: 22 }) : null}
        </Animated.View>
      </View>
      {!focused && (
        <Text style={[styles.label, { color: inactiveColor }]} numberOfLines={1}>
          {options.title || route.name}
        </Text>
      )}
    </Pressable>
  );
}

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Filter out hidden dynamic routes (href: null / tabBarButton: () => null)
  const visibleRoutes = state.routes.filter((r) => {
    const opts = descriptors[r.key]?.options as any;
    if (r.name.includes("[")) return false;
    if (opts?.href === null) return false;
    if (typeof opts?.tabBarButton === "function") return false;
    return true;
  });

  // Tema terang khusus Customer (punya route "ai-scan" / "explore");
  // Owner & Admin memakai identitas navy gelap.
  const light = visibleRoutes.some((r) => r.name === "ai-scan" || r.name === "explore");

  // Layar peta full-screen (absolute overlay atas-bawah): tab bar disembunyikan
  // supaya tidak menutupi sheet — sama seperti layar lacak yang tanpa tab bar.
  // Murni presentasional; rute & navigasi tidak berubah.
  const focusedName = state.routes[state.index]?.name;
  if (focusedName === "streetbarber-map") return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[
        styles.bar,
        light
          ? [styles.barLight, { marginBottom: 10 + insets.bottom }]
          : [styles.barDark, { paddingBottom: 8 + insets.bottom }],
      ]}>
        {visibleRoutes.map((route) => {
          const focused = state.routes[state.index]?.key === route.key;
          return (
            <TabItem
              key={route.key}
              route={route}
              descriptor={descriptors[route.key]}
              focused={focused}
              navigation={navigation}
              light={light}
            />
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
    alignItems: "stretch",
  },
  bar: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderRadius: 0,
    paddingTop: 14,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 16,
    elevation: 16,
  },
  barLight: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    marginHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    overflow: "hidden",
    shadowColor: "#0F1A2E",
    shadowOpacity: 0.12,
  },
  barDark: {
    backgroundColor: COLORS.sidebar,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
  itemLight: { paddingVertical: 6, marginHorizontal: 1, borderRadius: 999 },
  itemActive: { backgroundColor: COLORS.brandDim, marginVertical: 2 },
  labelLight: {
    fontFamily: FONT.semibold,
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  labelLightActive: { fontFamily: FONT.extrabold },
  iconZone: { height: 44, width: 64, alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    height: 46,
    borderRadius: 23,
  },
  dotLight: {
    width: 58,
    backgroundColor: COLORS.brandDim,
    borderWidth: 1,
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  dotDark: {
    width: 46,
    backgroundColor: COLORS.sidebarSurface,
    shadowColor: COLORS.sidebarSurface,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    position: "absolute",
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: FONT.semibold,
    fontSize: 10,
    marginTop: 3,
    maxWidth: 56,
    textAlign: "center",
  },
});