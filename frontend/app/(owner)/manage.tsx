import { useCallback, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import Slider from "@react-native-community/slider";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";

// 6 komponen evaluasi rekrutmen (masing-masing 0-20)
const CRITERIA: { key: string; label: string; desc: string; icon: string; docKey: string; docLabel: string }[] = [
  { key: "portfolio_weight",  label: "Portofolio",         desc: "Foto/link hasil cukur yang pernah dikerjakan", icon: "images",         docKey: "portfolio_url",   docLabel: "Portofolio" },
  { key: "experience_weight", label: "Pengalaman Kerja",   desc: "Lama & riwayat pengalaman sebagai barber",     icon: "briefcase",      docKey: "work_experience", docLabel: "Pengalaman" },
  { key: "tools_weight",      label: "Alat Kerja",         desc: "Kelengkapan alat cukur pribadi",               icon: "cut",            docKey: "tools_photo",     docLabel: "Foto Alat" },
  { key: "bnsp_weight",       label: "Sertifikat BNSP",    desc: "Sertifikasi kompetensi resmi (nilai plus)",    icon: "ribbon",         docKey: "bnsp_cert",       docLabel: "BNSP" },
  { key: "cert_weight",       label: "Sertifikat Lainnya", desc: "Pelatihan/kursus barber lain",                 icon: "document-text",  docKey: "certificates",    docLabel: "Sertifikat" },
  { key: "diploma_weight",    label: "Ijazah",             desc: "Pendidikan formal",                            icon: "school",         docKey: "diploma_photo",   docLabel: "Ijazah" },
];

const initWeights = () => ({ portfolio_weight: 0, experience_weight: 0, tools_weight: 0, bnsp_weight: 0, cert_weight: 0, diploma_weight: 0 });

export default function Manage() {
  const [tab, setTab] = useState<"barbers" | "services" | "karyawan">("barbers");
  const [shop, setShop] = useState<any>(null);
  const [karyawan, setKaryawan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [b, setB] = useState({ name: "", specialization: "" });
  const [s, setS] = useState({ name: "", duration: "30", price: "35000" });
  const [evalTarget, setEvalTarget] = useState<any>(null);
  const [weights, setWeights] = useState(initWeights());
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; uri: string } | null>(null);

  const total = useMemo(() => Object.values(weights).reduce((a, b) => a + Number(b || 0), 0), [weights]);
  const predictedStatus = total >= 60 ? "active" : "rejected";
  const predictedSkill = total >= 85 ? "Senior" : total >= 70 ? "Standar" : "Junior";

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

  const openEvaluate = (k: any) => {
    setWeights(initWeights());
    setEvalTarget(k);
  };

  const submitEvaluation = async () => {
    if (!evalTarget) return;
    setSaving(true);
    try {
      const r = await api.post(`/owner/karyawan/${evalTarget.id}/evaluate`, weights);
      Alert.alert(
        r.status === "active" ? "Pelamar Diterima" : "Pelamar Ditolak",
        `Skor total: ${r.total_score}/120\nStatus: ${r.status === "active" ? "AKTIF (dibuat sebagai barber)" : "DITOLAK"}`
      );
      setEvalTarget(null);
      await load();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const isImageDoc = (val?: string) => !!val && (val.startsWith("data:image") || /\.(png|jpe?g|webp|gif|heic)$/i.test(val));

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
                    <Text style={styles.itemMeta}>{br.specialization || "-"}</Text>
                  </View>
                </View>
              </View>
            ))}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tambah Barber Manual</Text>
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
            {karyawan.length === 0 && (
              <View style={styles.emptyBox}>
                <Ionicons name="people-outline" size={48} color={COLORS.textDim} />
                <Text style={styles.empty}>Belum ada pelamar.</Text>
              </View>
            )}
            {karyawan.map((k: any) => (
              <View key={k.id} style={styles.applicantCard}>
                <View style={styles.rowTop}>
                  <View style={styles.avatar}><Ionicons name="person" size={18} color={COLORS.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{k.name}</Text>
                    <Text style={styles.itemMeta}>{k.email}</Text>
                  </View>
                  <View style={[styles.statusBadge,
                    k.status === "active" ? { backgroundColor: "#ECFDF5" } :
                    k.status === "rejected" ? { backgroundColor: "#FEF2F2" } : { backgroundColor: "#FFF7ED" }]}>
                    <Text style={[styles.statusBadgeText,
                      k.status === "active" ? { color: COLORS.success } :
                      k.status === "rejected" ? { color: COLORS.error } : { color: COLORS.warning }]}>
                      {k.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {k.status !== "pending" && (
                  <View style={styles.scoreBar}>
                    <Text style={styles.scoreText}>Skor: <Text style={{ color: COLORS.text, fontFamily: FONT.extrabold }}>{k.total_score}/120</Text></Text>
                  </View>
                )}
                {k.status === "pending" ? (
                  <Pressable style={styles.evalBtn} onPress={() => openEvaluate(k)} testID={`eval-${k.id}`}>
                    <Ionicons name="clipboard" size={16} color="#FFFFFF" />
                    <Text style={styles.evalBtnText}>EVALUASI PELAMAR</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.evalBtnGhost} onPress={() => openEvaluate(k)}>
                    <Ionicons name="eye-outline" size={16} color={COLORS.brand} />
                    <Text style={styles.evalBtnGhostText}>LIHAT DETAIL</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ---------- Modal Evaluasi ---------- */}
      <Modal visible={!!evalTarget} animationType="slide" transparent onRequestClose={() => setEvalTarget(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.mHeader}>
                <View style={styles.mAvatar}><Text style={styles.mInitial}>{evalTarget?.name?.[0] || "?"}</Text></View>
                <Text style={styles.mName}>{evalTarget?.name}</Text>
                <Text style={styles.mEmail}>{evalTarget?.email} · {evalTarget?.phone}</Text>
              </View>

              {/* Berkas Pelamar */}
              <Text style={styles.sec}>BERKAS PELAMAR</Text>
              <View style={styles.docsGrid}>
                {CRITERIA.map((c) => {
                  const val = evalTarget?.[c.docKey];
                  return (
                    <Pressable key={c.docKey} style={styles.docChip}
                      onPress={() => val && setPreviewDoc({ title: c.docLabel, uri: val })}
                      disabled={!val}>
                      <Ionicons name={c.icon as any} size={16} color={val ? COLORS.brand : COLORS.textDim} />
                      <Text style={[styles.docChipText, !val && { color: COLORS.textDim }]} numberOfLines={1}>
                        {c.docLabel}
                      </Text>
                      <Ionicons name={val ? "checkmark-circle" : "close-circle"} size={14} color={val ? COLORS.success : COLORS.textDim} />
                    </Pressable>
                  );
                })}
              </View>

              {/* Penilaian */}
              {evalTarget?.status === "pending" ? (
                <>
                  <Text style={styles.sec}>PENILAIAN (0–20 per komponen)</Text>
                  {CRITERIA.map((c) => (
                    <View key={c.key} style={styles.critCard}>
                      <View style={styles.critHead}>
                        <View style={styles.critIco}><Ionicons name={c.icon as any} size={16} color={COLORS.brand} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.critLabel}>{c.label}</Text>
                          <Text style={styles.critDesc}>{c.desc}</Text>
                        </View>
                        <View style={styles.critScorePill}>
                          <Text style={styles.critScoreText}>{(weights as any)[c.key]}</Text>
                        </View>
                      </View>
                      <Slider
                        style={{ height: 36, marginTop: 4 }}
                        minimumValue={0} maximumValue={20} step={1}
                        value={(weights as any)[c.key]}
                        onValueChange={(v) => setWeights({ ...weights, [c.key]: Math.round(v) } as any)}
                        minimumTrackTintColor={COLORS.brand}
                        maximumTrackTintColor={COLORS.border}
                        thumbTintColor={COLORS.brand}
                      />
                    </View>
                  ))}

                  {/* Live Total */}
                  <View style={styles.totalCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.totalLabel}>Skor Total</Text>
                      <Text style={styles.totalValue}>{total} <Text style={styles.totalMax}>/ 120</Text></Text>
                      <View style={styles.totalBar}>
                        <View style={[styles.totalFill, { width: `${Math.min(100, (total / 120) * 100)}%`, backgroundColor: predictedStatus === "active" ? COLORS.success : COLORS.warning }]} />
                      </View>
                    </View>
                    <View style={styles.predictBox}>
                      <Text style={styles.predictLabel}>Prediksi</Text>
                      <Text style={[styles.predictStatus, { color: predictedStatus === "active" ? COLORS.success : COLORS.error }]}>
                        {predictedStatus === "active" ? "AKTIF" : "DITOLAK"}
                      </Text>
                      {predictedStatus === "active" && (
                        <Text style={styles.predictSkill}>{predictedSkill}</Text>
                      )}
                    </View>
                  </View>

                  <Text style={styles.hint}>
                    Skor ≥ 60 → Aktif (dibuat sebagai barber otomatis).{"\n"}
                    Skor ≥ 85 = Senior · ≥ 70 = Standar · Lainnya = Junior.
                  </Text>

                  <Pressable style={[styles.saveBtn, total === 0 && { opacity: 0.5 }]} onPress={submitEvaluation} disabled={saving || total === 0} testID="save-evaluation">
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>{saving ? "MENYIMPAN..." : "SIMPAN EVALUASI"}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.sec}>HASIL EVALUASI</Text>
                  <View style={styles.critList}>
                    {CRITERIA.map((c) => (
                      <View key={c.key} style={styles.resultRow}>
                        <Ionicons name={c.icon as any} size={14} color={COLORS.brand} />
                        <Text style={styles.resultLabel}>{c.label}</Text>
                        <Text style={styles.resultVal}>{evalTarget?.[c.key] ?? 0}/20</Text>
                      </View>
                    ))}
                    <View style={styles.resultTotalRow}>
                      <Text style={styles.resultTotalLabel}>Skor Total</Text>
                      <Text style={[styles.resultTotalVal, { color: evalTarget?.status === "active" ? COLORS.success : COLORS.error }]}>
                        {evalTarget?.total_score}/120
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setEvalTarget(null)}>
              <Text style={styles.closeText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---------- Preview Berkas ---------- */}
      <Modal visible={!!previewDoc} animationType="fade" transparent onRequestClose={() => setPreviewDoc(null)}>
        <View style={styles.previewBg}>
          <View style={styles.previewCard}>
            <View style={styles.previewHead}>
              <Text style={styles.previewTitle}>{previewDoc?.title}</Text>
              <Pressable onPress={() => setPreviewDoc(null)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {previewDoc && isImageDoc(previewDoc.uri) ? (
                <Image source={{ uri: previewDoc.uri }} style={styles.previewImg} contentFit="contain" />
              ) : (
                <View style={styles.previewText}>
                  <Text style={styles.previewTextContent} selectable>{previewDoc?.uri || "-"}</Text>
                </View>
              )}
            </ScrollView>
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
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 12 },
  tab: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 12 },
  tabTextActive: { color: "#FFFFFF" },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 12, fontFamily: FONT.medium },
  emptyBox: { alignItems: "center", padding: 40, gap: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  rowInline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.brandDim },
  pillText: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 12 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium },
  btn: { backgroundColor: COLORS.brand, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 13 },

  // Applicant card
  applicantCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  scoreBar: { flexDirection: "row", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  scoreText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  evalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.brand, padding: 12, borderRadius: 12, marginTop: 12 },
  evalBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  evalBtnGhost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  evalBtnGhostText: { color: COLORS.brand, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },

  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "94%" },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 10 },
  mHeader: { alignItems: "center", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  mAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  mInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 28 },
  mName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18, marginTop: 10 },
  mEmail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },

  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 16, marginBottom: 10 },
  docsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  docChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface2, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border },
  docChipText: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12, maxWidth: 100 },

  critCard: { backgroundColor: COLORS.surface2, padding: 12, borderRadius: 14, marginBottom: 10 },
  critHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  critIco: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  critLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  critDesc: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  critScorePill: { width: 44, height: 32, borderRadius: 10, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  critScoreText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },

  totalCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.sidebar, padding: 16, borderRadius: 16, marginTop: 12 },
  totalLabel: { color: COLORS.sidebarTextDim, fontFamily: FONT.medium, fontSize: 12 },
  totalValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 30, marginTop: 2 },
  totalMax: { color: COLORS.sidebarTextDim, fontFamily: FONT.semibold, fontSize: 16 },
  totalBar: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 8, overflow: "hidden" },
  totalFill: { height: "100%", borderRadius: 999 },
  predictBox: { alignItems: "center", paddingHorizontal: 8 },
  predictLabel: { color: COLORS.sidebarTextDim, fontSize: 10, fontFamily: FONT.medium },
  predictStatus: { fontFamily: FONT.extrabold, fontSize: 16, marginTop: 4, letterSpacing: 0.5 },
  predictSkill: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 11, marginTop: 2 },

  hint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 12, lineHeight: 16, textAlign: "center" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, marginTop: 16 },
  saveBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  closeBtn: { alignItems: "center", padding: 12, marginTop: 4 },
  closeText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },

  critList: { gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultLabel: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13, flex: 1 },
  resultVal: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  resultTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 12 },
  resultTotalLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  resultTotalVal: { fontFamily: FONT.extrabold, fontSize: 20 },

  // Preview modal
  previewBg: { flex: 1, backgroundColor: "rgba(10,37,64,0.85)", alignItems: "center", justifyContent: "center", padding: 20 },
  previewCard: { backgroundColor: COLORS.surface, borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "85%" },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  previewTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  previewImg: { width: "100%", height: 400, borderRadius: 12 },
  previewText: { backgroundColor: COLORS.surface2, padding: 16, borderRadius: 12 },
  previewTextContent: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, lineHeight: 20 },
});
