import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";

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
      if (r.shop) { const d = await api.get(`/shops/${r.shop.id}`); setShop(d); }
      const k = await api.get("/owner/karyawan"); setKaryawan(k.karyawan);
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
        portfolio_weight: 15, experience_weight: 12, tools_weight: 10, bnsp_weight: 10, cert_weight: 8, diploma_weight: 12,
      });
      await load();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;
  if (!shop) return <SafeAreaView style={styles.safe}><Text style={styles.empty}>Daftarkan toko terlebih dulu di Dashboard.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <Text style={styles.headerTitle}>Kelola Toko</Text>
        <Text style={styles.headerSub}>{shop.name}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 60 }}>
        {[["barbers", "Barber", "cut"], ["services", "Layanan", "pricetag"], ["karyawan", "Pelamar", "people"]].map(([k, l, i]) => (
          <Pressable key={k} testID={`tab-${k}`} onPress={() => setTab(k as any)} style={[styles.tab, tab === k && styles.tabActive]}>
            <Ionicons name={i as any} size={14} color={tab === k ? "#FFFFFF" : COLORS.textDim} />
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {tab === "barbers" && (
          <View>
            {shop.barbers.map((br: any) => (
              <View key={br.id} style={styles.item} testID={`brb-${br.id}`}>
                <View style={styles.avatar}><Ionicons name="cut" size={18} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{br.name}</Text>
                  <View style={styles.rowInline}>
                    <View style={styles.pill}><Text style={styles.pillText}>{br.skill_level}</Text></View>
                    <Text style={styles.itemMeta}>{br.specialization}</Text>
                  </View>
                </View>
              </View>
            ))}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tambah Barber</Text>
              <TextInput style={styles.input} value={b.name} onChangeText={(t) => setB({ ...b, name: t })} placeholder="Nama barber" placeholderTextColor={COLORS.textDim} testID="new-barber-name" />
              <TextInput style={styles.input} value={b.specialization} onChangeText={(t) => setB({ ...b, specialization: t })} placeholder="Spesialisasi (mis. Fade & Undercut)" placeholderTextColor={COLORS.textDim} />
              <Pressable style={styles.btn} onPress={addBarber} testID="add-barber"><Text style={styles.btnText}>TAMBAH BARBER</Text></Pressable>
            </View>
          </View>
        )}
        {tab === "services" && (
          <View>
            {shop.services.map((sv: any) => (
              <View key={sv.id} style={styles.item}>
                <View style={styles.avatar}><Ionicons name="pricetag" size={18} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{sv.name}</Text>
                  <Text style={styles.itemMeta}>{sv.duration} menit</Text>
                </View>
                <Text style={styles.itemPrice}>{rupiah(sv.price)}</Text>
              </View>
            ))}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tambah Layanan</Text>
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
                <View style={styles.avatar}><Ionicons name="person" size={18} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{k.name}</Text>
                  <Text style={styles.itemMeta}>Skor: {k.total_score}/120</Text>
                </View>
                <View style={styles.rightCol}>
                  <View style={[styles.pill, k.status === "active" ? { backgroundColor: "#ECFDF5" } : k.status === "rejected" ? { backgroundColor: "#FEF2F2" } : { backgroundColor: "#FFF7ED" }]}>
                    <Text style={[styles.pillText, k.status === "active" ? { color: COLORS.success } : k.status === "rejected" ? { color: COLORS.error } : { color: COLORS.warning }]}>{k.status}</Text>
                  </View>
                  {k.status === "pending" && (
                    <Pressable style={styles.btnSmall} onPress={() => evaluate(k.id)} testID={`eval-${k.id}`}>
                      <Text style={styles.btnSmallText}>EVAL</Text>
                    </Pressable>
                  )}
                </View>
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
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 12 },
  tab: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 12 },
  tabTextActive: { color: "#FFFFFF" },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40, fontFamily: FONT.medium },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  rowInline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.brandDim },
  pillText: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold },
  rightCol: { alignItems: "flex-end", gap: 6 },
  btnSmall: { backgroundColor: COLORS.brand, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnSmallText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 12 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium },
  btn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 13 },
});
