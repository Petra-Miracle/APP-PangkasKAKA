import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

type ByService = { name: string; count: number; revenue: number };
type RecentItem = { id: string; service_name: string; customer_name: string; booking_date: string; booking_time: string; amount: number };
type HistoryResp = { total_completed: number; total_revenue: number; by_service: ByService[]; recent: RecentItem[] };

// "Sel, 9 Sep" dari YYYY-MM-DD tanpa jebakan timezone (parse manual, bukan new Date(string)).
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "-";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

export default function ServiceHistory() {
  const router = useRouter();
  const [data, setData] = useState<HistoryResp | null>(null);
  const [loading, setLoading] = useState(true);

  // Refetch tiap fokus — skeleton cuma di load pertama, supaya pindah tab-tab
  // tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/karyawan/service-history"); setData(r); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Riwayat Layanan</Text>
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <Skeleton style={{ height: 110 }} />
        <Skeleton style={{ height: 80 }} />
        <Skeleton style={{ height: 80 }} />
      </View>
    </SafeAreaView>
  );

  const empty = !data || data.total_completed === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Riwayat Layanan</Text>
      </View>

      {empty ? (
        <EmptyState
          icon="cut-outline"
          title="Belum ada layanan selesai"
          description="Riwayat pesanan yang sudah kamu selesaikan akan muncul di sini."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHead}>
              <Text style={styles.summaryTitle}>Total Layanan Diberikan</Text>
              <View style={styles.summaryBadge}>
                <Ionicons name="checkmark-done" size={12} color={COLORS.brandLight} />
                <Text style={styles.summaryBadgeText}>Sepanjang waktu</Text>
              </View>
            </View>
            <Text style={styles.summaryValue}>{data!.total_completed} kali</Text>
            <Text style={styles.summaryHint}>{rupiah(data!.total_revenue)} total pendapatan bersih</Text>
          </View>

          <Text style={styles.sectionLabel}>JENIS LAYANAN</Text>
          <View style={styles.menu}>
            {data!.by_service.map((s, i) => (
              <View key={s.name} style={[styles.svcRow, i === data!.by_service.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.svcIcon}>
                  <Ionicons name="cut" size={18} color={COLORS.brandLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.svcName}>{s.name}</Text>
                  <Text style={styles.svcSub}>{s.count} kali dilayani</Text>
                </View>
                <Text style={styles.svcRevenue}>{rupiah(s.revenue)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>RIWAYAT TERBARU</Text>
          <View style={styles.menu}>
            {data!.recent.map((r, i) => (
              <View key={r.id} style={[styles.recentRow, i === data!.recent.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName} numberOfLines={1}>{r.service_name}</Text>
                  <Text style={styles.recentSub} numberOfLines={1}>
                    {r.customer_name || "Pelanggan"} · {shortDate(r.booking_date)} · {r.booking_time} WITA
                  </Text>
                </View>
                <Text style={styles.recentAmount}>{rupiah(r.amount)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },

  summaryCard: {
    backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 20,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  summaryBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  summaryBadgeText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 10 },
  summaryValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 34, marginTop: 10, letterSpacing: -0.5 },
  summaryHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 4 },

  sectionLabel: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 1.5, marginBottom: 10 },
  menu: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", marginBottom: 20, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3 },

  svcRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  svcIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  svcName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  svcSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  svcRevenue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 13 },

  recentRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recentName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  recentSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
  recentAmount: { color: COLORS.success, fontFamily: FONT.extrabold, fontSize: 13 },
});
