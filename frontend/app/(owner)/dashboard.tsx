import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import Donut from "@/src/components/Donut";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi,";
  if (h < 15) return "Selamat siang,";
  if (h < 19) return "Selamat sore,";
  return "Selamat malam,";
}

// "Rp540rb" / "Rp2,5jt" ala mockup — format tampilan saja dari angka yang sudah ada.
function formatSingkat(n: number): string {
  const v = n || 0;
  const trimNum = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");
  if (v >= 1e9) return `Rp${trimNum(v / 1e9)}M`;
  if (v >= 1e6) return `Rp${trimNum(v / 1e6)}jt`;
  if (v >= 1e3) return `Rp${trimNum(v / 1e3)}rb`;
  return rupiah(v);
}

function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "-";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Waktu sejak pesanan masuk (m:ss) — dihitung dari created_at yang sudah ada.
function elapsedLabel(createdAt: string | undefined, nowTs: number): string | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (isNaN(t)) return null;
  const s = Math.max(0, Math.floor((nowTs - t) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [inbox, setInbox] = useState<any[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [r, t, w] = await Promise.allSettled([
        api.get("/analytics/owner"),
        api.get("/chat/threads").catch(() => ({ threads: [] })),
        api.get("/wallets/me").catch(() => null),
      ]);
      if (r.status === "fulfilled") {
        setData(r.value);
        if (r.value.shop) {
          setIsOpen(r.value.shop.is_open !== false);
        }
      }
      if (t.status === "fulfilled") setUnread((t.value.threads || []).reduce((a: number, x: any) => a + (x.unread || 0), 0));
      if (w.status === "fulfilled" && w.value) setWallet(w.value.wallet);
    } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);

  // Inbox pesanan masuk (status pending) — endpoint yang sama dipakai (owner)/orders.
  const loadInbox = useCallback(async () => {
    try {
      const r = await api.get("/owner/orders");
      setInbox(((r.orders || []) as any[]).filter((o) => o.status === "pending"));
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); loadInbox(); }, [load, loadInbox]));

  useEffect(() => {
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    const poll = setInterval(loadInbox, 15000);
    return () => { clearInterval(iv); clearInterval(poll); };
  }, [loadInbox]);

  // Sama persis polanya dengan (owner)/orders.tsx: POST langsung + muat ulang.
  const updateOrder = async (id: string, status: string) => {
    try {
      await api.post(`/owner/orders/${id}/status`, { status });
      await loadInbox();
    } catch (e: any) { alert(e.message); }
  };

  const toggleOpen = async (val: boolean) => {
    setIsOpen(val); // optimistic
    setTogglingOpen(true);
    try {
      await api.put("/owner/shop/open-status", { is_open: val });
    } catch (e: any) {
      setIsOpen(!val); // revert on failure
      alert(e.message || "Gagal mengubah status toko");
    }
    setTogglingOpen(false);
  };

  const changeBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { alert("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    setUploadingBanner(true);
    try {
      // Foto asli dari galeri bisa berdimensi sangat besar (bukan cuma ukuran file) —
      // resize dulu ke lebar maks 1080px sebelum di-base64, supaya request tidak gagal
      // di level jaringan sebelum sempat sampai ke backend.
      const resized = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const uri = `data:image/jpeg;base64,${resized.base64}`;
      await api.put("/owner/shop/image", { image: uri });
      setData((prev: any) => (prev ? { ...prev, shop: { ...prev.shop, image: uri } } : prev));
    } catch (e: any) {
      alert(e.message || "Gagal mengubah foto toko");
    }
    setUploadingBanner(false);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.amberHeader}>
        <Skeleton style={{ height: 12, width: 110, backgroundColor: "rgba(15,26,46,0.12)" }} />
        <Skeleton style={{ height: 24, width: 180, marginTop: 8, backgroundColor: "rgba(15,26,46,0.12)" }} />
      </View>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 76 }} />
        <Skeleton style={{ height: 96 }} />
        <Skeleton style={{ height: 96 }} />
      </View>
    </SafeAreaView>
  );

  if (!data?.shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.amberHeader}>
          <Text style={styles.headerEyebrow}>OWNER PANEL</Text>
          <Text style={styles.headerTitle}>Belum ada toko</Text>
        </View>
        <EmptyState
          icon="storefront-outline"
          title="Daftarkan toko dulu"
          description="Klik menu Kelola untuk mendaftarkan toko Anda."
          actionLabel="Kelola Toko"
          onAction={() => router.push("/(owner)/manage" as any)}
        />
      </SafeAreaView>
    );
  }

  const shop = data.shop;
  const today = todayIso();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.amberHeader}>
        <View pointerEvents="none" style={styles.headerDeco} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>{greeting().replace(",", "").toUpperCase()}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
        </View>
        <PressableScale onPress={() => router.push(`/chat/${shop.id}` as any)} style={styles.headerIconBox} scaleTo={0.9} haptic>
          <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.text} />
          {unread > 0 && <View style={styles.hBadge}><Text style={styles.hBadgeText}>{unread}</Text></View>}
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { load(); loadInbox(); }} tintColor={COLORS.brand} />}>
        {/* Status buka/tutup + foto toko */}
        <View style={styles.statusCard}>
          <View>
            {shop.image ? (
              <Image source={{ uri: shop.image }} style={styles.shopPhoto} contentFit="cover" />
            ) : (
              <View style={[styles.shopPhoto, styles.shopPhotoFallback]}>
                <Ionicons name="storefront" size={24} color={COLORS.brandLight} />
              </View>
            )}
            <PressableScale style={styles.photoBadge} onPress={changeBanner} disabled={uploadingBanner} testID="edit-shop-banner" scaleTo={0.9}>
              <Ionicons name={uploadingBanner ? "hourglass-outline" : "camera"} size={12} color={COLORS.onBrand} />
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>{isOpen ? "Toko sedang buka" : "Toko tutup sementara"}</Text>
            <Text style={styles.statusHint}>Perubahan berlaku langsung, tanpa persetujuan admin</Text>
          </View>
          <View style={styles.toggleCol}>
            <Switch
              value={isOpen}
              onValueChange={toggleOpen}
              disabled={togglingOpen}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              thumbColor="#FFFFFF"
              testID="toggle-shop-open"
            />
            <Text style={[styles.toggleLabel, { color: isOpen ? COLORS.success : COLORS.textDim }]}>
              {isOpen ? "Buka" : "Tutup"}
            </Text>
          </View>
        </View>

        {/* Dompet toko */}
        <LinearGradient
          colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View pointerEvents="none" style={styles.walletDeco} />
          <View style={styles.walletTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>Saldo dompet toko</Text>
              <Text style={styles.walletValue}>{rupiah(wallet?.balance_available || 0)}</Text>
            </View>
            <PressableScale style={styles.withdrawBtn} onPress={() => router.push("/(owner)/wallet" as any)} testID="buka-dompet" scaleTo={0.95} haptic>
              <Ionicons name="wallet-outline" size={16} color={COLORS.text} />
              <Text style={styles.withdrawText}>Buka Dompet</Text>
            </PressableScale>
          </View>
          <View style={styles.heldStrip}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.onBrand} />
            <Text style={styles.heldText} numberOfLines={1}>
              {rupiah(wallet?.balance_pending || 0)} masih ditahan sampai pesanan selesai
            </Text>
          </View>
        </LinearGradient>

        {/* 3 stat */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="receipt-outline" size={20} color={COLORS.brandLight} />
            </View>
            <Text style={styles.statValue}>{data.today_appointments}</Text>
            <Text style={styles.statLabel}>Pesanan hari ini</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="trending-up" size={20} color={COLORS.brandLight} />
            </View>
            <Text style={styles.statValue}>{formatSingkat(data.monthly_revenue || 0)}</Text>
            <Text style={styles.statLabel}>Pendapatan</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="star" size={20} color={COLORS.brandLight} />
            </View>
            <Text style={styles.statValue}>{shop.rating?.toFixed(1) || "0.0"}</Text>
            <Text style={styles.statLabel}>Rating toko</Text>
          </View>
        </View>

        {/* Pesanan masuk */}
        {inbox.length > 0 && (
          <View>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>Pesanan masuk</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{inbox.length}</Text></View>
              <View style={{ flex: 1 }} />
              <PressableScale onPress={() => router.push("/(owner)/orders" as any)} testID="goto-orders" scaleTo={0.95}>
                <Text style={styles.seeAll}>Semua</Text>
              </PressableScale>
            </View>
            {inbox.map((o: any) => {
              const elapsed = elapsedLabel(o.created_at, nowTs);
              return (
                <View key={o.id} style={styles.inboxCard} testID={`inbox-order-${o.id}`}>
                  <View style={styles.inboxTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inboxName} numberOfLines={1}>{o.customer?.name || "Pelanggan"}</Text>
                      <Text style={styles.inboxSvc} numberOfLines={1}>{o.service_name} · {o.barber_name}</Text>
                      <Text style={styles.inboxMeta} numberOfLines={1}>
                        {o.booking_date === today ? "Hari ini" : shortDate(o.booking_date)} · {o.booking_time} · {rupiah(o.amount_total_charged ?? o.total_price ?? 0)}
                      </Text>
                    </View>
                    {elapsed && (
                      <View style={styles.timerPill}>
                        <Ionicons name="timer-outline" size={12} color={COLORS.brandLight} />
                        <Text style={styles.timerText}>{elapsed}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.inboxActions}>
                    <PressableScale style={styles.rejectBtn} onPress={() => updateOrder(o.id, "cancelled")} testID={`inbox-reject-${o.id}`} scaleTo={0.97}>
                      <Text style={styles.rejectText}>Tolak</Text>
                    </PressableScale>
                    <PressableScale style={styles.acceptBtn} onPress={() => updateOrder(o.id, "confirmed")} testID={`inbox-accept-${o.id}`} scaleTo={0.97} haptic>
                      <Text style={styles.acceptText}>Terima pesanan</Text>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pintasan jadwal (satu-satunya jalan ke layar Jadwal dari tab) */}
        <PressableScale style={styles.scheduleBtn} onPress={() => router.push("/(owner)/schedule" as any)} testID="goto-schedule" scaleTo={0.97}>
          <View style={styles.scheduleIcon}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.brandLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleBtnText}>Atur Jadwal Buka Toko</Text>
            <Text style={styles.scheduleBtnSub}>Jam mingguan & pengecualian tanggal</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
        </PressableScale>

        {/* Analitik lanjutan (dipertahankan dari dasbor lama) */}
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Retention 90 Hari</Text>
              <Text style={styles.metricValue}>{data.retention_pct}%</Text>
            </View>
            <View style={styles.metricIcon}><Ionicons name="people" size={22} color={COLORS.success} /></View>
          </View>
          <View style={styles.hBar}><View style={[styles.hFill, { width: `${data.retention_pct}%`, backgroundColor: COLORS.success }]} /></View>
          <Text style={styles.metricHint}>Pelanggan kembali booking dalam 90 hari</Text>

          <View style={[styles.metricRow, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Productivity 90 Hari</Text>
              <Text style={styles.metricValue}>{data.productivity_pct}%</Text>
            </View>
            <View style={styles.metricIcon}><Ionicons name="trending-up" size={22} color={COLORS.brandLight} /></View>
          </View>
          <View style={styles.hBar}><View style={[styles.hFill, { width: `${data.productivity_pct}%`, backgroundColor: COLORS.brand }]} /></View>
          <Text style={styles.metricHint}>Rasio slot terisi vs slot tersedia</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Layanan Terpopuler</Text>
          <View style={{ marginTop: 8 }}>
            <Donut data={data.popular_services} centerLabel="Booking" centerValue={data.popular_services.reduce((a: number, b: any) => a + b.count, 0)} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  amberHeader: {
    backgroundColor: COLORS.brand, borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, overflow: "hidden",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  headerDeco: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.18)", top: -70, right: -40 },
  headerEyebrow: { color: "rgba(15,26,46,0.6)", fontSize: 11, fontFamily: FONT.bold, letterSpacing: 2 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginTop: 2 },
  headerIconBox: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFFD9", alignItems: "center", justifyContent: "center",
  },

  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface,
    padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  shopPhoto: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.surface2 },
  shopPhotoFallback: { alignItems: "center", justifyContent: "center" },
  photoBadge: {
    position: "absolute", right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.surface,
  },
  statusLabel: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  statusHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 3, lineHeight: 15 },
  hBadge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.bg },
  hBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold },
  toggleCol: { alignItems: "center", gap: 2 },
  toggleLabel: { fontFamily: FONT.bold, fontSize: 11 },

  walletCard: {
    padding: 20, borderRadius: 24, overflow: "hidden",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 22, elevation: 8,
  },
  walletDeco: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.22)", top: -60, right: -40 },
  walletTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletLabel: { color: "rgba(15,26,46,0.65)", fontFamily: FONT.medium, fontSize: 13 },
  walletValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 32, marginTop: 4, letterSpacing: -0.5 },
  withdrawBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFFFFD9",
    paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14,
  },
  withdrawText: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  heldStrip: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16,
    backgroundColor: "rgba(15,26,46,0.06)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
  },
  heldText: { color: "rgba(15,26,46,0.7)", fontFamily: FONT.medium, fontSize: 12, flex: 1 },

  statRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  statIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  statValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 19, marginTop: 10 },
  statLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },

  secHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 12 },
  secTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 19 },
  countBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 13 },
  seeAll: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 14 },

  inboxCard: {
    backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    padding: 16, marginBottom: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  inboxTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  inboxName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  inboxSvc: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, marginTop: 2 },
  inboxMeta: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 3 },
  timerPill: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brandDim,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, flexShrink: 0,
  },
  timerText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12 },
  inboxActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  rejectBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: "center",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface2,
  },
  rejectText: { color: COLORS.textMuted, fontFamily: FONT.bold, fontSize: 14 },
  acceptBtn: {
    flex: 1.2, paddingVertical: 13, borderRadius: 14, alignItems: "center", backgroundColor: COLORS.brand,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  acceptText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 14 },

  scheduleBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  scheduleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  scheduleBtnText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  scheduleBtnSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },

  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 8 },
  metricRow: { flexDirection: "row", alignItems: "center" },
  metricIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  metricLabel: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  metricValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 22, marginTop: 2 },
  hBar: { height: 8, backgroundColor: COLORS.surface2, borderRadius: 999, marginTop: 8, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 999 },
  metricHint: { color: COLORS.textDim, fontSize: 11, marginTop: 6, fontFamily: FONT.medium },
});
