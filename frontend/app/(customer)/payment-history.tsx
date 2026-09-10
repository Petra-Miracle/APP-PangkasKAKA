import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import { SkeletonRow } from "@/src/components/Skeleton";

const METHOD_LABEL: Record<string, string> = {
  durianpay: "QRIS", manual: "Manual", simulation: "Simulasi",
};

type FilterKey = "semua" | "paid" | "failed";

// "9 Sep 2025 · 13:58" dari ISO datetime (zona waktu perangkat, sama spt tanggal()).
function formatWaktu(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":");
  return `${date} · ${time}`;
}

function isPaidThisMonth(p: any, now: Date): boolean {
  if (p.status !== "paid" || !p.paid_at) return false;
  const d = new Date(p.paid_at);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function PaymentHistory() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Filter lokal dari data yang sudah di-fetch — tanpa endpoint baru.
  const [filter, setFilter] = useState<FilterKey>("semua");

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/payments/history"); setPayments(r.payments); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = filter === "semua" ? payments : payments.filter((p) => p.status === filter);
  const now = new Date();
  const monthPaid = payments.filter((p) => isPaidThisMonth(p, now));
  const monthTotal = monthPaid.reduce((a, p) => a + (p.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn} scaleTo={0.9}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Riwayat Pembayaran</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 12 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {payments.length > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name="wallet-outline" size={24} color={COLORS.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Total dibayar bulan ini</Text>
                <Text style={styles.summaryValue}>{rupiah(monthTotal)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.summaryCount}>{monthPaid.length}</Text>
                <Text style={styles.summaryCountSub}>transaksi</Text>
              </View>
            </View>
          )}

          {payments.length > 0 && (
            <View style={styles.chipRow}>
              {([
                ["semua", "Semua"],
                ["paid", "Berhasil"],
                ["failed", "Gagal"],
              ] as [FilterKey, string][]).map(([key, label]) => (
                <PressableScale
                  key={key}
                  testID={`filter-${key}`}
                  style={[styles.chip, filter === key && styles.chipActive]}
                  onPress={() => setFilter(key)}
                  scaleTo={0.95}
                >
                  <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>{label}</Text>
                </PressableScale>
              ))}
            </View>
          )}

          {payments.length === 0 && (
            <EmptyState
              icon="wallet-outline"
              title="Belum ada transaksi"
              description="Riwayat pembayaranmu akan muncul di sini."
            />
          )}
          {payments.length > 0 && shown.length === 0 && (
            <EmptyState
              icon="search-outline"
              title="Tidak ada hasil"
              description="Tidak ada transaksi pada filter ini."
            />
          )}
          {shown.length > 0 && (
            <View style={styles.listCard}>
              {shown.map((p: any, i: number) => {
                const paid = p.status === "paid";
                return (
                  <PressableScale
                    key={p.booking_id}
                    testID={`payment-${p.booking_id}`}
                    style={[styles.row, i === shown.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => router.push(`/payment/status/${p.booking_id}` as any)}
                    scaleTo={0.99}
                  >
                    <View style={[styles.statusIcon, paid ? styles.statusIconOk : styles.statusIconFail]}>
                      <Ionicons name={paid ? "checkmark" : "close"} size={20} color={paid ? COLORS.success : COLORS.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopName} numberOfLines={1}>{p.shop_name}</Text>
                      <View style={styles.metaRow}>
                        {p.method ? (
                          <View style={styles.methodPill}>
                            <Text style={styles.methodText}>{METHOD_LABEL[p.method] || p.method}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.dateText} numberOfLines={1}>{formatWaktu(p.paid_at || p.created_at)}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.amount}>{rupiah(p.amount)}</Text>
                      <Text style={[styles.statusText, { color: paid ? COLORS.success : COLORS.error }]}>
                        {paid ? "Berhasil" : "Gagal"}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingBottom: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  title: { flex: 1, color: COLORS.text, fontSize: 20, fontFamily: FONT.medium, letterSpacing: -0.2, textAlign: "center" },

  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.text,
    padding: 20, borderRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  summaryIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: FONT.medium },
  summaryValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 28, marginTop: 2, letterSpacing: -0.5 },
  summaryCount: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 22 },
  summaryCountSub: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: FONT.medium },

  chipRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 14 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  chipText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 13 },
  chipTextActive: { color: "#FFFFFF", fontFamily: FONT.bold },

  listCard: {
    backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statusIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusIconOk: { backgroundColor: "#E7F9F0" },
  statusIconFail: { backgroundColor: "#FDECEC" },
  shopName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dateText: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium },
  methodPill: { backgroundColor: COLORS.surface2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  methodText: { color: COLORS.textMuted, fontSize: 11, fontFamily: FONT.semibold },
  amount: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  statusText: { fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
});
