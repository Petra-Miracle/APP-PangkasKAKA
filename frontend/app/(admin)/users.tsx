import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonRow } from "@/src/components/Skeleton";

const TABS = [
  { key: "customer", label: "Pelanggan", icon: "person" },
  { key: "owner", label: "Owner", icon: "storefront" },
  { key: "karyawan", label: "StreetBarber", icon: "cut" },
  { key: "admin", label: "Admin", icon: "shield" },
];

export default function Users() {
  const [tab, setTab] = useState("customer");
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/admin/users?role=${tab}&search=${encodeURIComponent(q)}`); setUsers(r.users); } catch {} finally { setLoading(false); }
  }, [tab, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <Text style={styles.headerTitle}>Pengguna</Text>
        <Text style={styles.headerSub}>{users.length} pengguna terdaftar</Text>
      </LinearGradient>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 60 }}>
        {TABS.map((t) => (
          <PressableScale key={t.key} testID={`u-tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]} scaleTo={0.94}>
            <Ionicons name={t.icon as any} size={14} color={tab === t.key ? "#FFFFFF" : COLORS.textDim} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </PressableScale>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textDim} />
          <TextInput style={styles.input} placeholder="Cari berdasarkan nama..." placeholderTextColor={COLORS.textDim} value={q} onChangeText={setQ} onSubmitEditing={load} />
        </View>
      </View>
      {loading ? (
        <View style={{ padding: 20, gap: 10 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 120 }}>
          {users.length === 0 && (
            <EmptyState
              icon="people-outline"
              title="Tidak ada pengguna"
              description="Coba ubah kata kunci pencarian atau pilih role lain."
            />
          )}
          {users.map((u) => (
            <View key={u.id} style={styles.row} testID={`user-${u.id}`}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitial}>{u.name?.[0]?.toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uName}>{u.name}</Text>
                <Text style={styles.uMeta}>{u.email}</Text>
                <Text style={styles.uMeta}>{u.phone}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.05)", top: -65, right: -35 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 12 },
  tab: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 12 },
  tabTextActive: { color: "#FFFFFF" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  input: { flex: 1, color: COLORS.text, fontFamily: FONT.medium, fontSize: 14 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.brandDim },
  userInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18 },
  uName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  uMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 1, fontFamily: FONT.medium },
});