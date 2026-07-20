import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";

const ROLE_LABEL: Record<string, string> = {
  customer: "Pelanggan", owner: "Pemilik Toko", admin: "Administrator", karyawan: "Barber",
};

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const doLogout = async () => { await logout(); router.replace("/(auth)/login"); };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={styles.title}>Profil</Text>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "?"}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.mail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.brand} />
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role || ""] || user?.role}</Text>
          </View>
        </View>
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
    <Pressable style={styles.item} onPress={onPress} testID={testID}>
      <View style={[styles.itemIcon, danger && { backgroundColor: "#FEF2F2" }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.error : COLORS.brand} />
      </View>
      <Text style={[styles.itemText, danger && { color: COLORS.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginBottom: 20, letterSpacing: -0.3 },
  hero: { backgroundColor: COLORS.surface, padding: 28, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, shadowColor: "#0A2540", shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  avatar: { width: 84, height: 84, borderRadius: 999, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center", shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6 },
  avatarText: { color: "#FFFFFF", fontSize: 36, fontFamily: FONT.extrabold },
  name: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, marginTop: 14 },
  mail: { color: COLORS.textDim, marginTop: 4, fontFamily: FONT.medium, fontSize: 13 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 12 },
  roleText: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
  menu: { marginTop: 20, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemText: { color: COLORS.text, flex: 1, fontFamily: FONT.semibold, fontSize: 14 },
});
