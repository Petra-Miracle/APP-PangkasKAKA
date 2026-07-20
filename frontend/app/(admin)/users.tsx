import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, COLORS } from "@/src/lib/api";

const TABS = ["customer", "owner", "karyawan", "admin"];

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
      <Text style={styles.title}>Pengguna</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 56 }}>
        {TABS.map((t) => (
          <Pressable key={t} testID={`u-tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 16 }}>
        <TextInput style={styles.input} placeholder="Cari nama..." placeholderTextColor={COLORS.textDim} value={q} onChangeText={setQ} onSubmitEditing={load} />
      </View>
      {loading ? <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}>
          {users.length === 0 && <Text style={styles.empty}>Tidak ada.</Text>}
          {users.map((u) => (
            <View key={u.id} style={styles.row} testID={`user-${u.id}`}>
              <Text style={styles.uName}>{u.name}</Text>
              <Text style={styles.uMeta}>{u.email} · {u.phone}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", padding: 16 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  tab: { flexShrink: 0, height: 36, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textDim, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: "#121212" },
  input: { backgroundColor: COLORS.surface, color: COLORS.text, padding: 12, borderRadius: 4, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40 },
  row: { padding: 12, backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  uName: { color: COLORS.text, fontWeight: "700" },
  uMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
});
