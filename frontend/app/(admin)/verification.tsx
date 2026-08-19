import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

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

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 22, width: 180, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 12, width: 130, marginTop: 8, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 96 }} />
        <Skeleton style={{ height: 96 }} />
        <Skeleton style={{ height: 96 }} />
      </View>
    </SafeAreaView>
  );

  // Detail view
  if (selShop) {
    const docs = selShop.docs || {};
    const required = ["ktp", "nib", "npwp", "surat_usaha", "toko"];
    const validCount = required.filter((k) => docs[k]?.status === "valid").length;
    const thread = threads.find((t) => t.shop_id === selShop.id);
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <LinearGradient
          colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.navyHeader}
        >
          <View pointerEvents="none" style={styles.headerDeco} />
          <PressableScale onPress={() => setSelShop(null)} style={styles.hIconBtn} scaleTo={0.88}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{selShop.name}</Text>
            <Text style={styles.headerSub}>Review dokumen · Revisi ke-{selShop.revision_count || 0}</Text>
          </View>
          <PressableScale style={styles.hIconBtn} onPress={() => router.push(`/chat/${selShop.id}` as any)} testID={`chat-${selShop.id}`} scaleTo={0.88} haptic>
            <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            {thread?.unread > 0 && <View style={styles.hBadge}><Text style={styles.hBadgeText}>{thread.unread}</Text></View>}
          </PressableScale>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressCard}
          >
            <View pointerEvents="none" style={styles.progressDeco} />
            <View style={styles.progressHead}>
              <Text style={styles.progressTitle}>Progress Verifikasi</Text>
              <View style={styles.progressCountPill}><Text style={styles.progressCount}>{validCount}/5 valid</Text></View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(validCount / 5) * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>Toko akan otomatis disetujui jika semua 5 dokumen berstatus VALID.</Text>
          </LinearGradient>

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
                  <PressableScale style={styles.viewBtn} onPress={() => setPreviewImg(d.url || null)} testID={`view-${key}`} scaleTo={0.96}>
                    <Ionicons name="eye" size={14} color={COLORS.brand} />
                    <Text style={styles.viewBtnText}>Lihat</Text>
                  </PressableScale>
                  <PressableScale style={styles.reviewBtn} onPress={() => { setReviewDoc(key); setReviewStatus(d.status === "valid" ? "valid" : "valid"); setReviewNote(d.note || ""); }} testID={`review-${key}`} scaleTo={0.96} haptic>
                    <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                    <Text style={styles.reviewBtnText}>Nilai</Text>
                  </PressableScale>
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
              <View style={styles.modalHeadIcon}>
                <Ionicons name="clipboard" size={22} color={COLORS.brand} />
              </View>
              <Text style={styles.modalTitle}>Nilai: {reviewDoc && DOC_LABEL[reviewDoc]}</Text>
              <Text style={styles.modalSub}>Pilih status dokumen</Text>
              <View style={styles.statusRow}>
                {[
                  { key: "valid", label: "Valid", icon: "checkmark-circle", color: COLORS.success },
                  { key: "needs_revision", label: "Perlu Revisi", icon: "sync-circle", color: COLORS.warning },
                  { key: "invalid", label: "Tidak Valid", icon: "close-circle", color: COLORS.error },
                ].map((s) => (
                  <PressableScale key={s.key} onPress={() => setReviewStatus(s.key)} testID={`status-${s.key}`} scaleTo={0.94}
                    style={[styles.statusOpt, reviewStatus === s.key && { borderColor: s.color, backgroundColor: s.color + "15" }]}>
                    <Ionicons name={s.icon as any} size={22} color={reviewStatus === s.key ? s.color : COLORS.textDim} />
                    <Text style={[styles.statusOptText, reviewStatus === s.key && { color: s.color, fontFamily: FONT.bold }]}>{s.label}</Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={styles.modalLabel}>Catatan {reviewStatus !== "valid" && "(wajib)"}</Text>
              <TextInput style={styles.modalInput} value={reviewNote} onChangeText={setReviewNote} placeholder="Cth: Foto NPWP buram, mohon unggah ulang..." placeholderTextColor={COLORS.textDim} multiline />
              <PressableScale style={styles.submitBtnWrap} onPress={submitReview} testID="submit-doc-review" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitText}>KIRIM PENILAIAN</Text>
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={() => setReviewDoc(null)} style={styles.cancelBtn} scaleTo={0.97}>
                <Text style={styles.cancelText}>Batal</Text>
              </PressableScale>
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
                <View style={styles.previewMockIcon}><Ionicons name="document-text" size={80} color="#FFFFFF" /></View>
                <Text style={styles.previewMockText}>{previewImg || "Dokumen contoh (seed)"}</Text>
                <Text style={styles.previewHint}>Gambar dari owner asli akan tampil di sini.</Text>
              </View>
            )}
            <PressableScale style={styles.previewClose} onPress={() => setPreviewImg(null)} scaleTo={0.88}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </PressableScale>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Verifikasi Toko</Text>
          <Text style={styles.headerSub}>{shops.length} toko menunggu review</Text>
        </View>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}>
        {shops.length === 0 && (
          <EmptyState
            icon="checkmark-done-circle"
            title="Tidak ada toko menunggu verifikasi"
            description="Semua pengajuan sudah diproses."
          />
        )}
        {shops.map((s) => {
          const docs = s.docs || {};
          const required = ["ktp", "nib", "npwp", "surat_usaha", "toko"];
          const validCount = required.filter((k) => docs[k]?.status === "valid").length;
          const thread = threads.find((t) => t.shop_id === s.id);
          return (
            <PressableScale key={s.id} style={styles.card} testID={`pending-${s.id}`} onPress={() => setSelShop(s)} scaleTo={0.98}>
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
                <View style={styles.tapHint}><Text style={styles.tapHintText}>Ketuk untuk review</Text><Ionicons name="arrow-forward" size={11} color={COLORS.brand} /></View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -70, right: -40 },
  hIconBtn: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  hBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.sidebar },
  hBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  shopIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  meta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  chatBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chatBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  miniBar: { height: 6, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 12, overflow: "hidden" },
  miniFill: { height: "100%", backgroundColor: COLORS.success, borderRadius: 999 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  progressLabel: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.semibold },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tapHintText: { color: COLORS.brand, fontSize: 11, fontFamily: FONT.bold },

  progressCard: { padding: 16, borderRadius: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  progressDeco: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)", top: -55, right: -30 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },
  progressCountPill: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  progressCount: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },
  progressBar: { height: 8, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 999 },
  progressHint: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 8, fontFamily: FONT.medium },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },

  docCard: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  docHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  docIconL: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  docTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  docTime: { color: COLORS.textDim, fontSize: 10, fontFamily: FONT.medium, marginTop: 2 },
  docBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  docBadgeText: { fontSize: 9, fontFamily: FONT.bold, letterSpacing: 0.3 },
  noteBox: { flexDirection: "row", gap: 6, backgroundColor: "#FFF7ED", padding: 10, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: "#FDE4C4" },
  noteText: { color: COLORS.warning, flex: 1, fontFamily: FONT.medium, fontSize: 12 },
  docActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  viewBtn: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 4, backgroundColor: COLORS.brandDim, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: COLORS.brand },
  viewBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  reviewBtn: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 4, backgroundColor: COLORS.brand, padding: 10, borderRadius: 11, shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 },
  reviewBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 12 },

  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  modalHeadIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 10 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontFamily: FONT.extrabold, textAlign: "center" },
  modalSub: { color: COLORS.textDim, textAlign: "center", marginTop: 2, marginBottom: 16, fontFamily: FONT.medium, fontSize: 13 },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statusOpt: {
    flex: 1, alignItems: "center", gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface2,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  statusOptText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 11 },
  modalLabel: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  modalInput: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 12, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  submitBtnWrap: { borderRadius: 14, marginTop: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  submitBtn: { padding: 14, alignItems: "center" },
  submitText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8 },
  cancelBtn: { padding: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.textDim, fontFamily: FONT.medium },

  previewBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  previewImg: { width: "90%", height: "80%" },
  previewMock: { alignItems: "center", padding: 40 },
  previewMockIcon: { width: 120, height: 120, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  previewMockText: { color: "#FFFFFF", fontFamily: FONT.bold, marginTop: 12, fontSize: 14 },
  previewHint: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.medium, fontSize: 12, marginTop: 6, textAlign: "center" },
  previewClose: { position: "absolute", top: 60, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
});