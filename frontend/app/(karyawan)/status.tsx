import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: COLORS.success, bg: "#ECFDF5", label: "DITERIMA" },
  rejected: { color: COLORS.error, bg: "#FEF2F2", label: "DITOLAK" },
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "MENUNGGU" },
};

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

  const appliedShopIds = new Set(apps.map((a) => a.shop_id));
  const availableShops = shops.filter((s) => !appliedShopIds.has(s.id));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.brandBadge}>
            <Ionicons name="cut" size={12} color={COLORS.brand} />
            <Text style={styles.brandBadgeText}>BARBER PORTAL</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name}</Text>
          <Text style={styles.headerSub}>{user?.email}</Text>
        </View>
        <Pressable onPress={doLogout} testID="k-logout" style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.sec}>LAMARAN SAYA</Text>
        {apps.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={32} color={COLORS.textDim} />
            <Text style={styles.empty}>Belum ada lamaran. Pilih toko di bawah untuk mulai.</Text>
          </View>
        )}
        {apps.map((a: any) => {
          const meta = STATUS_META[a.status] || STATUS_META.pending;
          return (
            <View key={a.id} style={styles.appCard}>
              <View style={styles.rowTop}>
                <Image source={{ uri: a.shop?.image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cName}>{a.shop?.name}</Text>
                  <Text style={styles.cMeta}>Skor: {a.total_score}/120</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              {a.status === "active" && (
                <View style={styles.congrats}>
                  <Ionicons name="trophy" size={16} color={COLORS.success} />
                  <Text style={styles.congratsText}>Anda diterima sebagai barber di toko ini!</Text>
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.sec}>LAMAR KE TOKO</Text>
        {availableShops.length === 0 && <Text style={styles.empty}>Anda sudah melamar ke semua toko.</Text>}
        {availableShops.map((s: any) => (
          <Pressable key={s.id} style={styles.shopRow} testID={`apply-shop-${s.id}`} onPress={() => { setSelShop(s); setShowApply(true); }}>
            <Image source={{ uri: s.image }} style={styles.shopImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{s.name}</Text>
              <Text style={styles.cMeta} numberOfLines={1}>{s.address}</Text>
              <View style={styles.starRow}>
                <Ionicons name="star" size={11} color={COLORS.warning} />
                <Text style={styles.starText}>{s.rating?.toFixed(1)} · {s.reviews_count} ulasan</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={showApply} transparent animationType="slide" onRequestClose={() => setShowApply(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Lamar Kerja</Text>
            <Text style={styles.modalSub}>{selShop?.name}</Text>
            <Text style={styles.label}>URL Portofolio</Text>
            <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={COLORS.textDim} value={form.portfolio_url} onChangeText={(t) => setForm({ ...form, portfolio_url: t })} />
            <Text style={styles.label}>Pengalaman Kerja</Text>
            <TextInput style={styles.input} placeholder="2 tahun di Barber X" placeholderTextColor={COLORS.textDim} value={form.work_experience} onChangeText={(t) => setForm({ ...form, work_experience: t })} />
            <Text style={styles.label}>Sertifikat</Text>
            <TextInput style={styles.input} placeholder="BNSP, kursus, dll" placeholderTextColor={COLORS.textDim} value={form.certificates} onChangeText={(t) => setForm({ ...form, certificates: t })} />
            <Pressable style={styles.btn} onPress={apply} testID="submit-apply">
              <Text style={styles.btnText}>KIRIM LAMARAN</Text>
            </Pressable>
            <Pressable onPress={() => setShowApply(false)} style={{ padding: 12, alignItems: "center" }}>
              <Text style={{ color: COLORS.textDim, fontFamily: FONT.medium }}>Batal</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  brandBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold, marginTop: 8 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  logoutBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },
  emptyCard: { alignItems: "center", padding: 24, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  empty: { color: COLORS.textDim, textAlign: "center", fontFamily: FONT.medium, fontSize: 13 },
  appCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.5 },
  congrats: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, backgroundColor: "#ECFDF5", borderRadius: 10 },
  congratsText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },
  shopRow: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, alignItems: "center" },
  shopImg: { width: 60, height: 60, borderRadius: 10 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  starText: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 2, marginBottom: 4, fontFamily: FONT.medium },
  label: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium },
  btn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 20 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
});
