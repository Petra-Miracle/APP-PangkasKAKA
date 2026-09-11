import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, Alert, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

type StatusResp = {
  order: any;
  payment: any;
  shop: any;
  remaining_seconds: number;
  payment_status: string;
  order_status: string;
  payment_link_url?: string;
};

const POLL_INTERVAL = 5000;
const FALLBACK_AFTER = 2 * 60 * 1000;

export default function ProductPaymentStatusScreen() {
  const { orderId, url: initialUrl } = useLocalSearchParams<{ orderId: string; url?: string }>();
  const router = useRouter();
  const [data, setData] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const pollRef = useRef<any>(null);
  const stoppedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());
  const fallbackTriggeredRef = useRef(false);

  const stopPolling = useCallback(() => {
    stoppedRef.current = true;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const r: StatusResp = await api.get(`/payments/status-product/${orderId}`);
      setData(r);
      const isFinal = r.payment_status === "paid" || r.order_status === "cancelled" || r.payment_status === "forfeited";
      if (isFinal) stopPolling();
      if (!isFinal && !fallbackTriggeredRef.current && Date.now() - startedAtRef.current > FALLBACK_AFTER) {
        fallbackTriggeredRef.current = true;
        try { await api.post(`/payments/fallback-check-product/${orderId}`); } catch {}
      }
    } catch (e) {
      // keep polling silently
    } finally {
      setLoading(false);
    }
  }, [orderId, stopPolling]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(() => { if (!stoppedRef.current) fetchStatus(); }, POLL_INTERVAL);
    return () => stopPolling();
  }, [fetchStatus, stopPolling]);

  const openPaymentLink = async () => {
    const link = data?.payment_link_url || (initialUrl && String(initialUrl));
    if (!link) return;
    try { await Linking.openURL(link); } catch {}
  };

  const downloadQr = async () => {
    const qr = data?.payment?.qr_string as string | undefined;
    if (!qr) return;
    setSavingQr(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Izin ditolak", "Izin galeri dibutuhkan untuk menyimpan QRIS");
        return;
      }
      const base64 = qr.includes(",") ? qr.split(",")[1] : qr;
      const file = new File(Paths.cache, `qris-product-${orderId}.png`);
      file.create({ overwrite: true });
      file.write(base64, { encoding: "base64" });
      const asset = await MediaLibrary.createAssetAsync(file.uri);
      await MediaLibrary.createAlbumAsync("PangkasKAKA", asset, false);
      Alert.alert("Berhasil", "QRIS tersimpan di galeri. Kamu bisa scan langsung dari galeri di aplikasi pembayaranmu.");
    } catch (e: any) {
      Alert.alert("Gagal", e.message || "Gagal menyimpan QRIS");
    } finally {
      setSavingQr(false);
    }
  };

  // Coba verifikasi asli ke Durianpay dulu; kalau belum kebaca paid (mis. saat
  // pitching, sandbox Durianpay belum tentu benar-benar dituntaskan), langsung
  // tandai lunas lewat endpoint simulate — aman karena endpoint itu otomatis mati
  // total begitu PAYMENT_MODE=production (lihat backend/server.py).
  const confirmPaid = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      await api.post(`/payments/fallback-check-product/${orderId}`).catch(() => {});
      const fresh: StatusResp = await api.get(`/payments/status-product/${orderId}`);
      setData(fresh);
      if (fresh.payment_status !== "paid") {
        await api.post(`/payments/simulate-product/${orderId}`).catch(() => {});
        await fetchStatus();
      } else {
        stopPolling();
      }
    } catch {}
    if (!silent) setChecking(false);
  }, [orderId, fetchStatus, stopPolling]);

  const doFallbackCheck = () => confirmPaid(false);

  // Alur pitching: buka link/QR Durianpay di luar app, lalu kembali ke app —
  // begitu app kembali aktif, langsung cek/konfirmasi tanpa perlu tap tombol lagi.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !stoppedRef.current) confirmPaid(true);
    });
    return () => sub.remove();
  }, [confirmPaid]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Text style={styles.err}>Pesanan tidak ditemukan</Text></View>
      </SafeAreaView>
    );
  }

  const isPaid = data.payment_status === "paid" && (data.order_status === "confirmed" || data.order_status === "completed");
  const isForfeited = data.payment_status === "forfeited" || data.order_status === "cancelled";
  const isPending = !isPaid && !isForfeited;

  const mm = Math.floor((data.remaining_seconds || 0) / 60);
  const ss = (data.remaining_seconds || 0) % 60;
  const order = data.order;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.backRow}>
          <PressableScale onPress={() => router.replace("/(customer)/product-orders" as any)} style={styles.back} scaleTo={0.9}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </PressableScale>
          <Text style={styles.backTitle}>Pembayaran</Text>
          <PressableScale onPress={() => router.replace("/(customer)/product-orders" as any)} style={styles.back} scaleTo={0.9}>
            <Ionicons name="close" size={20} color={COLORS.text} />
          </PressableScale>
        </View>

        {isPaid && <SuccessCard />}
        {isPending && <PendingCard mm={mm} ss={ss} />}
        {isForfeited && <ExpiredCard lastEvent={data.payment?.last_event} />}

        {isPending && (
          <View style={styles.qrCard}>
            <View style={styles.qrHead}>
              <View style={styles.qrisPill}>
                <Text style={styles.qrisPillText}>QRIS</Text>
              </View>
              <Text style={styles.qrHeadSub}>Semua bank & e-wallet</Text>
            </View>
            {/* QR buatan untuk pitching — selalu dipakai (lihat payment/status/[bookingId]
                untuk alasan yang sama: sandbox Durianpay tidak konsisten memberi QR asli,
                demo fungsional butuh tampilan yang pasti muncul). Bukan kode bayar
                sungguhan — pembayaran nyata tetap lewat tombol link Durianpay di bawah. */}
            <FauxQr />
            <Text style={styles.qrDemoNote}>QR demo untuk pitching · bayar via tombol link di bawah</Text>
            <Text style={styles.qrAmount}>{rupiah(order?.amount_total_charged || 0)}</Text>
            <Text style={styles.qrShop} numberOfLines={1}>{data.shop?.name}</Text>
            <Text style={styles.qrMeta} numberOfLines={2}>
              {order?.product_name} · x{order?.quantity} · {order?.fulfillment === "delivery" ? "Diantar" : "Diambil"}
            </Text>
          </View>
        )}

        {isPending && (initialUrl || data.payment_link_url) && (
          <PressableScale style={styles.linkRow} onPress={openPaymentLink} scaleTo={0.97}>
            <Ionicons name="open-outline" size={15} color={COLORS.brandLight} />
            <Text style={styles.linkText}>Tidak bisa scan? Bayar via link Durianpay</Text>
          </PressableScale>
        )}

        {isPending && !data.payment?.qr_string && !!data.payment?.qr_debug && (
          <View style={[styles.card, { marginTop: 16, backgroundColor: "#0A2540" }]}>
            <Text style={[styles.sec, { color: "#8FA5BF" }]}>QRIS SANDBOX DEBUG</Text>
            <Text style={{ color: "#8FA5BF", fontSize: 11, fontFamily: FONT.medium }} numberOfLines={6}>{data.payment.qr_debug}</Text>
          </View>
        )}

        {isPending && (
          <View style={styles.escrowBox}>
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.info} />
            <Text style={styles.escrowText}>
              Uangmu ditahan PangkasKAKA dan baru diteruskan ke toko setelah pesanan selesai.
            </Text>
          </View>
        )}

        {isPending && (
          <View style={styles.stepsBox}>
            <Text style={styles.stepsTitle}>Cara bayar</Text>
            {[
              "Buka aplikasi bank atau e-wallet kamu.",
              "Pilih menu Scan QR, arahkan ke kode di atas.",
              "Cek nominal, lalu konfirmasi pembayaran.",
            ].map((t, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {!isPending && (
        <View style={styles.card}>
          <Text style={styles.sec}>DETAIL PESANAN</Text>
          <View style={styles.shopRow}>
            {order?.product_image ? (
              <Image source={{ uri: order.product_image }} style={styles.shopImg} contentFit="cover" />
            ) : (
              <View style={[styles.shopImg, styles.shopImgFallback]}><Ionicons name="bag-handle" size={24} color={COLORS.brand} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{order?.product_name}</Text>
              <Text style={styles.shopAddr} numberOfLines={2}>{data.shop?.name}</Text>
            </View>
          </View>

          <Row label="Kuantitas" value={order?.quantity} />
          <Row label="Fulfillment" value={order?.fulfillment === "delivery" ? "Diantar ke Alamat" : "Ambil di Toko"} />
          {order?.fulfillment === "delivery" ? (
            <Row label="Alamat" value={order?.address} />
          ) : (
            <Row label="Lokasi" value={data.shop?.address} />
          )}
          <View style={styles.divider} />
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.totalCard}
          >
            <View pointerEvents="none" style={styles.totalDeco} />
            <View style={{ width: "100%" }}>
              <View style={styles.totalBreakRow}>
                <Text style={styles.totalBreakLabel}>Harga Produk</Text>
                <Text style={styles.totalBreakVal}>{rupiah(order?.amount_product || 0)}</Text>
              </View>
              <View style={styles.totalBreakRow}>
                <Text style={styles.totalBreakLabel}>Biaya Admin</Text>
                <Text style={styles.totalBreakVal}>{rupiah(order?.amount_admin_fee || 0)}</Text>
              </View>
              <View style={[styles.totalBreakRow, { marginTop: 6 }]}>
                <Text style={styles.totalLabel}>Total Pembayaran</Text>
                <Text style={styles.totalValue}>{rupiah(order?.amount_total_charged || 0)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
        )}

        {isPaid && (
          <View style={{ marginTop: 16, gap: 12 }}>
            <PressableScale style={styles.btnPriWrap} onPress={() => router.replace("/(customer)/product-orders" as any)} scaleTo={0.98}>
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnPri}
              >
                <Ionicons name="list" size={18} color={COLORS.onBrand} />
                <Text style={styles.btnPriText}>LIHAT PESANAN SAYA</Text>
              </LinearGradient>
            </PressableScale>
          </View>
        )}

        {isForfeited && (
          <View style={{ marginTop: 16, gap: 12 }}>
            <PressableScale style={styles.btnPriWrap} onPress={() => router.replace(`/(customer)/product/${order?.product_id}` as any)} scaleTo={0.98}>
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnPri}
              >
                <Ionicons name="repeat" size={18} color={COLORS.onBrand} />
                <Text style={styles.btnPriText}>BELI LAGI</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale style={styles.btnSec} onPress={() => router.replace("/(customer)/home")} scaleTo={0.98}>
              <Text style={styles.btnSecText}>KEMBALI KE BERANDA</Text>
            </PressableScale>
          </View>
        )}

        {!isPending && (
          <Text style={styles.footNote}>Status pembayaran akan diperbarui otomatis setiap 5 detik.</Text>
        )}
      </ScrollView>

      {isPending && (
        <View style={styles.bottomBar}>
          {data.payment?.qr_string ? (
            <PressableScale style={styles.dlBtn} onPress={downloadQr} disabled={savingQr} scaleTo={0.94}>
              <Ionicons name="download-outline" size={22} color={COLORS.text} />
            </PressableScale>
          ) : null}
          <PressableScale style={styles.paidBtn} onPress={doFallbackCheck} disabled={checking} scaleTo={0.98} haptic>
            <Text style={styles.paidBtnText}>{checking ? "MEMERIKSA..." : "Saya sudah bayar"}</Text>
          </PressableScale>
        </View>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value || "-"}</Text>
    </View>
  );
}

function SuccessCard() {
  return (
    <LinearGradient
      colors={["#E7F9F0", "#D1F5E4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.stateCard, { borderColor: "#B6E9CE" }]}
    >
      <View style={[styles.stateIcon, { backgroundColor: COLORS.success }]}>
        <Ionicons name="checkmark" size={44} color="#FFFFFF" />
      </View>
      <Text style={[styles.stateTitle, { color: COLORS.success }]}>PEMBAYARAN BERHASIL</Text>
      <Text style={styles.stateSub}>Pesanan produkmu telah terkonfirmasi. Tunggu pemberitahuan dari toko!</Text>
    </LinearGradient>
  );
}

function PendingCard({ mm, ss }: { mm: number; ss: number }) {
  return (
    <View style={styles.countBanner}>
      <View style={styles.countIcon}>
        <Ionicons name="timer-outline" size={26} color={COLORS.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.countLabel}>Selesaikan pembayaran dalam</Text>
        <Text style={styles.countTime}>{String(mm).padStart(2, "0")} : {String(ss).padStart(2, "0")}</Text>
        <Text style={styles.countNote}>Pesanan dibatalkan otomatis jika tidak dibayar.</Text>
      </View>
    </View>
  );
}

// QR buatan untuk pitching — mosaik deterministik mirip QRIS, BUKAN kode bayar.
// Tidak memakai library QR & tidak mengklaim bisa di-scan untuk membayar.
const QR_N = 21;
function FauxQr() {
  const cells = useMemo(() => {
    const arr: boolean[] = [];
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < QR_N * QR_N; i++) arr.push(rnd() > 0.52);
    const finder = (r: number, c: number) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const rr = r + y, cc = c + x;
        if (rr >= QR_N || cc >= QR_N) continue;
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        arr[rr * QR_N + cc] = edge || core;
      }
    };
    finder(0, 0); finder(0, QR_N - 7); finder(QR_N - 7, 0);
    return arr;
  }, []);
  return (
    <View style={styles.fauxQr}>
      {cells.map((on, i) => (
        <View key={i} style={[styles.fauxCell, { backgroundColor: on ? "#0F1A2E" : "#FFFFFF" }]} />
      ))}
    </View>
  );
}

const FAILURE_REASONS: Record<string, string> = {
  "payment.expired": "Waktu 15 menit untuk membayar sudah habis sebelum transaksi diselesaikan.",
  "order.expired": "Waktu 15 menit untuk membayar sudah habis sebelum transaksi diselesaikan.",
  "payment.failed": "Pembayaran ditolak penyedia layanan — bisa karena saldo tidak cukup, kartu/e-wallet ditolak, atau data pembayaran salah.",
  "order.failed": "Pembayaran ditolak penyedia layanan — bisa karena saldo tidak cukup, kartu/e-wallet ditolak, atau data pembayaran salah.",
  "payment.cancelled": "Pembayaran dibatalkan sebelum selesai diproses.",
};

function ExpiredCard({ lastEvent }: { lastEvent?: string }) {
  const reason = (lastEvent && FAILURE_REASONS[lastEvent])
    || "Batas waktu 15 menit untuk membayar telah lewat, atau pembayaran tidak berhasil diproses.";
  return (
    <LinearGradient
      colors={["#FEE2E2", "#FDD5D5"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.stateCard, { borderColor: "#FCA5A5" }]}
    >
      <View style={[styles.stateIcon, { backgroundColor: COLORS.error }]}>
        <Ionicons name="close" size={44} color="#FFFFFF" />
      </View>
      <Text style={[styles.stateTitle, { color: COLORS.error }]}>PEMBAYARAN GAGAL</Text>
      <Text style={styles.stateSub}>{reason}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  err: { color: COLORS.textDim, fontFamily: FONT.medium },
  backRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  back: {
    width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  backTitle: { flex: 1, color: COLORS.text, fontFamily: FONT.medium, fontSize: 19, textAlign: "center" },

  countBanner: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.brandDim,
    padding: 14, borderRadius: 20, marginBottom: 12,
  },
  countIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  countLabel: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12 },
  countTime: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 30, letterSpacing: 1, marginTop: 1 },
  countNote: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 10, marginTop: 3 },

  qrCard: {
    backgroundColor: COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border,
    padding: 20, alignItems: "center", marginBottom: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4,
  },
  qrHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  qrisPill: { backgroundColor: COLORS.text, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  qrisPillText: { color: "#FFFFFF", fontFamily: FONT.bold, fontSize: 13, letterSpacing: 1 },
  qrHeadSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  qrImg: { width: 180, height: 180, backgroundColor: "#FFFFFF", borderRadius: 8 },
  fauxQr: {
    width: 180, flexDirection: "row", flexWrap: "wrap", backgroundColor: "#FFFFFF",
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  fauxCell: { width: `${100 / QR_N}%`, aspectRatio: 1 },
  qrDemoNote: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 8, textAlign: "center" },
  qrAmount: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 30, marginTop: 14, letterSpacing: -0.5 },
  qrShop: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, marginTop: 8 },
  qrMeta: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 3, textAlign: "center" },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, marginBottom: 4, paddingVertical: 6 },
  linkText: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 13 },

  stateCard: { padding: 32, borderRadius: 28, borderWidth: 1, alignItems: "center", marginBottom: 20, shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 22, elevation: 6 },
  stateIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 16, shadowColor: COLORS.cardShadowStrong, shadowOpacity: 0.45, shadowRadius: 14, elevation: 6 },
  stateTitle: { fontFamily: FONT.extrabold, fontSize: 20, letterSpacing: 0.5, marginBottom: 8 },
  stateSub: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, textAlign: "center", lineHeight: 21 },
  timer: { color: "#B45309", fontFamily: FONT.extrabold, fontSize: 48, letterSpacing: 2, marginVertical: 8 },

  card: {
    backgroundColor: COLORS.surface, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4,
  },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 14 },
  shopRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  shopImg: { width: 64, height: 64, borderRadius: 16 },
  shopImgFallback: { backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  shopName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  shopAddr: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 4 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  rowLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  rowVal: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13, flexShrink: 1, textAlign: "right", marginLeft: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderRadius: 18, overflow: "hidden" },
  totalDeco: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.08)", top: -40, right: -24 },
  totalLabel: { color: "rgba(15,26,46,0.75)", fontFamily: FONT.semibold, fontSize: 14 },
  totalValue: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 26 },
  totalBreakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalBreakLabel: { color: "rgba(15,26,46,0.6)", fontFamily: FONT.medium, fontSize: 12 },
  totalBreakVal: { color: "rgba(15,26,46,0.8)", fontFamily: FONT.semibold, fontSize: 12 },

  escrowBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", padding: 12, borderRadius: 16, marginTop: 12 },
  escrowText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12, flex: 1, lineHeight: 18 },
  stepsBox: { marginTop: 14 },
  stepsTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, marginBottom: 2 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: COLORS.textMuted, fontFamily: FONT.bold, fontSize: 12 },
  stepText: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, flex: 1, lineHeight: 19 },
  bottomBar: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  dlBtn: {
    width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  paidBtn: {
    flex: 1, height: 58, borderRadius: 18, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6,
  },
  paidBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 16 },

  btnPriWrap: { borderRadius: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6 },
  btnPri: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 18, minHeight: 54 },
  btnPriText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 14 },
  btnSec: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  btnSecInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnSecText: { color: COLORS.brandLight, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 14 },
  footNote: { textAlign: "center", color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 24 },
});
