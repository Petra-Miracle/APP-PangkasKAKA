import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import Skeleton from "@/src/components/Skeleton";

const LEDGER_LABEL: Record<string, string> = {
  payment_in: "Pembayaran Masuk (Ditahan)",
  platform_commission: "Komisi Platform",
  barber_payout: "Dana Cair ke Dompet",
  payment_fee: "Biaya Pembayaran",
  refund: "Pengembalian Dana",
  withdrawal: "Penarikan Saldo",
};

export default function OwnerWallet() {
  const [wallet, setWallet] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingOut, setPayingOut] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", account_holder: "", verified: false });
  const [bankModal, setBankModal] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [w, l, s] = await Promise.allSettled([
        api.get("/wallets/me").catch(() => null),
        api.get("/wallets/me/ledger").catch(() => ({ entries: [] })),
        api.get("/owner/shop").catch(() => null),
      ]);
      if (w.status === "fulfilled" && w.value) setWallet(w.value.wallet);
      if (l.status === "fulfilled") setLedger((l.value as any).entries || []);
      if (s.status === "fulfilled" && (s.value as any)?.shop) {
        const shop = (s.value as any).shop;
        setBankForm({
          bank_name: shop.bank_name || "", account_number: shop.account_number || "",
          account_holder: shop.account_holder || "", verified: !!shop.bank_verified,
        });
      }
    } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Ganti bank/nomor rekening membatalkan verifikasi sebelumnya, sama seperti
  // alur StreetBarber (app/(streetbarber)/manage.tsx) — lihat
  // Noted/2026-09-21/Mentoring-Pitching.md poin 2 & 3.
  const updateBankField = (field: "bank_name" | "account_number", value: string) => {
    setBankForm((prev) => ({ ...prev, [field]: value, verified: false, account_holder: "" }));
  };

  const verifyBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_number.trim()) {
      return Alert.alert("Verifikasi Rekening", "Isi nama bank dan nomor rekening dulu");
    }
    setVerifyingBank(true);
    try {
      const r = await api.post("/bank/verify-account", {
        bank_name: bankForm.bank_name, account_number: bankForm.account_number,
      });
      setBankForm((prev) => ({ ...prev, account_holder: r.account_holder, verified: true }));
    } catch (e: any) {
      Alert.alert("Verifikasi Gagal", e.message || "Nomor rekening tidak ditemukan");
    } finally { setVerifyingBank(false); }
  };

  const saveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_number.trim() || !bankForm.verified) {
      return Alert.alert("Gagal", "Verifikasi rekening dulu sebelum menyimpan");
    }
    setSavingBank(true);
    try {
      await api.put("/owner/shop/bank-account", bankForm);
      setBankModal(false);
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyimpan data"); } finally { setSavingBank(false); }
  };

  const doPayout = async () => {
    setPayingOut(true);
    try {
      const r = await api.post("/payouts");
      Alert.alert("Penarikan Diajukan", `${rupiah(r.amount)} akan diproses tim secara manual (belum ada transfer otomatis).`);
      await load();
    } catch (e: any) { Alert.alert("Penarikan Gagal", e.message); } finally { setPayingOut(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.amberHeader}>
        <View pointerEvents="none" style={styles.headerDeco} />
        <Text style={styles.headerEyebrow}>DOMPET TOKO</Text>
        <Text style={styles.headerTitle}>Dompet</Text>
        <Text style={styles.headerSub}>Rincian saldo, riwayat dana, dan penarikan</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton style={{ height: 90 }} />
            <Skeleton style={{ height: 60 }} />
          </View>
        ) : (
          <>
            <View style={styles.balRow}>
              <View style={styles.balBox}>
                <Text style={styles.balLabel}>Ditahan Platform</Text>
                <Text style={styles.balValue}>{rupiah(wallet?.balance_pending || 0)}</Text>
              </View>
              <View style={styles.balBox}>
                <Text style={styles.balLabel}>Bisa Ditarik</Text>
                <Text style={styles.balValue}>{rupiah(wallet?.balance_available || 0)}</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
              <Text style={styles.infoText}>
                Dana pembayaran pelanggan ditahan otomatis di &quot;Ditahan Platform&quot; sampai
                pesanannya selesai, baru pindah ke &quot;Bisa Ditarik&quot;. Tarik kapan saja ke rekening
                terdaftar setelah saldo minimum Rp50.000.
              </Text>
            </View>

            <PressableScale style={styles.bankCard} onPress={() => setBankModal(true)} testID="open-bank-modal" scaleTo={0.98}>
              <View style={styles.bankIconWrap}>
                <Ionicons name="business" size={18} color={COLORS.brandLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankCardLabel}>Rekening Tujuan Pencairan</Text>
                {bankForm.bank_name ? (
                  <Text style={styles.bankCardValue} numberOfLines={1}>
                    {bankForm.bank_name} •• {bankForm.account_number.slice(-4)} — a.n. {bankForm.account_holder}
                    {bankForm.verified ? "" : " (belum diverifikasi)"}
                  </Text>
                ) : (
                  <Text style={[styles.bankCardValue, { color: COLORS.error }]}>Belum diisi — atur dulu sebelum tarik saldo</Text>
                )}
              </View>
              {bankForm.verified ? (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
              )}
            </PressableScale>

            <PressableScale
              style={[styles.payoutBtn, (payingOut || (wallet?.balance_available || 0) < 50000) && { opacity: 0.5 }]}
              onPress={doPayout}
              disabled={payingOut || (wallet?.balance_available || 0) < 50000}
              testID="request-payout"
              haptic
            >
              <Ionicons name="arrow-down" size={16} color={COLORS.onBrand} />
              <Text style={styles.payoutText}>{payingOut ? "..." : "TARIK SALDO"}</Text>
            </PressableScale>
            {(wallet?.balance_available || 0) < 50000 && (
              <Text style={styles.minHint}>Minimum penarikan Rp50.000</Text>
            )}

            <Text style={styles.secTitle}>RIWAYAT DOMPET</Text>
            <View style={styles.card}>
              {ledger.length === 0 ? (
                <Text style={styles.empty}>Belum ada riwayat</Text>
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
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={bankModal} transparent animationType="slide" onRequestClose={() => setBankModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sec}>REKENING TUJUAN PENCAIRAN</Text>
              <Text style={styles.label}>Nama bank</Text>
              <View style={styles.inputRow}>
                <Ionicons name="business-outline" size={18} color={COLORS.textDim} />
                <TextInput style={styles.inputFlex} placeholder="mis. BRI" placeholderTextColor={COLORS.textDim} value={bankForm.bank_name} onChangeText={(t) => updateBankField("bank_name", t)} testID="bank-name-input" />
              </View>
              <Text style={styles.label}>Nomor rekening</Text>
              <View style={styles.inputRow}>
                <Ionicons name="card-outline" size={18} color={COLORS.textDim} />
                <TextInput style={styles.inputFlex} keyboardType="numeric" placeholder="1234567890" placeholderTextColor={COLORS.textDim} value={bankForm.account_number} onChangeText={(t) => updateBankField("account_number", t)} testID="bank-number-input" />
              </View>
              {bankForm.verified ? (
                <View style={styles.bankVerifiedRow} testID="bank-verified-badge">
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankVerifiedName}>{bankForm.account_holder}</Text>
                    <Text style={styles.bankVerifiedHint}>Terverifikasi sebagai pemilik rekening</Text>
                  </View>
                </View>
              ) : (
                <PressableScale style={[styles.verifyBtn, verifyingBank && { opacity: 0.6 }]} onPress={verifyBank} disabled={verifyingBank} testID="verify-bank">
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.brandLight} />
                  <Text style={styles.verifyBtnText}>{verifyingBank ? "Memeriksa..." : "Verifikasi Rekening"}</Text>
                </PressableScale>
              )}
              <PressableScale style={[styles.saveBtn, savingBank && { opacity: 0.6 }]} onPress={saveBank} disabled={savingBank} testID="save-bank">
                <Text style={styles.saveBtnText}>{savingBank ? "..." : "SIMPAN"}</Text>
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
  amberHeader: {
    backgroundColor: COLORS.brand, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.18)", top: -70, right: -40 },
  headerEyebrow: { color: "rgba(15,26,46,0.6)", fontSize: 11, fontFamily: FONT.bold, letterSpacing: 2 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginTop: 2 },
  headerSub: { color: "rgba(15,26,46,0.65)", fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  balRow: { flexDirection: "row", gap: 10 },
  balBox: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: COLORS.brandDim, padding: 12, borderRadius: 14, marginTop: 12 },
  infoText: { flex: 1, color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 11, lineHeight: 16 },
  balLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  balValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 17, marginTop: 4 },
  payoutBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    backgroundColor: COLORS.brand, padding: 16, borderRadius: 14, marginTop: 14, minHeight: 54,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 5,
  },
  payoutText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 13, letterSpacing: 0.5 },
  minHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, textAlign: "center", marginTop: 6 },
  secTitle: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.surface, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  empty: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, paddingVertical: 14 },
  ledgerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  ledgerMemo: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13 },
  ledgerDate: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
  ledgerAmount: { fontFamily: FONT.extrabold, fontSize: 13 },

  bankCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginTop: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  bankIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  bankCardLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  bankCardValue: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13, marginTop: 2 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20,
  },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 4 },
  label: { color: COLORS.textMuted, marginTop: 14, marginBottom: 6, fontSize: 12, fontFamily: FONT.semibold },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.bg, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border },
  inputFlex: { flex: 1, color: COLORS.text, paddingVertical: 13, fontFamily: FONT.medium, fontSize: 14 },
  verifyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  verifyBtnText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 13 },
  bankVerifiedRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: COLORS.success },
  bankVerifiedName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  bankVerifiedHint: { color: COLORS.success, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
  saveBtn: { borderRadius: 14, marginTop: 20, backgroundColor: COLORS.brand, padding: 14, alignItems: "center" },
  saveBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1 },
  cancelBtn: { padding: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: COLORS.textDim, fontFamily: FONT.medium },
});
