import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { api, COLORS } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

export default function KaryawanStatus() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [selShop, setSelShop] = useState<any>(null);
  const [form, setForm] = useState({ portfolio_url: "", work_experience: "", certificates: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const my = await api.get("/karyawan/my");
      const sh = await api.get("/shops?sort=rating");
      setApps(my.applications); setShops(sh.shops);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const apply = async () => {
    if (!selShop) return;
    try { await api.post("/karyawan/apply", { shop_id: selShop.id, ...form }); setShowApply(false); setForm({ portfolio_url: "", work_experience: "", certificates: "" }); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const doLogout = async () => { await logout(); router.replace("/(auth)/login"); };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hi}>Barber Portal</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <Pressable onPress={doLogout} testID="k-logout"><Text style={{ color: COLORS.error, fontWeight: "700" }}>Keluar</Text></Pressable>
        </View>
        <Text style={styles.sec}>LAMARAN SAYA</Text>
        {apps.length === 0 && <Text style={styles.empty}>Belum ada lamaran.</Text>}
        {apps.map((a: any) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.cName}>{a.shop?.name}</Text>
            <View style={[styles.badge, { backgroundColor: a.status === "active" ? COLORS.success : a.status === "rejected" ? COLORS.error : COLORS.warning }]}>
              <Text style={styles.badgeText}>{a.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.cMeta}>Skor: {a.total_score}/120</Text>
          </View>
        ))}
        <Text style={styles.sec}>LAMAR KE TOKO</Text>
        {shops.map((s: any) => (
          <Pressable key={s.id} style={styles.shopRow} testID={`apply-shop-${s.id}`} onPress={() => { setSelShop(s); setShowApply(true); }}>
            <Image source={{ uri: s.image }} style={styles.shopImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{s.name}</Text>
              <Text style={styles.cMeta}>{s.address}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={showApply} transparent animationType="slide" onRequestClose={() => setShowApply(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Lamar ke {selShop?.name}</Text>
            <TextInput style={styles.input} placeholder="URL portofolio" placeholderTextColor={COLORS.textDim} value={form.portfolio_url} onChangeText={(t) => setForm({ ...form, portfolio_url: t })} />
            <TextInput style={styles.input} placeholder="Pengalaman kerja (singkat)" placeholderTextColor={COLORS.textDim} value={form.work_experience} onChangeText={(t) => setForm({ ...form, work_experience: t })} />
            <TextInput style={styles.input} placeholder="Sertifikat" placeholderTextColor={COLORS.textDim} value={form.certificates} onChangeText={(t) => setForm({ ...form, certificates: t })} />
            <Pressable style={styles.btn} onPress={apply} testID="submit-apply"><Text style={styles.btnText}>KIRIM LAMARAN</Text></Pressable>
            <Pressable onPress={() => setShowApply(false)} style={{ padding: 12, alignItems: "center" }}><Text style={{ color: COLORS.textDim }}>Batal</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  hi: { color: COLORS.textDim, fontSize: 12 },
  name: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sec: { color: COLORS.textDim, letterSpacing: 1, fontSize: 12, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  cName: { color: COLORS.text, fontWeight: "900" },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 6 },
  badgeText: { color: "#121212", fontSize: 10, fontWeight: "900" },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 20 },
  shopRow: { flexDirection: "row", gap: 12, padding: 10, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, alignItems: "center" },
  shopImg: { width: 60, height: 60, borderRadius: 4 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginBottom: 12 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 4, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  btn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 4, alignItems: "center", marginTop: 8 },
  btnText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
});
