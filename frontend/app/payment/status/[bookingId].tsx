import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";

type StatusResp = {
  booking: any;
  payment: any;
  shop: any;
  service: any;
  barber: any;
  remaining_seconds: number;
  payment_status: string;
  booking_status: string;
  payment_link_url?: string;
};

const POLL_INTERVAL = 5000; // 5 detik
const FALLBACK_AFTER = 2 * 60 * 1000; // 2 menit

export default function PaymentStatusScreen() {
  const { bookingId, url: initialUrl } = useLocalSearchParams<{ bookingId: string; url?: string }>();
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
      const r: StatusResp = await api.get(`/payments/status/${bookingId}`);
      setData(r);
      const isFinal = r.payment_status === "paid" || r.booking_status === "cancelled" || r.payment_status === "forfeited";
      if (isFinal) stopPolling();
      // Trigger fallback check bila > 2 menit belum paid
      if (!isFinal && !fallbackTriggeredRef.current && Date.now() - startedAtRef.current > FALLBACK_AFTER) {
        fallbackTriggeredRef.current = true;
        try { await api.post(`/payments/fallback-check/${bookingId}`); } catch {}
      }
    } catch (e) {
      // keep polling silently
    } finally {
      setLoading(false);
    }
  }, [bookingId, stopPolling]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(() => { if (!stoppedRef.current) fetchStatus(); }, POLL_INTERVAL);
    return () => stopPolling();
  }, [fetchStatus, stopPolling]);

  const openPaymentLink = async () => {
    // Prefer the freshly-polled link over the one captured at navigation time -
    // the stored link can change server-side (host/config fixes, regeneration)
    // after this screen was first opened.
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
      const file = new File(Paths.cache, `qris-${bookingId}.png`);
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

  const doFallbackCheck = async () => {
    setChecking(true);
    try {
      await api.post(`/payments/fallback-check/${bookingId}`);
      await fetchStatus();
    } catch {}
    setChecking(false);
  };

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

  const isPaid = data.payment_status === "paid" && data.booking_status === "confirmed";
  const isForfeited = data.payment_status === "forfeited" || data.booking_status === "cancelled";
  const isPending = !isPaid && !isForfeited;

  const mm = Math.floor((data.remaining_seconds || 0) / 60);
  const ss = (data.remaining_seconds || 0) % 60;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Pressable onPress={() => router.replace("/(customer)/orders")} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>

        {isPaid && <SuccessCard />}
        {isPending && <PendingCard mm={mm} ss={ss} />}
        {isForfeited && <ExpiredCard />}

        <View style={styles.card}>
          <Text style={styles.sec}>DETAIL BOOKING</Text>
          <View style={styles.shopRow}>
            {data.shop?.image ? (
              <Image source={{ uri: data.shop.image }} style={styles.shopImg} contentFit="cover" />
            ) : <View style={[styles.shopImg, { backgroundColor: COLORS.brandDim }]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{data.shop?.name}</Text>
              <Text style={styles.shopAddr} numberOfLines={2}>{data.shop?.address}</Text>
            </View>
          </View>

          <Row label="Layanan" value={data.service?.name} />
          <Row label="Barber" value={data.barber?.name} />
          <Row label="Tanggal" value={data.booking?.booking_date} />
          <Row label="Jam" value={`${data.booking?.booking_time} WITA`} />
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{rupiah(data.booking?.total_price || 0)}</Text>
          </View>
        </View>

        {isPending && !!data.payment?.qr_string && (
          <View style={[styles.card, { alignItems: "center", marginTop: 16 }]}>
            <Text style={styles.sec}>SCAN QRIS UNTUK BAYAR</Text>
            <Image source={{ uri: data.payment.qr_string }} style={styles.qrImg} contentFit="contain" />
            <Pressable style={styles.btnSec} onPress={downloadQr} disabled={savingQr}>
              <Ionicons name="download-outline" size={18} color={COLORS.brand} />
              <Text style={styles.btnSecText}>{savingQr ? "MENYIMPAN..." : "SIMPAN QRIS KE GALERI"}</Text>
            </Pressable>
          </View>
        )}

        {isPending && !data.payment?.qr_string && !!data.payment?.qr_debug && (
          <View style={[styles.card, { marginTop: 16, backgroundColor: "#0A2540" }]}>
            <Text style={[styles.sec, { color: "#8FA5BF" }]}>QRIS SANDBOX DEBUG</Text>
            <Text style={{ color: "#8FA5BF", fontSize: 11, fontFamily: FONT.medium }} numberOfLines={6}>{data.payment.qr_debug}</Text>
          </View>
        )}

        {isPending && (
          <View style={{ gap: 12, marginTop: 16 }}>
            {(initialUrl || data.payment_link_url) && (
              <Pressable style={data.payment?.qr_string ? styles.btnSec : styles.btnPri} onPress={openPaymentLink}>
                <Ionicons name="open-outline" size={18} color={data.payment?.qr_string ? COLORS.brand : "#FFFFFF"} />
                <Text style={data.payment?.qr_string ? styles.btnSecText : styles.btnPriText}>
                  {data.payment?.qr_string ? "METODE PEMBAYARAN LAIN" : "BUKA LINK PEMBAYARAN"}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.btnSec} onPress={doFallbackCheck} disabled={checking}>
              <Ionicons name="refresh" size={18} color={COLORS.brand} />
              <Text style={styles.btnSecText}>{checking ? "MEMERIKSA..." : "PERIKSA STATUS SEKARANG"}</Text>
            </Pressable>
          </View>
        )}

        {isPaid && (
          <View style={{ marginTop: 16 }}>
            <Pressable style={styles.btnPri} onPress={() => router.replace("/(customer)/orders")}>
              <Ionicons name="list" size={18} color="#FFFFFF" />
              <Text style={styles.btnPriText}>LIHAT PESANAN SAYA</Text>
            </Pressable>
          </View>
        )}

        {isForfeited && (
          <View style={{ marginTop: 16, gap: 12 }}>
            <Pressable style={styles.btnPri} onPress={() => router.replace(`/(customer)/shop/${data.booking?.shop_id}`)}>
              <Ionicons name="repeat" size={18} color="#FFFFFF" />
              <Text style={styles.btnPriText}>BOOKING ULANG</Text>
            </Pressable>
            <Pressable style={styles.btnSec} onPress={() => router.replace("/(customer)/home")}>
              <Text style={styles.btnSecText}>KEMBALI KE BERANDA</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footNote}>Status pembayaran akan diperbarui otomatis setiap 5 detik.</Text>
      </ScrollView>
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
    <View style={[styles.stateCard, { backgroundColor: "#E7F9F0", borderColor: "#B6E9CE" }]}>
      <View style={[styles.stateIcon, { backgroundColor: COLORS.success }]}>
        <Ionicons name="checkmark" size={44} color="#FFFFFF" />
      </View>
      <Text style={[styles.stateTitle, { color: COLORS.success }]}>PEMBAYARAN BERHASIL</Text>
      <Text style={styles.stateSub}>Booking kamu telah terkonfirmasi. Sampai jumpa di lokasi!</Text>
    </View>
  );
}

function PendingCard({ mm, ss }: { mm: number; ss: number }) {
  return (
    <View style={[styles.stateCard, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
      <View style={[styles.stateIcon, { backgroundColor: COLORS.warning }]}>
        <Ionicons name="hourglass" size={40} color="#FFFFFF" />
      </View>
      <Text style={[styles.stateTitle, { color: "#B45309" }]}>MENUNGGU PEMBAYARAN</Text>
      <Text style={styles.timer}>{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</Text>
      <Text style={styles.stateSub}>Selesaikan pembayaran sebelum waktu habis. Booking akan dibatalkan otomatis jika tidak dibayar dalam 15 menit.</Text>
    </View>
  );
}

function ExpiredCard() {
  return (
    <View style={[styles.stateCard, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
      <View style={[styles.stateIcon, { backgroundColor: COLORS.error }]}>
        <Ionicons name="close" size={44} color="#FFFFFF" />
      </View>
      <Text style={[styles.stateTitle, { color: COLORS.error }]}>PEMBAYARAN KADALUARSA</Text>
      <Text style={styles.stateSub}>Batas waktu pembayaran telah lewat. Silakan booking ulang untuk melanjutkan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  err: { color: COLORS.textDim, fontFamily: FONT.medium },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },

  stateCard: { padding: 24, borderRadius: 20, borderWidth: 1, alignItems: "center", marginBottom: 16 },
  stateIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  stateTitle: { fontFamily: FONT.extrabold, fontSize: 16, letterSpacing: 0.8, marginBottom: 6 },
  stateSub: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, textAlign: "center", lineHeight: 20 },
  timer: { color: COLORS.warning, fontFamily: FONT.extrabold, fontSize: 42, letterSpacing: 2, marginVertical: 6 },

  card: { backgroundColor: COLORS.surface, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  qrImg: { width: 220, height: 220, marginVertical: 14, backgroundColor: "#FFFFFF", borderRadius: 12 },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 12 },
  shopRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  shopImg: { width: 60, height: 60, borderRadius: 14 },
  shopName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 15 },
  shopAddr: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 4 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  rowVal: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: COLORS.textMuted, fontFamily: FONT.semibold },
  totalValue: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 22 },

  btnPri: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: COLORS.brand, padding: 16, borderRadius: 14 },
  btnPriText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  btnSec: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  btnSecText: { color: COLORS.brand, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  footNote: { textAlign: "center", color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 20 },
});
