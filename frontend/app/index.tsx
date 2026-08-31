import { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withDelay, Easing } from "react-native-reanimated";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";

/** Titik loading kecil yang berdenyut bergantian — versi bermerek dari ActivityIndicator generik. */
function LoadingDot({ delay }: { delay: number }) {
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) }),
        withTiming(0.6, { duration: 420, easing: Easing.in(Easing.ease) }),
      ),
      -1,
    ));
  }, [scale, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 0.4 + scale.value * 0.6 }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const logoScale = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [logoScale]);
  const logoAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/(auth)/login"); return; }
    if (user.role === "admin") router.replace("/(admin)/dashboard");
    else if (user.role === "owner") router.replace("/(owner)/dashboard");
    else if (user.role === "karyawan") router.replace("/(karyawan)/status");
    else router.replace("/(customer)/home");
  }, [user, loading, router]);

  return (
    <View style={styles.center} testID="splash-view">
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        <View pointerEvents="none" style={styles.decoBig} />
        <View pointerEvents="none" style={styles.decoSmall} />
        <Animated.View style={[styles.logo, logoAnimStyle]}>
          <View style={styles.logoRing} />
          <Image source={require("@/assets/images/icon-app.png")} style={styles.logoImg} contentFit="contain" />
        </Animated.View>
        <Text style={styles.brand}>PangkasKAKA</Text>
        <Text style={styles.tag}>Barbershop · Kupang NTT</Text>
        <View style={styles.spinner}>
          <LoadingDot delay={0} />
          <LoadingDot delay={140} />
          <LoadingDot delay={280} />
        </View>
      </LinearGradient>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1 },
  bg: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  decoBig: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(255,255,255,0.05)", top: -90, right: -80 },
  decoSmall: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.04)", bottom: -50, left: -40 },
  logo: {
    width: 108, height: 108, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  logoRing: { position: "absolute", width: 92, height: 92, borderRadius: 30, borderWidth: 2, borderColor: COLORS.gold, opacity: 0.55 },
  logoImg: { width: 72, height: 72, borderRadius: 18 },
  brand: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 28, marginTop: 18, letterSpacing: -0.5 },
  tag: { color: COLORS.sidebarTextDim, fontFamily: FONT.medium, fontSize: 13, marginTop: 4, letterSpacing: 1 },
  spinner: { flexDirection: "row", gap: 8, marginTop: 40 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.gold },
});