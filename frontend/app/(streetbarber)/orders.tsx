import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
        <Text style={styles.title}>Pesanan</Text>
      </View>
      {myBookings.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Belum ada pesanan"
          description="Aktifkan akun StreetBarber-mu dulu di tab Beranda untuk mulai menerima pesanan."
        />
      ) : (
        <View style={{ padding: 16, gap: 8 }}>
          {myBookings.map((b: any) => {
            const sm = STATUS_META[b.status];
            return (
            <View key={b.id} style={styles.appCard}>
              <View style={styles.rowTop}>
                <View style={styles.bookingIcon}><Ionicons name="cut" size={18} color={COLORS.brandLight} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cName}>{b.customer?.name}</Text>
                  <Text style={styles.cMeta}>{b.service?.name} · {b.shop?.name}</Text>
                  <Text style={styles.cMeta}>{tanggal(b.booking_date)} · {b.booking_time} WITA</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {sm && (
                    <View style={[styles.badge, { backgroundColor: sm.bg }]}>
                      <Text style={[styles.badgeText, { color: sm.color }]}>{sm.label}</Text>
                    </View>
                  )}
                  {b.fund_state && FUND_STATE_META[b.fund_state] && (
                    <View style={[styles.badge, { backgroundColor: FUND_STATE_META[b.fund_state].bg }]}>
                      <Text style={[styles.badgeText, { color: FUND_STATE_META[b.fund_state].color }]}>{FUND_STATE_META[b.fund_state].label}</Text>
                    </View>
                  )}
                </View>
              </View>
              <PressableScale style={styles.chatBtnWrap} onPress={() => router.push(`/chat/booking/${b.id}` as any)} testID={`booking-chat-${b.id}`} scaleTo={0.96}>
                <LinearGradient colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chatBtn}>
                  <Ionicons name="chatbubbles" size={14} color={COLORS.onBrand} />
                  <Text style={styles.chatBtnText}>CHAT DENGAN PELANGGAN</Text>
                </LinearGradient>
              </PressableScale>
              {b.delivery_mode === "rumah" && b.status === "confirmed" && (
                <PressableScale
                  style={[styles.chatBtnWrap, completingId === b.id && { opacity: 0.6 }]}
                  onPress={() => completeBooking(b.id)}
                  disabled={completingId === b.id}
                  testID={`booking-complete-${b.id}`}
                  scaleTo={0.96}
                >
                  <LinearGradient colors={["#16A34A", "#22C55E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chatBtn}>
                    <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                    <Text style={styles.completeBtnText}>{completingId === b.id ? "..." : "SELESAIKAN PESANAN"}</Text>
                  </LinearGradient>
                </PressableScale>
              )}
            </View>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 0 },
  title: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  appCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  bookingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.5 },
  chatBtnWrap: { borderRadius: 11, marginTop: 10, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 },
  chatBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 10 },
  chatBtnText: { color: COLORS.onBrand, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.4 },
  completeBtnText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.4 },
});
