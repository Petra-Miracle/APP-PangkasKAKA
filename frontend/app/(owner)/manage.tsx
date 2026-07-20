import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, COLORS, rupiah } from "@/src/lib/api";

export default function Manage() {
  const [tab, setTab] = useState<"barbers" | "services" | "karyawan">("barbers");
  const [shop, setShop] = useState<any>(null);
  const [karyawan, setKaryawan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [b, setB] = useState({ name: "", specialization: "" });
  const [s, setS] = useState({ name: "", duration: "30", price: "35000" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/owner/shop");
      if (r.shop) {
        const d = await api.get(`/shops/${r.shop.id}`);
        setShop(d);
      }
      const k = await api.get("/owner/karyawan");
      setKaryawan(k.karyawan);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addBarber = async () => {
    if (!b.name) return;
    try { await api.post("/owner/barbers", { name: b.name, specialization: b.specialization, skill_level: "Standar" }); setB({ name: "", specialization: "" }); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const addService = async () => {
    if (!s.name) return;
    try { await api.post("/owner/services", { name: s.name, duration: parseInt(s.duration), price: parseInt(s.price) }); setS({ name: "", duration: "30", price: "35000" }); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const evaluate = async (kid: string) => {
    try {
      await api.post(`/owner/karyawan/${kid}/evaluate`, {
        portfolio_weight: 15, experience_weight: 12, tools_weight: 10,
        bnsp_weight: 10, cert_weight: 8, diploma_weight: 12,
      });
      await load();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;
  if (!shop) return <SafeAreaView style={styles.safe}><Text style={styles.empty}>Daftarkan toko terlebih dulu di Dashboard.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>Kelola Toko</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 56 }}>
        {[["barbers", "Barber"], ["services", "Layanan"], ["karyawan", "Pelamar"]].map(([k, l]) => (
          <Pressable key={k} testID={`tab-${k}`} onPress={() => setTab(k as any)} style={[styles.tab, tab === k && styles.tabActive]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {tab === "barbers" && (
          <View>
            {shop.barbers.map((br: any) => (
              <View key={br.id} style={styles.item} testID={`brb-${br.id}`}>
                <Text style={styles.itemName}>{br.name}</Text>
                <Text style={styles.itemMeta}>{br.skill_level} · {br.specialization}</Text>
              </View>
            ))}
            <View style={styles.card}>
              <TextInput style={styles.input} value={b.name} onChangeText={(t) => setB({ ...b, name: t })} placeholder="Nama barber" placeholderTextColor={COLORS.textDim} testID="new-barber-name" />
              <TextInput style={styles.input} value={b.specialization} onChangeText={(t) => setB({ ...b, specialization: t })} placeholder="Spesialisasi" placeholderTextColor={COLORS.textDim} />
              <Pressable style={styles.btn} onPress={addBarber} testID="add-barber"><Text style={styles.btnText}>TAMBAH BARBER</Text></Pressable>
            </View>
          </View>
        )}
        {tab === "services" && (
          <View>
            {shop.services.map((sv: any) => (
              <View key={sv.id} style={styles.item}>
                <Text style={styles.itemName}>{sv.name}</Text>
                <Text style={styles.itemMeta}>{sv.duration} menit · {rupiah(sv.price)}</Text>
              </View>
            ))}
            <View style={styles.card}>
              <TextInput style={styles.input} value={s.name} onChangeText={(t) => setS({ ...s, name: t })} placeholder="Nama layanan" placeholderTextColor={COLORS.textDim} testID="new-svc-name" />
              <TextInput style={styles.input} value={s.duration} onChangeText={(t) => setS({ ...s, duration: t })} placeholder="Durasi (menit)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" />
              <TextInput style={styles.input} value={s.price} onChangeText={(t) => setS({ ...s, price: t })} placeholder="Harga (Rp)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" />
              <Pressable style={styles.btn} onPress={addService} testID="add-service"><Text style={styles.btnText}>TAMBAH LAYANAN</Text></Pressable>
            </View>
          </View>
        )}
        {tab === "karyawan" && (
          <View>
            {karyawan.length === 0 && <Text style={styles.empty}>Belum ada pelamar.</Text>}
            {karyawan.map((k: any) => (
              <View key={k.id} style={styles.item}>
                <Text style={styles.itemName}>{k.name}</Text>
                <Text style={styles.itemMeta}>Status: {k.status} · Skor: {k.total_score}</Text>
                {k.status === "pending" && (
                  <Pressable style={styles.btnSmall} onPress={() => evaluate(k.id)} testID={`eval-${k.id}`}>
                    <Text style={styles.btnText}>EVALUASI</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", padding: 16 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  tab: { flexShrink: 0, height: 36, paddingHorizontal: 16, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textDim, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#121212" },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40 },
  item: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 4, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  itemName: { color: COLORS.text, fontWeight: "700" },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  card: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 4, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  btn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 4, alignItems: "center" },
  btnSmall: { backgroundColor: COLORS.brand, padding: 8, borderRadius: 4, alignItems: "center", marginTop: 8 },
  btnText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
});
