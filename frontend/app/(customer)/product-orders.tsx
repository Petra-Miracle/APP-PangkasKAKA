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

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "Menunggu Bayar" },
  confirmed: { color: COLORS.success, bg: "#ECFDF5", label: "Terkonfirmasi" },
  completed: { color: COLORS.info, bg: "#F0F9FF", label: "Selesai" },
  cancelled: { color: COLORS.error, bg: "#FEF2F2", label: "Dibatalkan" },
};

export default function ProductOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/product-orders"); setOrders(r.orders || []); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn} scaleTo={0.9}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </PressableScale>
        <View>
          <Text style={styles.title}>Pesanan Produk</Text>
          <Text style={styles.sub}>Semua pembelian produk yang pernah kamu lakukan</Text>
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
          {orders.length === 0 && (
            <EmptyState
              icon="bag-handle-outline"
              title="Belum ada pesanan produk"
              description="Pesanan produk yang kamu buat dari Katalog Produk akan muncul di sini."
            />
          )}
          {orders.map((o: any) => {
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            return (
              <PressableScale
                key={o.id}
                style={styles.card}
                testID={`product-order-${o.id}`}
                onPress={() => router.push(`/payment/status-product/${o.id}` as any)}
                scaleTo={0.98}
              >
                <View style={styles.thumbWrap}>
                  {o.product_image ? (
                    <Image source={{ uri: o.product_image }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <Ionicons name="bag-handle-outline" size={20} color={COLORS.brand} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{o.product_name} x{o.quantity}</Text>
                  <Text style={styles.dateText}>{tanggal(o.paid_at || o.created_at)}</Text>
                  <Text style={styles.fulfillText}>
                    {o.fulfillment === "delivery" ? "Diantar ke Alamat" : "Ambil di Toko"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.amount}>{rupiah(o.amount_total_charged)}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              </PressableScale>
            );
          })}
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
  name: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  dateText: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  fulfillText: { color: COLORS.textMuted, fontSize: 11, marginTop: 1, fontFamily: FONT.semibold },
  amount: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  badgeText: { fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.3 },
});
