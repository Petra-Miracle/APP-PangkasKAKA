import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah, tanggal } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import { SkeletonRow } from "@/src/components/Skeleton";

const METHOD_LABEL: Record<string, string> = {
  durianpay: "QRIS", manual: "Manual", simulation: "Simulasi",
};

export default function PaymentHistory() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/payments/history"); setPayments(r.payments); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn} scaleTo={0.9}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </PressableScale>
        <View>
          <Text style={styles.title}>Riwayat Pembayaran</Text>
          <Text style={styles.sub}>Semua transaksi yang pernah kamu lakukan</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 12 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}>
          {payments.length === 0 && (
            <EmptyState
              icon="wallet-outline"
              title="Belum ada transaksi"
              description="Riwayat pembayaranmu akan muncul di sini."
            />
          )}
          {payments.map((p: any) => (
            <PressableScale
              key={p.booking_id}
              style={styles.card}
              testID={`payment-${p.booking_id}`}
              onPress={() => router.push(`/payment/status/${p.booking_id}` as any)}
              scaleTo={0.98}
            >
              <View style={styles.thumbWrap}>
                {p.shop_image ? (
                  <Image source={{ uri: p.shop_image }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <Ionicons name="storefront-outline" size={20} color={COLORS.brand} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{p.shop_name}</Text>
                <Text style={styles.dateText}>{tanggal(p.paid_at || p.created_at)}</Text>
                {p.method && <Text style={styles.methodText}>{METHOD_LABEL[p.method] || p.method}</Text>}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.amount}>{rupiah(p.amount)}</Text>
                <View style={[styles.badge, p.status === "paid" ? styles.badgeSuccess : styles.badgeFailed]}>
                  <Text style={[styles.badgeText, { color: p.status === "paid" ? COLORS.success : COLORS.error }]}>
                    {p.status === "paid" ? "Lunas" : "Gagal"}
                  </Text>
                </View>
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold },
  sub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  thumbWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumb: { width: 44, height: 44 },
  shopName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  dateText: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  methodText: { color: COLORS.textMuted, fontSize: 11, marginTop: 1, fontFamily: FONT.semibold },
  amount: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  badgeSuccess: { backgroundColor: "#ECFDF5" },
  badgeFailed: { backgroundColor: "#FEF2F2" },
  badgeText: { fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.3 },
});
