import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, tanggal } from "@/src/lib/api";

const DOC_LABEL: Record<string, string> = {
  ktp: "KTP Pemilik", nib: "NIB (Nomor Induk Berusaha)", npwp: "NPWP", surat_usaha: "Surat Izin Usaha", toko: "Foto Toko",
};
const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  valid: { color: COLORS.success, bg: "#ECFDF5", label: "VALID" },
  invalid: { color: COLORS.error, bg: "#FEF2F2", label: "TIDAK VALID" },
  needs_revision: { color: COLORS.warning, bg: "#FFF7ED", label: "PERLU REVISI" },
  pending: { color: COLORS.info, bg: "#F0F9FF", label: "MENUNGGU DICEK" },
  missing: { color: COLORS.textDim, bg: COLORS.surface2, label: "BELUM UPLOAD" },
};

export default function Verification() {
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selShop, setSelShop] = useState<any>(null);
  const [reviewDoc, setReviewDoc] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("valid");
  const [reviewNote, setReviewNote] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [threads, setThreads] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/pending-shops");
      setShops(r.shops);
      const t = await api.get("/chat/threads");
      setThreads(t.threads);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitReview = async () => {
    if (!selShop || !reviewDoc) return;
    if ((reviewStatus === "invalid" || reviewStatus === "needs_revision") && !reviewNote.trim()) {
      alert("Catatan wajib diisi untuk status Tidak Valid / Perlu Revisi"); return;
    }
    try {
      const r = await api.post(`/admin/shops/${selShop.id}/documents/${reviewDoc}/review`, { status: reviewStatus, note: reviewNote });
      // refresh selShop
      const fresh = await api.get("/admin/pending-shops");
      const updated = fresh.shops.find((s: any) => s.id === selShop.id);
      setSelShop(updated || null);
      setShops(fresh.shops);
      setReviewDoc(null); setReviewNote(""); setReviewStatus("valid");
      if (r.all_valid) alert("✓ Semua dokumen valid — toko OTOMATIS DISETUJUI");
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  // Detail view
  if (selShop) {
    const docs = selShop.docs || {};
    const required = ["ktp", "nib", "npwp", "surat_usaha", "toko"];
    const validCount = required.filter((k) => docs[k]?.status === "valid").length;
    const thread = threads.find((t) => t.shop_id === selShop.id);
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.navyHeader}>
          <Pressable onPress={() => setSelShop(null)} style={styles.hIconBtn}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{selShop.name}</Text>
            <Text style={styles.headerSub}>Review dokumen · Revisi ke-{selShop.revision_count || 0}</Text>
          </View>
          <Pressable style={styles.hIconBtn} onPress={() => router.push(`/chat/${selShop.id}` as any)} testID={`chat-${selShop.id}`}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            {thread?.unread > 0 && <View style={styles.hBadge}><Text style={styles.hBadgeText}>{thread.unread}</Text></View>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressTitle}>Progress Verifikasi</Text>
              <Text style={styles.progressCount}>{validCount}/5 valid</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(validCount / 5) * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>Toko akan otomatis disetujui jika semua 5 dokumen berstatus VALID.</Text>
          </View>

          <Text style={styles.sec}>DOKUMEN LEGAL</Text>
          {required.map((key) => {
            const d = docs[key] || { status: "missing" };
            const meta = STATUS_META[d.status] || STATUS_META.missing;
            return (
              <View key={key} style={styles.docCard} testID={`doc-${key}`}>
                <View style={styles.docHead}>
                  <View style={styles.docIconL}><Ionicons name="document-text" size={20} color={COLORS.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle}>{DOC_LABEL[key]}</Text>
                    {d.reviewed_at && <Text style={styles.docTime}>Dicek: {new Date(d.reviewed_at).toLocaleString("id-ID")}</Text>}
                  </View>
                  <View style={[styles.docBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.docBadgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {d.note && (
                  <View style={styles.noteBox}>
                    <Ionicons name="chatbox-ellipses" size={14} color={COLORS.warning} />
                    <Text style={styles.noteText}>{d.note}</Text>
                  </View>
                )}
                <View style={styles.docActions}>
                  <Pressable style={styles.viewBtn} onPress={() => setPreviewImg(d.url || null)} testID={`view-${key}`}>
                    <Ionicons name="eye" size={14} color={COLORS.brand} />
                    <Text style={styles.viewBtnText}>Lihat</Text>
                  </Pressable>
                  <Pressable style={styles.reviewBtn} onPress={() => { setReviewDoc(key); setReviewStatus(d.status === "valid" ? "valid" : "valid"); setReviewNote(d.note || ""); }} testID={`review-${key}`}>
                    <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                    <Text style={styles.reviewBtnText}>Nilai</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Review Modal */}
        <Modal visible={!!reviewDoc} transparent animationType="slide" onRequestClose={() => setReviewDoc(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modal}>
              <View style={styles.grabber} />
              <Text style={styles.modalTitle}>Nilai: {reviewDoc && DOC_LABEL[reviewDoc]}</Text>
              <Text style={styles.modalSub}>Pilih status dokumen</Text>
              <View style={styles.statusRow}>
                {[
                  { key: "valid", label: "Valid", icon: "checkmark-circle", color: COLORS.success },
                  { key: "needs_revision", label: "Perlu Revisi", icon: "sync-circle", color: COLORS.warning },
                  { key: "invalid", label: "Tidak Valid", icon: "close-circle", color: COLORS.error },
                ].map((s) => (
                  <Pressable key={s.key} onPress={() => setReviewStatus(s.key)} testID={`status-${s.key}`}
                    style={[styles.statusOpt, reviewStatus === s.key && { borderColor: s.color, backgroundColor: s.color + "15" }]}>
                    <Ionicons name={s.icon as any} size={22} color={reviewStatus === s.key ? s.color : COLORS.textDim} />
                    <Text style={[styles.statusOptText, reviewStatus === s.key && { color: s.color, fontFamily: FONT.bold }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.modalLabel}>Catatan {reviewStatus !== "valid" && "(wajib)"}</Text>
              <TextInput style={styles.modalInput} value={reviewNote} onChangeText={setReviewNote} placeholder="Cth: Foto NPWP buram, mohon unggah ulang..." placeholderTextColor={COLORS.textDim} multiline />
              <Pressable style={styles.submitBtn} onPress={submitReview} testID="submit-doc-review">
                <Text style={styles.submitText}>KIRIM PENILAIAN</Text>
              </Pressable>
              <Pressable onPress={() => setReviewDoc(null)} style={{ padding: 12, alignItems: "center" }}>
                <Text style={{ color: COLORS.textDim, fontFamily: FONT.medium }}>Batal</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Preview modal */}
        <Modal visible={!!previewImg} transparent onRequestClose={() => setPreviewImg(null)}>
          <Pressable style={styles.previewBg} onPress={() => setPreviewImg(null)}>
            {previewImg && (previewImg.startsWith("data:") || previewImg.startsWith("http")) ? (
              <Image source={{ uri: previewImg }} style={styles.previewImg} contentFit="contain" />
            ) : (
              <View style={styles.previewMock}>
                <Ionicons name="document-text" size={80} color="#FFFFFF" />
                <Text style={styles.previewMockText}>{previewImg || "Dokumen contoh (seed)"}</Text>
                <Text style={styles.previewHint}>Gambar dari owner asli akan tampil di sini.</Text>
              </View>
            )}
            <Pressable style={styles.previewClose} onPress={() => setPreviewImg(null)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Verifikasi Toko</Text>
          <Text style={styles.headerSub}>{shops.length} toko menunggu review</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}>
        {shops.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle" size={48} color={COLORS.success} />
            <Text style={styles.empty}>Tidak ada toko menunggu verifikasi.</Text>
          </View>
        )}
        {shops.map((s) => {
          const docs = s.docs || {};
          const required = ["ktp", "nib", "npwp", "surat_usaha", "toko"];
          const validCount = required.filter((k) => docs[k]?.status === "valid").length;
          const thread = threads.find((t) => t.shop_id === s.id);
          return (
            <Pressable key={s.id} style={styles.card} testID={`pending-${s.id}`} onPress={() => setSelShop(s)}>
              <View style={styles.rowTop}>
                <View style={styles.shopIcon}><Ionicons name="storefront" size={20} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{s.owner?.name}</Text>
                </View>
                {thread?.unread > 0 && (
                  <View style={styles.chatBadge}>
                    <Ionicons name="chatbubble" size={11} color="#FFFFFF" />
                    <Text style={styles.chatBadgeText}>{thread.unread}</Text>
                  </View>
                )}
              </View>
              <View style={styles.miniBar}>
                <View style={[styles.miniFill, { width: `${(validCount / 5) * 100}%` }]} />
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.progressLabel}>{validCount}/5 dokumen valid</Text>
                <Text style={styles.tapHint}>Ketuk untuk review →</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  hIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hBadge: { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  hBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  emptyBox: { alignItems: "center", padding: 40, gap: 12 },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, textAlign: "center" },
  card: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  shopIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  meta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  chatBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chatBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  miniBar: { height: 6, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 12, overflow: "hidden" },
  miniFill: { height: "100%", backgroundColor: COLORS.success, borderRadius: 999 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressLabel: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.semibold },
  tapHint: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },

  progressCard: { backgroundColor: COLORS.brand, padding: 16, borderRadius: 16, shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },
  progressCount: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 18 },
  progressBar: { height: 8, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 999 },
  progressHint: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 8, fontFamily: FONT.medium },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },

  docCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  docHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  docIconL: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  docTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docTime: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.medium, marginTop: 2 },
  docBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  docBadgeText: { fontSize: 9, fontFamily: FONT.bold, letterSpacing: 0.3 },
  noteBox: { flexDirection: "row", gap: 6, backgroundColor: "#FFF7ED", padding: 10, borderRadius: 8, marginTop: 10 },
  noteText: { color: COLORS.warning, flex: 1, fontFamily: FONT.medium, fontSize: 12 },
  docActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  viewBtn: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 4, backgroundColor: COLORS.brandDim, padding: 10, borderRadius: 10 },
  viewBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  reviewBtn: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 4, backgroundColor: COLORS.brand, padding: 10, borderRadius: 10 },
  reviewBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 12 },

  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabber: { width: 40, height: 4, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 2, marginBottom: 16, fontFamily: FONT.medium, fontSize: 13 },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statusOpt: { flex: 1, alignItems: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface2 },
  statusOptText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 11 },
  modalLabel: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  modalInput: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 12, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  submitBtn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  submitText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8 },

  previewBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  previewImg: { width: "90%", height: "80%" },
  previewMock: { alignItems: "center", padding: 40 },
  previewMockText: { color: "#FFFFFF", fontFamily: FONT.bold, marginTop: 12, fontSize: 14 },
  previewHint: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.medium, fontSize: 12, marginTop: 6, textAlign: "center" },
  previewClose: { position: "absolute", top: 60, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
});
