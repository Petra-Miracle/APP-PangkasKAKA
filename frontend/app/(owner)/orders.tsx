import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Modal, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah, tanggal } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "Menunggu" },
  confirmed: { color: COLORS.success, bg: "#ECFDF5", label: "Terkonfirmasi" },
  completed: { color: COLORS.info, bg: "#F0F9FF", label: "Selesai" },
  cancelled: { color: COLORS.error, bg: "#FEF2F2", label: "Dibatalkan" },
};

export default function OwnerOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/owner/orders"); setOrders(r.orders); } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = async (id: string, status: string) => {
    try {
      await api.post(`/owner/orders/${id}/status`, { status });
      await load();
      setDetail(null);
    } catch (e: any) { alert(e.message); }
  };

  const callCustomer = async (phone?: string) => {
    if (!phone) { Alert.alert("Telepon", "Nomor pelanggan tidak tersedia"); return; }
    const url = `tel:${phone.replace(/[^\d+]/g, "")}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else Alert.alert("Telepon", `Nomor: ${phone}`);
    } catch {
      Alert.alert("Telepon", `Nomor: ${phone}`);
    }
  };

  const chatCustomer = (order: any) => {
    setDetail(null);
    router.push(`/chat/owner/${order.id}` as any);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 22, width: 180, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 12, width: 100, marginTop: 8, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 130 }} />
        <Skeleton style={{ height: 130 }} />
        <Skeleton style={{ height: 130 }} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navyHeader}
      >
        <View pointerEvents="none" style={styles.headerDeco} />
        <Text style={styles.headerTitle}>Pesanan Masuk</Text>
        <Text style={styles.headerSub}>{orders.length} pesanan total</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}>
        {orders.length === 0 && (
          <EmptyState
            icon="receipt-outline"
            title="Belum ada pesanan"
            description="Pesanan baru dari pelanggan akan muncul di sini."
          />
        )}
        {orders.map((o) => {
          const meta = STATUS_META[o.status] || STATUS_META.pending;
          return (
            <PressableScale key={o.id} style={styles.card} testID={`o-order-${o.id}`} onPress={() => setDetail(o)} scaleTo={0.98}>
              <View style={styles.rowTop}>
                {o.customer?.photo ? (
                  <Image source={{ uri: o.customer.photo }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatar}><Ionicons name="person" size={20} color={COLORS.brand} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cust}>{o.customer?.name}</Text>
                  <Text style={styles.phone}>{o.customer?.phone}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <View style={styles.det}>
                <View style={styles.detRow}><Ionicons name="cut" size={13} color={COLORS.textDim} /><Text style={styles.detText}>{o.service_name} · {o.barber_name}</Text></View>
                <View style={styles.detRow}><Ionicons name="calendar" size={13} color={COLORS.textDim} /><Text style={styles.detText}>{tanggal(o.booking_date)} · {o.booking_time} WITA</Text></View>
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.price}>{rupiah(o.total_price)}</Text>
                <View style={styles.tapHint}>
                  <Text style={styles.tapHintText}>Detail</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.brand} />
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Detail Pelanggan Modal */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.mHeader}>
                {detail?.customer?.photo ? (
                  <Image source={{ uri: detail.customer.photo }} style={styles.mAvatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.mAvatarFallback}><Text style={styles.mInitial}>{detail?.customer?.name?.[0] || "?"}</Text></View>
                )}
                <Text style={styles.mName}>{detail?.customer?.name}</Text>
                <Text style={styles.mEmail}>{detail?.customer?.email || "-"}</Text>
                {detail?.status && (
                  <View style={[styles.mBadge, { backgroundColor: STATUS_META[detail.status]?.bg }]}>
                    <Text style={[styles.mBadgeText, { color: STATUS_META[detail.status]?.color }]}>{STATUS_META[detail.status]?.label}</Text>
                  </View>
                )}
              </View>

              <View style={styles.mSection}>
                <Text style={styles.mSectionTitle}>DETAIL PEMESANAN</Text>
                <MRow icon="cut" label="Layanan" value={detail?.service_name} />
                <MRow icon="time" label="Durasi" value={`${detail?.service_duration || 0} menit`} />
                <MRow icon="person" label="Barber" value={detail?.barber_name} />
                <MRow icon="calendar" label="Tanggal" value={tanggal(detail?.booking_date || "")} />
                <MRow icon="alarm" label="Jam" value={`${detail?.booking_time} WITA`} />
                <MRow icon="call-outline" label="Telepon" value={detail?.customer?.phone || "-"} />
                {detail?.customer?.address ? <MRow icon="location" label="Alamat" value={detail.customer.address} /> : null}
              </View>

              <LinearGradient
                colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mTotalCard}
              >
                <Text style={styles.mTotalLabel}>Total Pembayaran</Text>
                <Text style={styles.mTotalValue}>{rupiah(detail?.total_price || 0)}</Text>
              </LinearGradient>

              {/* Contact actions */}
              <View style={styles.contactRow}>
                <PressableScale style={styles.contactBtn} onPress={() => callCustomer(detail?.customer?.phone)} testID="btn-telepon" scaleTo={0.96} haptic>
                  <LinearGradient
                    colors={["#16A34A", "#22C55E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.contactBtnGrad}
                  >
                    <Ionicons name="call" size={20} color="#FFFFFF" />
                    <Text style={styles.contactBtnText}>Telepon</Text>
                  </LinearGradient>
                </PressableScale>
                <PressableScale style={styles.contactBtn} onPress={() => chatCustomer(detail)} testID="btn-chat" scaleTo={0.96} haptic>
                  <LinearGradient
                    colors={["#0284C7", COLORS.info]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.contactBtnGrad}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                    <Text style={styles.contactBtnText}>Chat</Text>
                  </LinearGradient>
                </PressableScale>
              </View>

              {/* Status actions */}
              {detail?.status === "pending" && (
                <View style={styles.actRow}>
                  <PressableScale style={styles.btnPriFullWrap} onPress={() => update(detail.id, "confirmed")} testID="btn-confirm" haptic>
                    <LinearGradient
                      colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.btnPriFull}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.btnPriFullText}>KONFIRMASI PESANAN</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale style={styles.btnSecFull} onPress={() => update(detail.id, "cancelled")} scaleTo={0.97}>
                    <Text style={styles.btnSecFullText}>BATALKAN</Text>
                  </PressableScale>
                </View>
              )}
              {detail?.status === "confirmed" && (
                <View style={styles.actRow}>
                  <PressableScale style={styles.btnPriFullWrap} onPress={() => update(detail.id, "completed")} testID="btn-complete" haptic>
                    <LinearGradient
                      colors={["#16A34A", "#22C55E"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.btnPriFull}
                    >
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.btnPriFullText}>SELESAIKAN</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale style={styles.btnSecFull} onPress={() => update(detail.id, "cancelled")} scaleTo={0.97}>
                    <Text style={styles.btnSecFullText}>BATALKAN</Text>
                  </PressableScale>
                </View>
              )}
            </ScrollView>
            <PressableScale style={styles.closeBtn} onPress={() => setDetail(null)} scaleTo={0.97}>
              <Text style={styles.closeText}>Tutup</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.mRow}>
      <View style={styles.mIco}><Ionicons name={icon} size={14} color={COLORS.brand} /></View>
      <Text style={styles.mLabel}>{label}</Text>
      <Text style={styles.mVal} numberOfLines={2}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -30 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.brandDim },
  cust: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  phone: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  det: { marginTop: 12, gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  detRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  price: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18 },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tapHintText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },

  // Modal
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 10 },
  mHeader: { alignItems: "center", paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mAvatarImg: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: COLORS.brandDim },
  mAvatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.brandDim },
  mInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 32 },
  mName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 20, marginTop: 12 },
  mEmail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  mBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  mBadgeText: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.3 },

  mSection: { marginTop: 18 },
  mSectionTitle: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  mRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  mIco: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  mLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13, width: 90 },
  mVal: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13, flex: 1, textAlign: "right" },

  mTotalCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 16, marginTop: 16,
    shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 5,
  },
  mTotalLabel: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.semibold, fontSize: 13 },
  mTotalValue: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 22 },

  contactRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  contactBtn: { flex: 1, borderRadius: 14, overflow: "hidden", shadowColor: "#16A34A", shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  contactBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14 },
  contactBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 13, letterSpacing: 0.5 },

  actRow: { gap: 10, marginTop: 16 },
  btnPriFullWrap: { borderRadius: 14, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btnPriFull: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  btnPriFullText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 13, letterSpacing: 0.8 },
  btnSecFull: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.error, alignItems: "center", backgroundColor: "#FEF2F2" },
  btnSecFullText: { color: COLORS.error, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.8 },

  closeBtn: { alignItems: "center", padding: 12, marginTop: 4 },
  closeText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
});