import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Modal, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

const DAY_ROWS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;

// Statistik bulanan dari ledger yang sudah di-fetch (pola payment-history):
// masuk = kredit bulan berjalan, ditarik = penarikan (withdrawal) bulan berjalan.
function MonthStats({ ledger }: { ledger: any[] }) {
  const now = new Date();
  const inMonth = ledger.filter((l: any) => {
    if (!l.created_at) return false;
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const masuk = inMonth.filter((l: any) => l.direction === "credit").reduce((a, l) => a + (l.amount || 0), 0);
  const ditarik = inMonth.filter((l: any) => l.entry_type === "withdrawal").reduce((a, l) => a + (l.amount || 0), 0);
  return (
    <View style={styles.monthStatRow}>
      <View style={styles.monthStatBox}>
        <Text style={styles.monthStatLabel}>Masuk bulan ini</Text>
        <Text style={styles.monthStatValue}>{rupiah(masuk)}</Text>
      </View>
      <View style={styles.monthStatBox}>
        <Text style={styles.monthStatLabel}>Ditarik bulan ini</Text>
        <Text style={styles.monthStatValue}>{rupiah(ditarik)}</Text>
      </View>
    </View>
  );
}

const LEDGER_LABEL: Record<string, string> = {
  payment_in: "Pembayaran Masuk (Ditahan)",
  platform_commission: "Komisi Platform",
  barber_payout: "Dana Cair ke Dompet",
  payment_fee: "Biaya Pembayaran",
  refund: "Pengembalian Dana",
  withdrawal: "Penarikan Saldo",
};

export default function StreetBarberManage() {
  const [hasActive, setHasActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", account_holder: "" });
  const [homeFeeInput, setHomeFeeInput] = useState("0");

  const [wallet, setWallet] = useState<any>(null);
  const [walletModal, setWalletModal] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [payingOut, setPayingOut] = useState(false);

  const [servicesModal, setServicesModal] = useState(false);
  const [myServices, setMyServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: "", duration: "30", price: "" });
  const [editingSvcId, setEditingSvcId] = useState<string | null>(null);
  const [savingSvc, setSavingSvc] = useState(false);

  const [scheduleModal, setScheduleModal] = useState(false);
  const [mySchedule, setMySchedule] = useState<Record<string, { open_time: string; close_time: string; is_closed: boolean }>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [bankModal, setBankModal] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  const { scrollRef, handleFocus } = useScrollToInput();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/karyawan/my");
      const apps = r.applications || [];
      const active = apps.find((a: any) => a.status === "active");
      if (active) {
        setHasActive(true);
        setBankForm({ bank_name: active.bank_name || "", account_number: active.bank_account_number || "", account_holder: active.bank_account_holder || "" });
        setHomeFeeInput(String(active.home_service_fee ?? 0));
        try { const w = await api.get("/wallets/me"); setWallet(w.wallet); } catch { setWallet(null); }
      } else {
        setHasActive(false);
      }
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openWallet = async () => {
    setWalletModal(true);
    setLoadingLedger(true);
    try { const r = await api.get("/wallets/me/ledger"); setLedger(r.entries || []); } catch {} finally { setLoadingLedger(false); }
  };

  const doPayout = async () => {
    setPayingOut(true);
    try {
      const r = await api.post("/payouts");
      Alert.alert("Penarikan Diajukan", `${rupiah(r.amount)} akan diproses tim secara manual (belum ada transfer otomatis).`);
      try { const w = await api.get("/wallets/me"); setWallet(w.wallet); } catch {}
      setLedger([]);
      setWalletModal(false);
    } catch (e: any) { Alert.alert("Penarikan Gagal", e.message); } finally { setPayingOut(false); }
  };

  const openServices = async () => {
    setServicesModal(true);
    setLoadingServices(true);
    try { const r = await api.get("/streetbarber/services"); setMyServices(r.services || []); } catch {} finally { setLoadingServices(false); }
  };

  const resetSvcForm = () => { setSvcForm({ name: "", duration: "30", price: "" }); setEditingSvcId(null); };

  const editService = (s: any) => {
    setEditingSvcId(s.id);
    setSvcForm({ name: s.name, duration: String(s.duration), price: String(s.price) });
  };

  const saveService = async () => {
    if (!svcForm.name.trim()) return Alert.alert("Gagal", "Nama layanan wajib diisi");
    const body = { name: svcForm.name.trim(), duration: parseInt(svcForm.duration || "0", 10), price: parseInt(svcForm.price || "0", 10) };
    if (!body.duration || !body.price) return Alert.alert("Gagal", "Durasi & harga wajib diisi dengan angka");
    setSavingSvc(true);
    try {
      if (editingSvcId) await api.put(`/streetbarber/services/${editingSvcId}`, body);
      else await api.post("/streetbarber/services", body);
      resetSvcForm();
      const r = await api.get("/streetbarber/services"); setMyServices(r.services || []);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan layanan"); } finally { setSavingSvc(false); }
  };

  const deleteService = async (sid: string) => {
    try {
      await api.del(`/streetbarber/services/${sid}`);
      setMyServices((prev) => prev.filter((s) => s.id !== sid));
      if (editingSvcId === sid) resetSvcForm();
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menghapus layanan"); }
  };

  const openSchedule = async () => {
    setScheduleModal(true);
    setLoadingSchedule(true);
    try {
      const r = await api.get("/streetbarber/schedules");
      const byDay: Record<string, any> = {};
      for (const row of r.schedules || []) byDay[row.day_name] = row;
      const merged: typeof mySchedule = {};
      for (const d of DAY_ROWS) {
        merged[d] = byDay[d]
          ? { open_time: byDay[d].open_time, close_time: byDay[d].close_time, is_closed: byDay[d].is_closed }
          : { open_time: "09:00", close_time: "21:00", is_closed: false };
      }
      setMySchedule(merged);
    } catch {} finally { setLoadingSchedule(false); }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const schedules = DAY_ROWS.map((d) => ({ day_name: d, ...mySchedule[d] }));
      await api.post("/streetbarber/schedules", { schedules });
      setScheduleModal(false);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan jadwal"); } finally { setSavingSchedule(false); }
  };

  const saveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_number.trim() || !bankForm.account_holder.trim()) {
      return Alert.alert("Gagal", "Semua kolom rekening wajib diisi");
    }
    setSavingBank(true);
    try {
      await api.put("/streetbarber/bank-account", bankForm);
      await api.put("/streetbarber/home-service-fee", { fee: parseInt(homeFeeInput || "0", 10) });
      setBankModal(false);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan data"); } finally { setSavingBank(false); }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Kelola</Text></View>
      <View style={{ padding: 16, gap: 10 }}><Skeleton style={{ height: 60 }} /><Skeleton style={{ height: 60 }} /><Skeleton style={{ height: 60 }} /></View>
    </SafeAreaView>
  );

  if (!hasActive) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Kelola</Text></View>
      <EmptyState icon="construct-outline" title="Belum aktif" description="Aktifkan akun StreetBarber-mu dulu di tab Beranda untuk mengelola layanan & jadwal." />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Kelola</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}>
        <PressableScale style={styles.manageRow} onPress={openWallet} testID="open-wallet" scaleTo={0.97}>
          <View style={styles.locIcon}><Ionicons name="wallet-outline" size={18} color={COLORS.brandLight} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>Dompet Saya</Text>
            <Text style={styles.locSub}>
              {wallet ? `${rupiah(wallet.balance_available || 0)} bisa ditarik · ${rupiah(wallet.balance_pending || 0)} ditahan` : "Lihat saldo & riwayat dompet"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </PressableScale>
        <PressableScale style={styles.manageRow} onPress={openServices} testID="open-services" scaleTo={0.97}>
          <View style={styles.locIcon}><Ionicons name="cut-outline" size={18} color={COLORS.brandLight} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>Kelola Layanan</Text>
            <Text style={styles.locSub}>Atur sendiri layanan & harga panggilan ke rumahmu</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </PressableScale>
        <PressableScale style={styles.manageRow} onPress={openSchedule} testID="open-schedule" scaleTo={0.97}>
          <View style={styles.locIcon}><Ionicons name="calendar-outline" size={18} color={COLORS.brandLight} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>Atur Jadwal</Text>
            <Text style={styles.locSub}>Jam kerja mingguan & tanggal libur milikmu sendiri</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </PressableScale>
        <PressableScale style={styles.manageRow} onPress={() => setBankModal(true)} testID="open-bank" scaleTo={0.97}>
          <View style={styles.locIcon}><Ionicons name="card-outline" size={18} color={COLORS.brandLight} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>Rekening & Biaya</Text>
            <Text style={styles.locSub}>
              {bankForm.bank_name ? `${bankForm.bank_name} a.n. ${bankForm.account_holder}` : "Belum diisi — tambahkan rekening tujuan pencairan"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </PressableScale>
      </ScrollView>

      <Modal visible={walletModal} transparent animationType="slide" onRequestClose={() => setWalletModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: "85%" }]}>
            <View style={styles.grabber} />
            <Text style={styles.sec}>DOMPET SAYA</Text>
            <View style={styles.walletBalRow}>
              <View style={styles.walletBalBox}>
                <Text style={styles.walletBalLabel}>Ditahan Platform</Text>
                <Text style={styles.walletBalValue}>{rupiah(wallet?.balance_pending || 0)}</Text>
              </View>
              <View style={styles.walletBalBox}>
                <Text style={styles.walletBalLabel}>Bisa Ditarik</Text>
                <Text style={styles.walletBalValue}>{rupiah(wallet?.balance_available || 0)}</Text>
              </View>
            </View>
            {bankForm.bank_name ? (
              <Text style={styles.payoutDestText}>
                Akan dicairkan ke {bankForm.bank_name} a.n. {bankForm.account_holder} — {bankForm.account_number}
              </Text>
            ) : (
              <Text style={[styles.payoutDestText, { color: COLORS.error }]}>
                Rekening tujuan belum diisi — atur dulu di "Rekening & Biaya"
              </Text>
            )}
            <PressableScale
              style={[styles.btnWrap, styles.payoutBtn, (payingOut || (wallet?.balance_available || 0) < 50000) && { opacity: 0.5 }]}
              onPress={doPayout}
              disabled={payingOut || (wallet?.balance_available || 0) < 50000}
              testID="request-payout"
            >
              <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                <Text style={styles.btnText}>{payingOut ? "..." : "TARIK SALDO"}</Text>
              </LinearGradient>
            </PressableScale>
            {(wallet?.balance_available || 0) < 50000 && (
              <Text style={styles.walletMinHint}>Minimum penarikan Rp50.000</Text>
            )}
            <Text style={[styles.sec, { marginTop: 16 }]}>BULAN INI</Text>
            <MonthStats ledger={ledger} />
            <Text style={[styles.sec, { marginTop: 16 }]}>RIWAYAT DOMPET</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {loadingLedger ? (
                <Skeleton style={{ height: 60 }} />
              ) : ledger.length === 0 ? (
                <Text style={styles.walletEmpty}>Belum ada riwayat</Text>
              ) : ledger.map((l: any) => (
                <View key={l.id} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerMemo}>{LEDGER_LABEL[l.entry_type] || l.entry_type}</Text>
                    <Text style={styles.ledgerDate}>{new Date(l.created_at).toLocaleString("id-ID")}</Text>
                  </View>
                  <Text style={[styles.ledgerAmount, { color: l.direction === "credit" ? COLORS.success : COLORS.error }]}>
                    {l.direction === "credit" ? "+" : "-"}{rupiah(l.amount)}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <PressableScale style={styles.cancelBtn} onPress={() => setWalletModal(false)}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <Modal visible={servicesModal} transparent animationType="slide" onRequestClose={() => setServicesModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modal, { maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            <Text style={styles.sec}>KELOLA LAYANAN</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nama Layanan</Text>
              <TextInput style={styles.input} placeholder="mis. Low Fade" placeholderTextColor={COLORS.textDim} value={svcForm.name} onChangeText={(t) => setSvcForm({ ...svcForm, name: t })} testID="svc-name-input" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Durasi (menit)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="30" placeholderTextColor={COLORS.textDim} value={svcForm.duration} onChangeText={(t) => setSvcForm({ ...svcForm, duration: t.replace(/[^0-9]/g, "") })} testID="svc-duration-input" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Harga (Rp)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="15000" placeholderTextColor={COLORS.textDim} value={svcForm.price} onChangeText={(t) => setSvcForm({ ...svcForm, price: t.replace(/[^0-9]/g, "") })} testID="svc-price-input" />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <PressableScale style={[styles.btnWrap, { flex: 1, marginTop: 0 }, savingSvc && { opacity: 0.6 }]} onPress={saveService} disabled={savingSvc} testID="svc-save">
                  <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                    <Text style={styles.btnText}>{savingSvc ? "..." : editingSvcId ? "SIMPAN PERUBAHAN" : "TAMBAH LAYANAN"}</Text>
                  </LinearGradient>
                </PressableScale>
                {editingSvcId && (
                  <PressableScale style={[styles.cancelBtn, { marginTop: 0 }]} onPress={resetSvcForm}>
                    <Text style={styles.cancelText}>Batal</Text>
                  </PressableScale>
                )}
              </View>
              <Text style={[styles.sec, { marginTop: 20 }]}>LAYANAN AKTIF</Text>
              {loadingServices ? <Skeleton style={{ height: 60 }} /> : myServices.length === 0 ? (
                <Text style={styles.empty}>Belum ada layanan. Tambahkan di atas.</Text>
              ) : myServices.map((s: any) => (
                <View key={s.id} style={styles.appCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.locIcon}><Ionicons name="cut" size={18} color={COLORS.brandLight} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cName}>{s.name}</Text>
                      <Text style={styles.cMeta}>{s.duration} menit · {rupiah(s.price)}</Text>
                    </View>
                    <PressableScale onPress={() => editService(s)} style={styles.svcActionBtn} testID={`svc-edit-${s.id}`}>
                      <Ionicons name="pencil" size={16} color={COLORS.brandLight} />
                    </PressableScale>
                    <PressableScale onPress={() => deleteService(s.id)} style={styles.svcActionBtn} testID={`svc-delete-${s.id}`}>
                      <Ionicons name="trash" size={16} color={COLORS.error} />
                    </PressableScale>
                  </View>
                </View>
              ))}
            </ScrollView>
            <PressableScale style={styles.cancelBtn} onPress={() => { setServicesModal(false); resetSvcForm(); }}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={scheduleModal} transparent animationType="slide" onRequestClose={() => setScheduleModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            <Text style={styles.sec}>ATUR JADWAL KERJA</Text>
            <PressableScale
              style={styles.copyDaysBtn}
              onPress={() => {
                const mon = mySchedule["Senin"] || { open_time: "09:00", close_time: "21:00", is_closed: false };
                const next: typeof mySchedule = {};
                for (const d of DAY_ROWS) next[d] = { ...mon };
                setMySchedule(next);
              }}
              testID="copy-monday-all"
              scaleTo={0.97}
            >
              <Ionicons name="copy-outline" size={14} color={COLORS.brandLight} />
              <Text style={styles.copyDaysText}>Samakan semua hari dengan Senin</Text>
            </PressableScale>
            {loadingSchedule ? <Skeleton style={{ height: 200 }} /> : (
              <ScrollView>
                {DAY_ROWS.map((d) => {
                  const row = mySchedule[d] || { open_time: "09:00", close_time: "21:00", is_closed: false };
                  return (
                    <View key={d} style={styles.dayRow}>
                      <View style={styles.dayRowTop}>
                        <Text style={styles.dayName}>{d}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.dayLiburLabel}>Libur</Text>
                          <Switch value={row.is_closed} onValueChange={(v) => setMySchedule({ ...mySchedule, [d]: { ...row, is_closed: v } })} trackColor={{ true: COLORS.brand }} testID={`sched-closed-${d}`} />
                        </View>
                      </View>
                      {!row.is_closed && (
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                          <TextInput style={[styles.input, { flex: 1 }]} placeholder="09:00" placeholderTextColor={COLORS.textDim} value={row.open_time} onChangeText={(t) => setMySchedule({ ...mySchedule, [d]: { ...row, open_time: t } })} testID={`sched-open-${d}`} />
                          <TextInput style={[styles.input, { flex: 1 }]} placeholder="21:00" placeholderTextColor={COLORS.textDim} value={row.close_time} onChangeText={(t) => setMySchedule({ ...mySchedule, [d]: { ...row, close_time: t } })} testID={`sched-close-${d}`} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <PressableScale style={[styles.btnWrap, savingSchedule && { opacity: 0.6 }]} onPress={saveSchedule} disabled={savingSchedule} testID="save-schedule">
              <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                <Text style={styles.btnText}>{savingSchedule ? "..." : "SIMPAN JADWAL"}</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale style={styles.cancelBtn} onPress={() => setScheduleModal(false)}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <Modal visible={bankModal} transparent animationType="slide" onRequestClose={() => setBankModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modal, { maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sec}>REKENING & BIAYA KE RUMAH</Text>
              <Text style={styles.dayLiburLabel}>Rekening ini jadi tujuan saat kamu menarik saldo dompet — tim mencairkan secara manual ke sini (belum ada transfer otomatis).</Text>
              <Text style={styles.label}>Nama Bank</Text>
              <TextInput style={styles.input} placeholder="mis. BRI" placeholderTextColor={COLORS.textDim} value={bankForm.bank_name} onChangeText={(t) => setBankForm({ ...bankForm, bank_name: t })} testID="bank-name-input" />
              <Text style={styles.label}>Nomor Rekening</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="1234567890" placeholderTextColor={COLORS.textDim} value={bankForm.account_number} onChangeText={(t) => setBankForm({ ...bankForm, account_number: t })} testID="bank-number-input" />
              <Text style={styles.label}>Nama Pemilik Rekening</Text>
              <TextInput style={styles.input} placeholder="Nama sesuai buku tabungan" placeholderTextColor={COLORS.textDim} value={bankForm.account_holder} onChangeText={(t) => setBankForm({ ...bankForm, account_holder: t })} testID="bank-holder-input" />
              <Text style={styles.label}>Biaya Layanan ke Rumah (Rp)</Text>
              <Text style={[styles.dayLiburLabel, { marginBottom: 6 }]}>Ditambahkan ke harga layanan saat customer booking panggilan ke rumah.</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={homeFeeInput} onChangeText={(t) => setHomeFeeInput(t.replace(/[^0-9]/g, ""))} testID="home-fee-input" />
              <PressableScale style={[styles.btnWrap, savingBank && { opacity: 0.6 }]} onPress={saveBank} disabled={savingBank} testID="save-bank">
                <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                  <Text style={styles.btnText}>{savingBank ? "..." : "SIMPAN"}</Text>
                </LinearGradient>
              </PressableScale>
            </ScrollView>
            <PressableScale style={styles.cancelBtn} onPress={() => setBankModal(false)}>
              <Text style={styles.cancelText}>Tutup</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 0 },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 20, marginBottom: 12 },
  manageRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  locIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  locTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  locSub: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  appCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  svcActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  dayRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dayRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  dayLiburLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, paddingVertical: 10 },
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  label: { color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  input: { backgroundColor: COLORS.surface, color: COLORS.text, padding: 13, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  btnWrap: { borderRadius: 14, marginTop: 20, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1 },
  monthStatRow: { flexDirection: "row", gap: 10 },
  monthStatBox: { flex: 1, backgroundColor: COLORS.surface2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  monthStatLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  monthStatValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, marginTop: 4 },
  copyDaysBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand, borderRadius: 12, paddingVertical: 10, marginBottom: 4 },
  copyDaysText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12 },
  cancelBtn: { padding: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.textDim, fontFamily: FONT.medium },
  walletBalRow: { flexDirection: "row", gap: 10 },
  walletBalBox: { flex: 1, backgroundColor: COLORS.surface2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  walletBalLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  walletBalValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, marginTop: 4 },
  payoutDestText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, textAlign: "center", marginTop: 10, lineHeight: 15 },
  payoutBtn: { marginTop: 14 },
  walletMinHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, textAlign: "center", marginTop: 6 },
  walletEmpty: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, paddingVertical: 10 },
  ledgerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  ledgerMemo: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13 },
  ledgerDate: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
  ledgerAmount: { fontFamily: FONT.extrabold, fontSize: 13 },
});
