import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import { SkeletonRow } from "@/src/components/Skeleton";

// Badge makna (§12): kuning=menunggu, biru=berlangsung, hijau=selesai, merah=batal.
const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#B45309", bg: "#FFF7ED", label: "Menunggu Bayar" },
  confirmed: { color: COLORS.info, bg: "#EFF6FF", label: "Berlangsung" },
  completed: { color: COLORS.success, bg: "#ECFDF5", label: "Selesai" },
  cancelled: { color: COLORS.error, bg: "#FEF2F2", label: "Dibatalkan" },
};

// "Sab, 6 Sep" dari ISO datetime (ambil tanggalnya saja, hindari geser timezone).
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "-";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

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
          <Text style={styles.title}>Pesanan</Text>
          <Text style={styles.sub}>Riwayat layanan & produk kamu</Text>
        </View>
      </View>

      {/* Segmented tipe (§1b): 2 layar tetap terpisah, tombol ini hanya navigasi antar keduanya */}
      <View style={styles.typeSeg}>
        <PressableScale testID="type-layanan" style={styles.typeOpt} onPress={() => router.push("/(customer)/orders" as any)} scaleTo={0.96}>
          <Text style={styles.typeText}>Layanan</Text>
        </PressableScale>
        <View style={[styles.typeOpt, styles.typeOptActive]}>
          <Text style={[styles.typeText, styles.typeTextActive]}>Produk</Text>
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
                <View style={styles.rowTop}>
                  <View style={styles.thumbWrap}>
                    {o.product_image ? (
                      <Image source={{ uri: o.product_image }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <Ionicons name="bag-handle-outline" size={20} color={COLORS.brandLight} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{o.product_name}</Text>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <Ionicons name="bag-handle-outline" size={12} color={COLORS.textDim} />
                      <Text style={styles.itemText} numberOfLines={1}>
                        {o.product_name} · {o.quantity} pcs
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {shortDate(o.paid_at || o.created_at)} · {o.fulfillment === "delivery" ? "Diantar" : "Diambil"}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBottom}>
                  <View>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.amount}>{rupiah(o.amount_total_charged)}</Text>
                  </View>
                  {o.status === "pending" && (
                    <PressableScale
                      testID={`pay-product-${o.id}`}
                      style={styles.payBtn}
                      onPress={() => router.push(`/payment/status-product/${o.id}` as any)}
                      scaleTo={0.96}
                    >
                      <Text style={styles.payBtnText}>Bayar</Text>
                    </PressableScale>
                  )}
                  {o.status === "cancelled" && !!o.product_id && (
                    <PressableScale
                      testID={`reorder-product-${o.id}`}
                      style={styles.reorderBtn}
                      onPress={() => router.push(`/(customer)/product/${o.product_id}` as any)}
                      scaleTo={0.96}
                    >
                      <Text style={styles.reorderText}>Pesan lagi</Text>
                    </PressableScale>
                  )}
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
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingBottom: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  sub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 3 },

  typeSeg: {
    flexDirection: "row", backgroundColor: COLORS.surface2, borderRadius: 16, padding: 4, marginHorizontal: 20, marginBottom: 4, gap: 4,
  },
  typeOpt: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  typeOptActive: { backgroundColor: COLORS.surface, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  typeText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 14 },
  typeTextActive: { color: COLORS.text, fontFamily: FONT.extrabold },
  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  rowTop: { flexDirection: "row", gap: 12 },
  thumbWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumb: { width: 56, height: 56 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, flex: 1 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  itemText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.medium, flex: 1 },
  dateText: { color: COLORS.textDim, fontSize: 12, marginTop: 3, fontFamily: FONT.medium },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  totalLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  amount: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 17, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  badgeText: { fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.3 },
  payBtn: { borderRadius: 12, backgroundColor: COLORS.brand, paddingVertical: 11, paddingHorizontal: 18, flexShrink: 0, shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  payBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 13 },
  reorderBtn: { borderRadius: 12, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 11, paddingHorizontal: 16, flexShrink: 0 },
  reorderText: { color: COLORS.textMuted, fontFamily: FONT.bold, fontSize: 13 },
});
