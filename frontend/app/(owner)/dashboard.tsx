import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

const DOC_LABEL: Record<string, string> = { ktp: "KTP", nib: "NIB", npwp: "NPWP", surat_usaha: "Surat Usaha", toko: "Foto Toko" };
const STATUS_META: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  valid: { color: COLORS.success, bg: "#ECFDF5", label: "Valid", icon: "checkmark-circle" },
  invalid: { color: COLORS.error, bg: "#FEF2F2", label: "Tidak Valid", icon: "close-circle" },
  needs_revision: { color: COLORS.warning, bg: "#FFF7ED", label: "Perlu Revisi", icon: "sync-circle" },
  pending: { color: COLORS.info, bg: "#F0F9FF", label: "Menunggu", icon: "time" },
  missing: { color: COLORS.textDim, bg: COLORS.surface2, label: "Kosong", icon: "help-circle" },
};

export default function OwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReg, setShowReg] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", price_range: "Rp 25.000 - Rp 75.000" });
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/owner/dashboard");
      setData(r);
      const t = await api.get("/chat/threads").catch(() => ({ threads: [] }));
      const tot = (t.threads || []).reduce((a: number, x: any) => a + (x.unread || 0), 0);
      setUnread(tot);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const register = async () => {
    try {
      await api.post("/owner/shop", {
        name: form.name, address: form.address, price_range: form.price_range,
        latitude: -10.1789 + Math.random() * 0.05, longitude: 123.607 + Math.random() * 0.05,
        image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
      });
      setShowReg(false); await load();
    } catch (e: any) { alert(e.message); }
  };

  const reuploadDoc = async (docKey: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    try {
      await api.put("/owner/shop/documents", { doc_key: docKey, file_base64: `data:image/jpeg;base64,${res.assets[0].base64}` });
      await load();
      alert("Dokumen berhasil di-upload ulang. Menunggu review admin.");
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  if (!data?.shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.navyHeader}>
          <Text style={styles.headerTitle}>Owner Panel</Text>
          <Text style={styles.headerSub}>PangkasKAKA · Dashboard Toko</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="storefront-outline" size={48} color={COLORS.brand} /></View>
            <Text style={styles.emptyTitle}>Belum ada toko</Text>
            <Text style={styles.emptyText}>Daftarkan toko Anda untuk mulai menerima pesanan.</Text>
            {!showReg && <Pressable style={styles.btn} onPress={() => setShowReg(true)} testID="btn-register-shop"><Text style={styles.btnText}>DAFTARKAN TOKO</Text></Pressable>}
          </View>
          {showReg && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Data Toko</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Nama toko" placeholderTextColor={COLORS.textDim} testID="shop-name" />
              <TextInput style={styles.input} value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="Alamat" placeholderTextColor={COLORS.textDim} testID="shop-address" />
              <TextInput style={styles.input} value={form.price_range} onChangeText={(t) => setForm({ ...form, price_range: t })} placeholder="Range harga" placeholderTextColor={COLORS.textDim} />
              <Pressable style={styles.btn} onPress={register} testID="submit-shop-registration"><Text style={styles.btnText}>KIRIM PENGAJUAN</Text></Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const s = data.stats;
  const shop = data.shop;
  const docs = shop.docs || {};
  const required = ["ktp", "nib", "npwp", "surat_usaha", "toko"];
  const validCount = required.filter((k) => docs[k]?.status === "valid").length;
  const needsAttention = required.filter((k) => ["needs_revision", "invalid"].includes(docs[k]?.status || ""));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerHi}>Halo, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
        </View>
        <Pressable style={styles.hIconBtn} onPress={() => router.push(`/chat/${shop.id}` as any)} testID="owner-chat">
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          {unread > 0 && <View style={styles.hBadge}><Text style={styles.hBadgeText}>{unread}</Text></View>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.brand} />}>
        {/* Verification progress */}
        {shop.verification_status !== "approved" && (
          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressTitle}>Verifikasi Dokumen</Text>
              <Text style={styles.progressCount}>{validCount}/5</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(validCount / 5) * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              {validCount === 5 ? "Semua dokumen valid ✓" :
                needsAttention.length > 0 ? `${needsAttention.length} dokumen perlu perhatian Anda` : "Menunggu review admin"}
            </Text>
          </View>
        )}

        <Text style={styles.sec}>STATUS DOKUMEN</Text>
        {required.map((key) => {
          const d = docs[key] || { status: "missing" };
          const meta = STATUS_META[d.status] || STATUS_META.missing;
          const canReupload = ["needs_revision", "invalid", "missing"].includes(d.status);
          return (
            <View key={key} style={styles.docCard} testID={`owner-doc-${key}`}>
              <View style={styles.docHead}>
                <View style={[styles.docBadge, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon as any} size={14} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>{DOC_LABEL[key]}</Text>
                  <Text style={[styles.docStatus, { color: meta.color }]}>{meta.label}</Text>
                </View>
                {canReupload && (
                  <Pressable style={styles.reuploadBtn} onPress={() => reuploadDoc(key)} testID={`reupload-${key}`}>
                    <Ionicons name="cloud-upload" size={14} color="#FFFFFF" />
                    <Text style={styles.reuploadText}>Upload</Text>
                  </Pressable>
                )}
              </View>
              {d.note && (
                <View style={styles.noteBox}>
                  <Ionicons name="chatbox-ellipses" size={12} color={COLORS.warning} />
                  <Text style={styles.noteText}>{d.note}</Text>
                </View>
              )}
            </View>
          );
        })}
        {shop.revision_count > 0 && (
          <Text style={styles.revLabel}>Sudah revisi {shop.revision_count}× · Terakhir dicek: {shop.last_reviewed_at ? new Date(shop.last_reviewed_at).toLocaleString("id-ID") : "-"}</Text>
        )}

        {shop.verification_status === "approved" && (
          <View style={styles.statsGrid}>
            <StatBox icon="calendar" label="Pesanan Hari Ini" value={s.today_orders} />
            <StatBox icon="people" label="Barber Aktif" value={s.active_barbers} />
            <StatBox icon="star" label="Rating" value={s.rating?.toFixed(1) || "0.0"} />
            <View style={styles.bigStat}>
              <View style={styles.bigStatIcon}><Ionicons name="cash" size={20} color="#FFFFFF" /></View>
              <View>
                <Text style={styles.bigStatLabel}>Revenue Bulan Ini</Text>
                <Text style={styles.bigStatValue}>{rupiah(s.monthly_revenue)}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value }: any) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={COLORS.brand} /></View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  hIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hBadge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.sidebar },
  hBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  headerHi: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },

  emptyState: { alignItems: "center", padding: 24, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontFamily: FONT.extrabold },
  emptyText: { color: COLORS.textDim, marginTop: 6, marginBottom: 16, textAlign: "center", fontFamily: FONT.medium },
  card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginTop: 16 },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, marginBottom: 12 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14, marginBottom: 10 },
  btn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },

  progressCard: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 16, shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },
  progressCount: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 20 },
  progressBar: { height: 8, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 999 },
  progressHint: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 8, fontFamily: FONT.medium },

  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 24, marginBottom: 12 },
  docCard: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  docHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  docBadge: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docStatus: { fontSize: 11, fontFamily: FONT.semibold, marginTop: 2 },
  reuploadBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brand, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  reuploadText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 11 },
  noteBox: { flexDirection: "row", gap: 6, backgroundColor: "#FFF7ED", padding: 8, borderRadius: 8, marginTop: 8 },
  noteText: { color: COLORS.warning, flex: 1, fontFamily: FONT.medium, fontSize: 11 },
  revLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 8, textAlign: "center" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  statBox: { width: "31%", backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  statIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.semibold, letterSpacing: 0.3 },
  statValue: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, marginTop: 2 },
  bigStat: { width: "100%", backgroundColor: COLORS.brand, padding: 18, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  bigStatIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  bigStatLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 12 },
  bigStatValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 22, marginTop: 2 },
});
