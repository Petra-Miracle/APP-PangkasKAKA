import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
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

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [w, l] = await Promise.allSettled([
        api.get("/wallets/me").catch(() => null),
        api.get("/wallets/me/ledger").catch(() => ({ entries: [] })),
      ]);
      if (w.status === "fulfilled" && w.value) setWallet(w.value.wallet);
      if (l.status === "fulfilled") setLedger((l.value as any).entries || []);
    } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
                Dana pembayaran pelanggan ditahan otomatis di "Ditahan Platform" sampai
                pesanannya selesai, baru pindah ke "Bisa Ditarik". Tarik kapan saja ke rekening
                terdaftar setelah saldo minimum Rp50.000.
              </Text>
            </View>

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
});
