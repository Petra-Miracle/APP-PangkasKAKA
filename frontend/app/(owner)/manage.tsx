import { useCallback, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import Slider from "@react-native-community/slider";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

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
  const router = useRouter();
  const [tab, setTab] = useState<"barbers" | "services" | "karyawan">("barbers");
  const [shop, setShop] = useState<any>(null);
  const [karyawan, setKaryawan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [b, setB] = useState({ name: "", specialization: "", skill_level: "Standar" });
  const [s, setS] = useState({ name: "", duration: "30", price: "35000" });
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [evalTarget, setEvalTarget] = useState<any>(null);
  const [weights, setWeights] = useState(initWeights());
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; uri: string } | null>(null);
  const { scrollRef, handleFocus } = useScrollToInput();

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

  const resetBarberForm = () => { setB({ name: "", specialization: "", skill_level: "Standar" }); setEditingBarberId(null); };
  const resetServiceForm = () => { setS({ name: "", duration: "30", price: "35000" }); setEditingServiceId(null); };

  const saveBarber = async () => {
    if (!b.name) return;
    try {
      if (editingBarberId) {
        await api.put(`/owner/barbers/${editingBarberId}`, { name: b.name, specialization: b.specialization, skill_level: b.skill_level });
      } else {
        await api.post("/owner/barbers", { name: b.name, specialization: b.specialization, skill_level: "Standar" });
      }
      resetBarberForm();
      await load();
    } catch (e: any) { alert(e.message); }
  };
  const startEditBarber = (br: any) => {
    setEditingBarberId(br.id);
    setB({ name: br.name, specialization: br.specialization || "", skill_level: br.skill_level || "Standar" });
  };
  const deleteBarber = (br: any) => {
    Alert.alert("Hapus Barber", `Yakin ingin menghapus ${br.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (editingBarberId === br.id) resetBarberForm(); await api.del(`/owner/barbers/${br.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  const saveService = async () => {
    if (!s.name) return;
    try {
      if (editingServiceId) {
        await api.put(`/owner/services/${editingServiceId}`, { name: s.name, duration: parseInt(s.duration), price: parseInt(s.price) });
      } else {
        await api.post("/owner/services", { name: s.name, duration: parseInt(s.duration), price: parseInt(s.price) });
      }
      resetServiceForm();
      await load();
    } catch (e: any) { alert(e.message); }
  };
  const startEditService = (sv: any) => {
    setEditingServiceId(sv.id);
    setS({ name: sv.name, duration: String(sv.duration), price: String(sv.price) });
  };
  const deleteService = (sv: any) => {
    Alert.alert("Hapus Layanan", `Yakin ingin menghapus ${sv.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (editingServiceId === sv.id) resetServiceForm(); await api.del(`/owner/services/${sv.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  const openEvaluate = (k: any) => {
    setWeights(initWeights());
    setEvalTarget(k);
  };

  const confirmBerkas = (k: any, decision: "lolos" | "tolak") => {
    const isApprove = decision === "lolos";
    Alert.alert(
      isApprove ? "Setujui Berkas" : "Tolak Berkas",
      isApprove
        ? `Berkas ${k.name} dinyatakan lolos dan lanjut ke tahap koordinasi uji tes kemampuan (via chat).`
        : `Yakin ingin menolak lamaran StreetBarber ${k.name}? Aksi ini tidak bisa dibatalkan.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: isApprove ? "Setujui" : "Tolak", style: isApprove ? "default" : "destructive",
          onPress: async () => {
            try { await api.post(`/owner/karyawan/${k.id}/berkas-decision`, { decision }); await load(); }
            catch (e: any) { alert(e.message); }
          },
        },
      ]
    );
  };

  const submitEvaluation = async () => {
    if (!evalTarget) return;
    setSaving(true);
    try {
      const r = await api.post(`/owner/karyawan/${evalTarget.id}/evaluate`, weights);
      Alert.alert(
        r.status === "active" ? "Pelamar Diterima" : "Pelamar Ditolak",
        `Skor total: ${r.total_score}/120\nStatus: ${r.status === "active" ? "AKTIF — resmi jadi StreetBarber, melayani panggilan ke rumah secara mandiri" : "DITOLAK"}`
      );
      setEvalTarget(null);
      await load();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const isImageDoc = (val?: string) => !!val && (val.startsWith("data:image") || /\.(png|jpe?g|webp|gif|heic)$/i.test(val));

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 22, width: 160, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 12, width: 120, marginTop: 8, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 70 }} />
        <Skeleton style={{ height: 70 }} />
        <Skeleton style={{ height: 160 }} />
      </View>
    </SafeAreaView>
  );
  if (!shop) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Text style={styles.headerTitle}>Kelola Toko</Text>
      </LinearGradient>
      <EmptyState icon="storefront-outline" title="Belum ada toko" description="Daftarkan toko terlebih dulu di Dashboard." onAction={() => router.push("/(owner)/dashboard" as any)} actionLabel="Ke Dashboard" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <Text style={styles.headerTitle}>Kelola Toko</Text>
        <Text style={styles.headerSub}>{shop.name}</Text>
      </LinearGradient>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 60 }}>
        {[["barbers", "Barber Toko", "cut"], ["services", "Layanan", "pricetag"], ["karyawan", "Pelamar StreetBarber", "people"]].map(([k, l, i]) => (
          <PressableScale key={k} testID={`tab-${k}`} onPress={() => setTab(k as any)} style={[styles.tab, tab === k && styles.tabActive]} scaleTo={0.94}>
            <Ionicons name={i as any} size={14} color={tab === k ? "#FFFFFF" : COLORS.textDim} />
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </PressableScale>
        ))}
      </ScrollView>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {tab === "barbers" && (
          <View>
            {shop.barbers.filter((br: any) => !br.is_street_barber).map((br: any) => (
              <View key={br.id} style={styles.item} testID={`brb-${br.id}`}>
                <View style={styles.avatar}><Ionicons name="cut" size={18} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{br.name}</Text>
                  <View style={styles.rowInline}>
                    <View style={styles.pill}><Text style={styles.pillText}>{br.skill_level}</Text></View>
                    <Text style={styles.itemMeta}>{br.specialization || "-"}</Text>
                  </View>
                </View>
                <PressableScale style={styles.iconBtn} onPress={() => startEditBarber(br)} testID={`edit-brb-${br.id}`} scaleTo={0.9}>
                  <Ionicons name="pencil" size={16} color={COLORS.brand} />
                </PressableScale>
                <PressableScale style={styles.iconBtn} onPress={() => deleteBarber(br)} testID={`del-brb-${br.id}`} scaleTo={0.9}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                </PressableScale>
              </View>
            ))}
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>{editingBarberId ? "Edit Barber" : "Tambah Barber Manual"}</Text>
                {editingBarberId && (
                  <PressableScale onPress={resetBarberForm} scaleTo={0.9}>
                    <Text style={styles.cancelEditText}>Batal</Text>
                  </PressableScale>
                )}
              </View>
              <TextInput style={styles.input} value={b.name} onChangeText={(t) => setB({ ...b, name: t })} placeholder="Nama barber" placeholderTextColor={COLORS.textDim} testID="new-barber-name" onFocus={handleFocus} />
              <TextInput style={styles.input} value={b.specialization} onChangeText={(t) => setB({ ...b, specialization: t })} placeholder="Spesialisasi (mis. Fade & Undercut)" placeholderTextColor={COLORS.textDim} onFocus={handleFocus} />
              <PressableScale style={styles.btnWrap} onPress={saveBarber} testID="add-barber" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>{editingBarberId ? "SIMPAN PERUBAHAN" : "TAMBAH BARBER"}</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          </View>
        )}
        {tab === "services" && (
          <View>
            {shop.services.map((sv: any) => (
              <View key={sv.id} style={styles.item} testID={`svc-${sv.id}`}>
                <View style={styles.avatar}><Ionicons name="pricetag" size={18} color={COLORS.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{sv.name}</Text>
                  <Text style={styles.itemMeta}>{sv.duration} menit</Text>
                </View>
                <Text style={styles.itemPrice}>{rupiah(sv.price)}</Text>
                <PressableScale style={styles.iconBtn} onPress={() => startEditService(sv)} testID={`edit-svc-${sv.id}`} scaleTo={0.9}>
                  <Ionicons name="pencil" size={16} color={COLORS.brand} />
                </PressableScale>
                <PressableScale style={styles.iconBtn} onPress={() => deleteService(sv)} testID={`del-svc-${sv.id}`} scaleTo={0.9}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                </PressableScale>
              </View>
            ))}
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>{editingServiceId ? "Edit Layanan" : "Tambah Layanan"}</Text>
                {editingServiceId && (
                  <PressableScale onPress={resetServiceForm} scaleTo={0.9}>
                    <Text style={styles.cancelEditText}>Batal</Text>
                  </PressableScale>
                )}
              </View>
              <TextInput style={styles.input} value={s.name} onChangeText={(t) => setS({ ...s, name: t })} placeholder="Nama layanan" placeholderTextColor={COLORS.textDim} testID="new-svc-name" onFocus={handleFocus} />
              <TextInput style={styles.input} value={s.duration} onChangeText={(t) => setS({ ...s, duration: t })} placeholder="Durasi (menit)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" onFocus={handleFocus} />
              <TextInput style={styles.input} value={s.price} onChangeText={(t) => setS({ ...s, price: t })} placeholder="Harga (Rp)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" onFocus={handleFocus} />
              <PressableScale style={styles.btnWrap} onPress={saveService} testID="add-service" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>{editingServiceId ? "SIMPAN PERUBAHAN" : "TAMBAH LAYANAN"}</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          </View>
        )}
        {tab === "karyawan" && (
          <View>
            {karyawan.length === 0 && (
              <EmptyState
                icon="people-outline"
                title="Belum ada pelamar"
                description="Pelamar StreetBarber yang memilih toko ini sebagai validator akan muncul di sini."
              />
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
                    k.status === "rejected" ? { backgroundColor: "#FEF2F2" } :
                    ["menunggu_tes", "seleksi_berkas_lolos"].includes(k.status) ? { backgroundColor: "#EFF8FF" } : { backgroundColor: "#FFF7ED" }]}>
                    <Text style={[styles.statusBadgeText,
                      k.status === "active" ? { color: COLORS.success } :
                      k.status === "rejected" ? { color: COLORS.error } :
                      ["menunggu_tes", "seleksi_berkas_lolos"].includes(k.status) ? { color: COLORS.info } : { color: COLORS.warning }]}>
                      {k.status === "active" ? "STREETBARBER AKTIF" :
                       k.status === "rejected" ? "DITOLAK" :
                       ["menunggu_tes", "seleksi_berkas_lolos"].includes(k.status) ? "TAHAP TES" : "MENUNGGU BERKAS"}
                    </Text>
                  </View>
                </View>
                {k.status !== "pending" && !["menunggu_tes", "seleksi_berkas_lolos"].includes(k.status) && (
                  <View style={styles.scoreBar}>
                    <View style={styles.scoreDot} />
                    <Text style={styles.scoreText}>Skor: <Text style={{ color: COLORS.text, fontFamily: FONT.extrabold }}>{k.total_score}/120</Text></Text>
                  </View>
                )}
                {k.status === "pending" ? (
                  <View style={styles.berkasRow}>
                    <PressableScale style={styles.berkasRejectBtn} onPress={() => confirmBerkas(k, "tolak")} testID={`berkas-tolak-${k.id}`} scaleTo={0.97}>
                      <Ionicons name="close" size={16} color={COLORS.error} />
                      <Text style={styles.berkasRejectText}>TOLAK BERKAS</Text>
                    </PressableScale>
                    <PressableScale style={styles.berkasApproveBtnWrap} onPress={() => confirmBerkas(k, "lolos")} testID={`berkas-lolos-${k.id}`} haptic>
                      <LinearGradient
                        colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.berkasApproveBtn}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.berkasApproveText}>SETUJUI BERKAS</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                ) : ["menunggu_tes", "seleksi_berkas_lolos"].includes(k.status) ? (
                  <PressableScale style={styles.evalBtnWrap} onPress={() => openEvaluate(k)} testID={`eval-${k.id}`} haptic>
                    <LinearGradient
                      colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.evalBtn}
                    >
                      <Ionicons name="clipboard" size={16} color="#FFFFFF" />
                      <Text style={styles.evalBtnText}>EVALUASI PELAMAR</Text>
                    </LinearGradient>
                  </PressableScale>
                ) : (
                  <PressableScale style={styles.evalBtnGhost} onPress={() => openEvaluate(k)} scaleTo={0.97}>
                    <Ionicons name="eye-outline" size={16} color={COLORS.brand} />
                    <Text style={styles.evalBtnGhostText}>LIHAT DETAIL</Text>
                  </PressableScale>
                )}
                {["menunggu_tes", "seleksi_berkas_lolos", "active"].includes(k.status) && (
                  <PressableScale style={styles.evalBtnGhost} onPress={() => router.push(`/chat/recruitment/${k.id}` as any)} testID={`chat-${k.id}`} scaleTo={0.97}>
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.brand} />
                    <Text style={styles.evalBtnGhostText} numberOfLines={1}>Chat {k.name}</Text>
                  </PressableScale>
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
              {["menunggu_tes", "seleksi_berkas_lolos"].includes(evalTarget?.status) ? (
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
                  <LinearGradient
                    colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.totalCard}
                  >
                    <View pointerEvents="none" style={styles.totalDeco} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.totalLabel}>Skor Total</Text>
                      <Text style={styles.totalValue}>{total} <Text style={styles.totalMax}>/ 120</Text></Text>
                      <View style={styles.totalBar}>
                        <View style={[styles.totalFill, { width: `${Math.min(100, (total / 120) * 100)}%`, backgroundColor: predictedStatus === "active" ? COLORS.success : COLORS.warning }]} />
                      </View>
                    </View>
                    <View style={styles.predictBox}>
                      <Text style={styles.predictLabel}>Prediksi</Text>
                      <Text style={[styles.predictStatus, { color: predictedStatus === "active" ? "#00FFB0" : "#FFB4B4" }]}>
                        {predictedStatus === "active" ? "AKTIF" : "DITOLAK"}
                      </Text>
                      {predictedStatus === "active" && (
                        <Text style={styles.predictSkill}>{predictedSkill}</Text>
                      )}
                    </View>
                  </LinearGradient>

                  <Text style={styles.hint}>
                    Skor ≥ 60 → Aktif, otomatis jadi StreetBarber mandiri (bukan karyawan toko).{"\n"}
                    Skor ≥ 85 = Senior · ≥ 70 = Standar · Lainnya = Junior.
                  </Text>

                  <PressableScale style={[styles.saveBtnWrap, total === 0 && { opacity: 0.5 }]} onPress={submitEvaluation} disabled={saving || total === 0} testID="save-evaluation" haptic>
                    <LinearGradient
                      colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.saveBtn}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>{saving ? "MENYIMPAN..." : "SIMPAN EVALUASI"}</Text>
                    </LinearGradient>
                  </PressableScale>
                </>
              ) : (
                <>
                  <Text style={styles.sec}>HASIL EVALUASI</Text>
                  <View style={styles.critList}>
                    {CRITERIA.map((c) => (
                      <View key={c.key} style={styles.resultRow}>
                        <View style={styles.resultIco}><Ionicons name={c.icon as any} size={14} color={COLORS.brand} /></View>
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
            <PressableScale style={styles.closeBtn} onPress={() => setEvalTarget(null)} scaleTo={0.97}>
              <Text style={styles.closeText}>Tutup</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      {/* ---------- Preview Berkas ---------- */}
      <Modal visible={!!previewDoc} animationType="fade" transparent onRequestClose={() => setPreviewDoc(null)}>
        <View style={styles.previewBg}>
          <View style={styles.previewCard}>
            <View style={styles.previewHead}>
              <Text style={styles.previewTitle}>{previewDoc?.title}</Text>
              <PressableScale onPress={() => setPreviewDoc(null)} scaleTo={0.9}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </PressableScale>
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
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.05)", top: -65, right: -35 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 12 },
  tab: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 12 },
  tabTextActive: { color: "#FFFFFF" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  rowInline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.brandDim },
  pillText: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold },
  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, marginTop: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 12 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cancelEditText: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 12 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 13, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  btnWrap: { borderRadius: 14, marginTop: 4, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 13 },

  // Applicant card
  applicantCard: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  scoreDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  scoreText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  evalBtnWrap: { borderRadius: 13, marginTop: 12, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  evalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
  evalBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  evalBtnGhost: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 13, marginTop: 8, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  evalBtnGhostText: { color: COLORS.brand, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  berkasRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  berkasRejectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: COLORS.error, backgroundColor: "#FEF2F2",
  },
  berkasRejectText: { color: COLORS.error, fontFamily: FONT.extrabold, letterSpacing: 0.6, fontSize: 11 },
  berkasApproveBtnWrap: { flex: 1, borderRadius: 13, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  berkasApproveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
  berkasApproveText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.6, fontSize: 11 },

  // Modal
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "94%", shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 10 },
  mHeader: { alignItems: "center", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  mAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.brandDim },
  mInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 28 },
  mName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18, marginTop: 10 },
  mEmail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },

  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 16, marginBottom: 10 },
  docsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  docChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface2, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  docChipText: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12, maxWidth: 100 },

  critCard: { backgroundColor: COLORS.surface2, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  critHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  critIco: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  critLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  critDesc: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  critScorePill: { width: 44, height: 32, borderRadius: 10, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  critScoreText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },

  totalCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, marginTop: 12, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6 },
  totalDeco: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30 },
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
  saveBtnWrap: { borderRadius: 15, marginTop: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  saveBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  closeBtn: { alignItems: "center", padding: 12, marginTop: 4 },
  closeText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },

  critList: { gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultIco: { width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  resultLabel: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13, flex: 1 },
  resultVal: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  resultTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 12 },
  resultTotalLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  resultTotalVal: { fontFamily: FONT.extrabold, fontSize: 20 },

  // Preview modal
  previewBg: { flex: 1, backgroundColor: COLORS.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  previewCard: { backgroundColor: COLORS.surface, borderRadius: 22, width: "100%", maxWidth: 500, maxHeight: "85%", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  previewTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  previewImg: { width: "100%", height: 400, borderRadius: 12 },
  previewText: { backgroundColor: COLORS.surface2, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  previewTextContent: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, lineHeight: 20 },
});