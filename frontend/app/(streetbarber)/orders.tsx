import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, tanggal, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

const FUND_STATE_META: Record<string, { color: string; bg: string; label: string }> = {
  unpaid: { color: COLORS.textDim, bg: COLORS.border, label: "Belum Dibayar" },
  held: { color: "#B45309", bg: "#FFF7ED", label: "Dana Ditahan Platform" },
  released: { color: COLORS.success, bg: "#ECFDF5", label: "Dana Sudah Cair" },
  refunded: { color: COLORS.error, bg: "#FEF2F2", label: "Dikembalikan ke Customer" },
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#B45309", bg: "#FFF7ED", label: "Menunggu Bayar" },
  confirmed: { color: COLORS.info, bg: "#EFF6FF", label: "Berjalan" },
};

export default function StreetBarberOrders() {
  const router = useRouter();
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/karyawan/bookings"); setMyBookings(r.bookings || []); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const completeBooking = async (id: string) => {
    setCompletingId(id);
    try {
      await api.post(`/karyawan/bookings/${id}/complete`);
      await load();
    } catch (e: any) { Alert.alert("Gagal", e.message || "Gagal menyelesaikan pesanan"); } finally { setCompletingId(null); }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}><Text style={styles.title}>Pesanan</Text></View>
      <View style={{ padding: 16, gap: 10 }}><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 120 }} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Pesanan Saya</Text>
        <Text style={styles.sub}>Panggilan yang kamu terima</Text>
      </View>
      {myBookings.length === 0 ? (
        <EmptyState
          icon="bicycle-outline"
          title="Belum ada panggilan"
          description="Nyalakan Bagikan Lokasi supaya pelanggan di sekitarmu bisa memanggil kamu."
          actionLabel="Buka Beranda"
          onAction={() => router.push("/(streetbarber)/dashboard" as any)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          {myBookings.map((b: any) => {
            const sm = STATUS_META[b.status];
            const initials = (b.customer?.name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
            <View key={b.id} style={styles.appCard}>
              <View style={styles.rowTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cName} numberOfLines={1}>{b.customer?.name}</Text>
                  <Text style={styles.cMeta} numberOfLines={1}>{b.service?.name}</Text>
                  <Text style={styles.cMeta} numberOfLines={1}>{tanggal(b.booking_date)} · {b.booking_time} WITA</Text>
                </View>
                {sm && (
                  <View style={[styles.badge, { backgroundColor: sm.bg }]}>
                    <Text style={[styles.badgeText, { color: sm.color }]}>{sm.label}</Text>
                  </View>
                )}
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{rupiah(b.amount_total_charged ?? b.total_price ?? 0)}</Text>
                {b.fund_state && FUND_STATE_META[b.fund_state] && (
                  <Text style={[styles.fundText, { color: FUND_STATE_META[b.fund_state].color }]}>
                    {FUND_STATE_META[b.fund_state].label}
                  </Text>
                )}
              </View>
              <View style={styles.actionRow}>
                <PressableScale style={styles.chatBtn} onPress={() => router.push(`/chat/booking/${b.id}` as any)} testID={`booking-chat-${b.id}`} scaleTo={0.96}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.textMuted} />
                  <Text style={styles.chatBtnText}>Chat</Text>
                </PressableScale>
                {b.delivery_mode === "rumah" && b.status === "confirmed" && (
                  <PressableScale
                    style={[styles.doneBtn, completingId === b.id && { opacity: 0.6 }]}
                    onPress={() => completeBooking(b.id)}
                    disabled={completingId === b.id}
                    testID={`booking-complete-${b.id}`}
                    scaleTo={0.96}
                    haptic
                  >
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.onBrand} />
                    <Text style={styles.doneBtnText}>{completingId === b.id ? "..." : "Selesaikan pesanan"}</Text>
                  </PressableScale>
                )}
              </View>
            </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 12 },
  title: { color: COLORS.text, fontSize: 28, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  sub: { color: COLORS.textDim, fontSize: 13, fontFamily: FONT.medium, marginTop: 2 },
  appCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 16 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  cMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, flexShrink: 0 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  price: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  fundText: { fontFamily: FONT.medium, fontSize: 11 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  chatBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chatBtnText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  doneBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12,
    borderRadius: 14, backgroundColor: COLORS.brand,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  doneBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 13 },
});
