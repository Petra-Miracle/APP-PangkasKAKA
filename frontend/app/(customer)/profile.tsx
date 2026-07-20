import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS } from "@/src/lib/api";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const doLogout = async () => { await logout(); router.replace("/(auth)/login"); };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Profil</Text>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "?"}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.mail}>{user?.email}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text></View>
        </View>
        <View style={styles.menu}>
          <MenuItem icon="receipt-outline" label="Riwayat Pesanan" onPress={() => router.push("/(customer)/orders")} />
          <MenuItem icon="sparkles-outline" label="Riwayat AI Scan" onPress={() => router.push("/(customer)/ai-scan")} />
          <MenuItem icon="log-out-outline" label="Keluar" onPress={doLogout} danger testID="logout-btn" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress, danger, testID }: any) {
  return (
    <Pressable style={styles.item} onPress={onPress} testID={testID}>
      <Ionicons name={icon} size={22} color={danger ? COLORS.error : COLORS.brandLight} />
      <Text style={[styles.itemText, danger && { color: COLORS.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginBottom: 20 },
  card: { backgroundColor: COLORS.surface, padding: 24, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 72, height: 72, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.brand },
  avatarText: { color: COLORS.brand, fontSize: 32, fontWeight: "900" },
  name: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 12 },
  mail: { color: COLORS.textDim, marginTop: 4 },
  roleBadge: { backgroundColor: COLORS.brandDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginTop: 8 },
  roleText: { color: COLORS.brandLight, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  menu: { marginTop: 20, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemText: { color: COLORS.text, flex: 1, fontWeight: "700" },
});
