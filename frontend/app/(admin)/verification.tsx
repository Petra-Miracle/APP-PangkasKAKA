import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";

export default function Verification() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejFor, setRejFor] = useState<any>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/admin/pending-shops"); setShops(r.shops); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = async (id: string) => {
    try { await api.post(`/admin/shops/${id}/verify`, { decision: "approved" }); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const reject = async () => {
    if (!note) return alert("Isi alasan penolakan");
    try { await api.post(`/admin/shops/${rejFor.id}/verify`, { decision: "rejected", note }); setRejFor(null); setNote(""); await load(); }
    catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <Text style={styles.headerTitle}>Verifikasi Toko</Text>
        <Text style={styles.headerSub}>{shops.length} toko menunggu review</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}>
        {shops.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle" size={48} color={COLORS.success} />
            <Text style={styles.empty}>Tidak ada toko menunggu verifikasi.</Text>
          </View>
        )}
        {shops.map((s) => (
          <View key={s.id} style={styles.card} testID={`pending-${s.id}`}>
            <View style={styles.rowTop}>
              <View style={styles.shopIcon}><Ionicons name="storefront" size={20} color={COLORS.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.meta}>{s.address}</Text>
              </View>
              <View style={styles.pendingPill}>
                <Text style={styles.pendingText}>PENDING</Text>
              </View>
            </View>
            <View style={styles.ownerBox}>
              <Ionicons name="person" size={13} color={COLORS.textDim} />
              <Text style={styles.ownerText}>{s.owner?.name} · {s.owner?.email}</Text>
            </View>
            <Text style={styles.docsLabel}>DOKUMEN LEGAL</Text>
            <View style={styles.docsRow}>
              {["KTP", "NIB", "NPWP", "Surat Usaha"].map((d) => (
                <View key={d} style={styles.doc}>
                  <Ionicons name="document" size={12} color={COLORS.brand} />
                  <Text style={styles.docText}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.btnPri} onPress={() => approve(s.id)} testID={`approve-${s.id}`}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.btnPriText}>SETUJUI</Text>
              </Pressable>
              <Pressable style={styles.btnSec} onPress={() => setRejFor(s)} testID={`reject-${s.id}`}>
                <Ionicons name="close-circle" size={16} color={COLORS.error} />
                <Text style={styles.btnSecText}>TOLAK</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={!!rejFor} transparent animationType="slide" onRequestClose={() => setRejFor(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Alasan Penolakan</Text>
            <Text style={styles.modalSub}>Pemilik toko akan menerima notifikasi</Text>
            <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Tulis alasan penolakan..." placeholderTextColor={COLORS.textDim} multiline />
            <Pressable style={styles.btnPri} onPress={reject} testID="submit-reject">
              <Text style={styles.btnPriText}>KIRIM KEPUTUSAN</Text>
            </Pressable>
            <Pressable onPress={() => setRejFor(null)} style={{ padding: 12, alignItems: "center", marginTop: 4 }}>
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
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  emptyBox: { alignItems: "center", padding: 40, gap: 12 },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, textAlign: "center" },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#0A2540", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  shopIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  meta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  pendingPill: { backgroundColor: "#FFF7ED", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pendingText: { color: COLORS.warning, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  ownerBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, backgroundColor: COLORS.surface2, borderRadius: 10 },
  ownerText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.medium, flex: 1 },
  docsLabel: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.bold, marginTop: 14, marginBottom: 8, letterSpacing: 0.5 },
  docsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  doc: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.brandDim, borderRadius: 8 },
  docText: { color: COLORS.brand, fontSize: 11, fontFamily: FONT.bold },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  btnPri: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: COLORS.brand, padding: 12, borderRadius: 12, alignItems: "center" },
  btnPriText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  btnSec: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: COLORS.error, backgroundColor: "#FEF2F2" },
  btnSecText: { color: COLORS.error, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 4, fontFamily: FONT.medium, fontSize: 13 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 14, borderRadius: 12, marginTop: 16, marginBottom: 16, minHeight: 90, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
});
