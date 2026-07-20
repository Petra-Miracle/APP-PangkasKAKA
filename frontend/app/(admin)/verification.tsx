import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, COLORS } from "@/src/lib/api";

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
      <Text style={styles.title}>Verifikasi Toko</Text>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
        {shops.length === 0 && <Text style={styles.empty}>Tidak ada toko menunggu verifikasi.</Text>}
        {shops.map((s) => (
          <View key={s.id} style={styles.card} testID={`pending-${s.id}`}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.meta}>{s.address}</Text>
            <Text style={styles.meta}>Pemilik: {s.owner?.name} ({s.owner?.email})</Text>
            <View style={styles.docsRow}>
              {["doc_ktp", "doc_nib", "doc_npwp", "doc_surat_usaha"].map((d) => (
                <View key={d} style={styles.doc}><Text style={styles.docText}>{d.replace("doc_", "").toUpperCase()}</Text></View>
              ))}
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.btnPri} onPress={() => approve(s.id)} testID={`approve-${s.id}`}><Text style={styles.btnPriText}>SETUJUI</Text></Pressable>
              <Pressable style={styles.btnSec} onPress={() => setRejFor(s)} testID={`reject-${s.id}`}><Text style={styles.btnSecText}>TOLAK</Text></Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={!!rejFor} transparent animationType="slide" onRequestClose={() => setRejFor(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Alasan Penolakan</Text>
            <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Tulis alasan..." placeholderTextColor={COLORS.textDim} multiline />
            <Pressable style={styles.btnPri} onPress={reject} testID="submit-reject"><Text style={styles.btnPriText}>KIRIM</Text></Pressable>
            <Pressable onPress={() => setRejFor(null)} style={{ padding: 12, alignItems: "center" }}><Text style={{ color: COLORS.textDim }}>Batal</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", padding: 16 },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  name: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  meta: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  docsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  doc: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: COLORS.brandDim, borderRadius: 4 },
  docText: { color: COLORS.brandLight, fontSize: 10, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnPri: { flex: 1, backgroundColor: COLORS.brand, padding: 12, borderRadius: 4, alignItems: "center" },
  btnPriText: { color: "#121212", fontWeight: "900", letterSpacing: 1 },
  btnSec: { flex: 1, padding: 12, borderRadius: 4, alignItems: "center", borderWidth: 1, borderColor: COLORS.error },
  btnSecText: { color: COLORS.error, fontWeight: "900" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 4, marginTop: 12, marginBottom: 12, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border },
});
