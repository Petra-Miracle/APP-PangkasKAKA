import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS } from "@/src/lib/api";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
      <ActivityIndicator color={COLORS.brand} size="large" />
    </View>
  );
}
const styles = StyleSheet.create({ center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" } });
