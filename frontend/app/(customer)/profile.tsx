import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

const ROLE_LABEL: Record<string, string> = {
  customer: "Pelanggan", owner: "Pemilik Toko", admin: "Administrator", karyawan: "StreetBarber",
};

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const doLogout = async () => { await logout(); router.replace("/(auth)/login"); };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={styles.title}>Profil</Text>
        <LinearGradient
          colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.decoCircle} />
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "?"}</Text>
            </View>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.mail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.brand} />
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role || ""] || user?.role}</Text>
          </View>
        </LinearGradient>
        <View style={styles.menu}>
          {user?.role === "customer" && <>
            <MenuItem icon="receipt-outline" label="Riwayat Pesanan" onPress={() => router.push("/(customer)/orders" as any)} />
            <MenuItem icon="sparkles-outline" label="AI Face Scan" onPress={() => router.push("/(customer)/ai-scan" as any)} />
          </>}
          {user?.role === "owner" && <>
            <MenuItem icon="grid-outline" label="Dashboard Toko" onPress={() => router.push("/(owner)/dashboard" as any)} />
            <MenuItem icon="construct-outline" label="Kelola Toko" onPress={() => router.push("/(owner)/manage" as any)} />
          </>}
          {user?.role === "admin" && <>
            <MenuItem icon="shield-checkmark-outline" label="Verifikasi Toko" onPress={() => router.push("/(admin)/verification" as any)} />
            <MenuItem icon="people-outline" label="Pengguna" onPress={() => router.push("/(admin)/users" as any)} />
          </>}
          <MenuItem icon="log-out-outline" label="Keluar" onPress={doLogout} danger testID="logout-btn" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress, danger, testID }: any) {
  return (
    <PressableScale style={styles.item} onPress={onPress} testID={testID} scaleTo={0.98}>
      <View style={[styles.itemIcon, danger && { backgroundColor: "#FEF2F2" }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.error : COLORS.brand} />
      </View>
      <Text style={[styles.itemText, danger && { color: COLORS.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginBottom: 20, letterSpacing: -0.3 },
  hero: {
    padding: 28, borderRadius: 24, alignItems: "center", overflow: "hidden",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  decoCircle: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)", top: -80, right: -60 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  avatar: { width: 86, height: 86, borderRadius: 999, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.brand, fontSize: 36, fontFamily: FONT.extrabold },
  name: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 12 },
  mail: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontFamily: FONT.medium, fontSize: 13 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 12 },
  roleText: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
  menu: { marginTop: 20, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemText: { color: COLORS.text, flex: 1, fontFamily: FONT.semibold, fontSize: 14 },
});