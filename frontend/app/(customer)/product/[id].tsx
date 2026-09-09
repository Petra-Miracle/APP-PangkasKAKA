import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import PressableScale from "@/src/components/PressableScale";
import Skeleton from "@/src/components/Skeleton";

// Halaman pembelian produk — terpisah dari halaman pemesanan layanan (shop/[id].tsx,
// barber/[id].tsx). Tap produk dari Katalog Produk (app/(customer)/catalog.tsx) masuk
// ke sini, bukan ke halaman booking layanan toko.

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};
const DEFAULT_CENTER: [number, number] = [123.607, -10.1789]; // Kupang, [lng, lat]

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    user?.lat != null && user?.lng != null ? [user.lng, user.lat] : DEFAULT_CENTER
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/products/${id}`);
        if (!cancelled) setProduct(r);
      } catch (e: any) {
        if (!cancelled) alert(e.message || "Gagal memuat produk");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const useCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { alert("Izin lokasi dibutuhkan untuk pengantaran"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setMapCenter([loc.coords.longitude, loc.coords.latitude]);
    } catch { alert("Gagal mengambil lokasi, coba lagi"); } finally { setGpsLoading(false); }
  };

  const onMapPress = (e: any) => {
    const [lng, lat] = e.nativeEvent?.lngLat || e.geometry?.coordinates || [];
    if (lat == null || lng == null) return;
    setCoords({ lat, lng });
    setMapCenter([lng, lat]);
  };

  const amountProduct = (product?.price || 0) * quantity;
  const amountAdminFee = Math.round(amountProduct * 0.007);
  const amountTotal = amountProduct + amountAdminFee;

  const createOrder = async () => {
    if (fulfillment === "delivery" && !address.trim()) {
      alert("Alamat pengantaran wajib diisi");
      return;
    }
    setCreating(true);
    try {
      const r = await api.post("/product-orders", {
        product_id: id,
        quantity,
        fulfillment,
        address: fulfillment === "delivery" ? address : "",
        lat: fulfillment === "delivery" ? coords?.lat : undefined,
        lng: fulfillment === "delivery" ? coords?.lng : undefined,
      });
      const orderId = r.order.id;
      let mode = "simulation";
      try { const m = await api.get("/payments/mode"); mode = m.mode || "simulation"; } catch {}

      if (mode === "simulation") {
        setPayModal(r.order);
      } else {
        try {
          const p = await api.post(`/payments/create-product/${orderId}`);
          if (p?.payment_link_url || p?.qr_string) {
            router.replace(`/payment/status-product/${orderId}?url=${encodeURIComponent(p.payment_link_url || "")}` as any);
          } else {
            alert("Gagal membuat link pembayaran, silakan coba lagi");
          }
        } catch (e: any) {
          alert(e.message || "Gagal membuat link pembayaran, silakan coba lagi");
        }
      }
    } catch (e: any) { alert(e.message); } finally { setCreating(false); }
  };

  const doPay = async () => {
    try {
      await api.post(`/payments/simulate-product/${payModal.id}`);
      setPayModal(null);
      router.replace(`/payment/status-product/${payModal.id}` as any);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton style={{ height: 200, borderRadius: 16 }} />
          <Skeleton style={{ height: 24, width: 160 }} />
          <Skeleton style={{ height: 100 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><Text style={styles.err}>Produk tidak ditemukan</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.backRow}>
          <PressableScale onPress={() => router.back()} style={styles.back} scaleTo={0.9}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </PressableScale>
          <Text style={styles.backTitle}>Detail Produk</Text>
        </View>

        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={[styles.img, styles.imgFallback]}>
            <Ionicons name="bag-handle" size={40} color={COLORS.brand} />
          </View>
        )}

        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>{rupiah(product.price)}</Text>
        {!!product.shop_name && (
          <View style={styles.shopRow}>
            <Ionicons name="storefront-outline" size={14} color={COLORS.textDim} />
            <Text style={styles.shopName}>{product.shop_name}</Text>
          </View>
        )}
        {!!product.description && <Text style={styles.desc}>{product.description}</Text>}

        <View style={styles.card}>
          <Text style={styles.sec}>KUANTITAS</Text>
          <View style={styles.qtyRow}>
            <PressableScale style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))} scaleTo={0.9}>
              <Ionicons name="remove" size={18} color={COLORS.brand} />
            </PressableScale>
            <Text style={styles.qtyVal}>{quantity}</Text>
            <PressableScale style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)} scaleTo={0.9}>
              <Ionicons name="add" size={18} color={COLORS.brand} />
            </PressableScale>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sec}>PENGAMBILAN</Text>
          <View style={styles.toggleRow}>
            <PressableScale
              style={[styles.toggleChip, fulfillment === "pickup" && styles.toggleChipActive]}
              onPress={() => setFulfillment("pickup")}
              scaleTo={0.97}
            >
              <Ionicons name="storefront" size={16} color={fulfillment === "pickup" ? "#FFFFFF" : COLORS.brand} />
              <Text style={[styles.toggleText, fulfillment === "pickup" && styles.toggleTextActive]}>Ambil di Toko</Text>
            </PressableScale>
            <PressableScale
              style={[styles.toggleChip, fulfillment === "delivery" && styles.toggleChipActive]}
              onPress={() => setFulfillment("delivery")}
              scaleTo={0.97}
            >
              <Ionicons name="bicycle" size={16} color={fulfillment === "delivery" ? "#FFFFFF" : COLORS.brand} />
              <Text style={[styles.toggleText, fulfillment === "delivery" && styles.toggleTextActive]}>Diantar ke Alamat</Text>
            </PressableScale>
          </View>

          {fulfillment === "pickup" ? (
            <View style={styles.pickupBox}>
              <Ionicons name="location-outline" size={16} color={COLORS.textDim} />
              <Text style={styles.pickupAddr}>{product.shop_address || "Alamat toko belum diisi"}</Text>
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              <Text style={styles.mapHint}>Ketuk peta untuk menandai lokasi pengantaran</Text>
              <View style={styles.mapBox}>
                <Map mapStyle={OSM_STYLE} style={{ flex: 1 }} attribution logo={false} compass={false} scaleBar={false} onPress={onMapPress}>
                  <Camera center={mapCenter} zoom={15} duration={400} />
                  {coords && (
                    <Marker id="delivery-pin" lngLat={[coords.lng, coords.lat]}>
                      <View style={styles.mapPin}>
                        <Ionicons name="home" size={16} color="#FFFFFF" />
                      </View>
                    </Marker>
                  )}
                </Map>
              </View>
              <TextInput
                style={styles.addrInput}
                placeholder="Alamat pengantaran (patokan, nama jalan, dsb)"
                placeholderTextColor={COLORS.textDim}
                value={address}
                onChangeText={setAddress}
                multiline
              />
              <PressableScale style={styles.gpsBtn} onPress={useCurrentLocation} disabled={gpsLoading} scaleTo={0.97}>
                <Ionicons name={coords ? "checkmark-circle" : "locate"} size={16} color={coords ? COLORS.success : COLORS.brand} />
                <Text style={[styles.gpsBtnText, coords ? { color: COLORS.success } : null]}>
                  {gpsLoading ? "Mengambil lokasi..." : coords ? "Titik lokasi tersimpan" : "Pakai Lokasi Saat Ini"}
                </Text>
              </PressableScale>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sec}>RINGKASAN PEMBAYARAN</Text>
          <SummaryRow label={`Harga Produk x${quantity}`} value={rupiah(amountProduct)} />
          <SummaryRow label="Biaya Admin" value={rupiah(amountAdminFee)} />
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{rupiah(amountTotal)}</Text>
          </View>
        </View>

        <PressableScale style={styles.orderBtnWrap} onPress={createOrder} disabled={creating} scaleTo={0.98}>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orderBtn}
          >
            <Ionicons name="bag-check" size={18} color="#FFFFFF" />
            <Text style={styles.orderBtnText}>{creating ? "MEMPROSES..." : "BUAT PESANAN"}</Text>
          </LinearGradient>
        </PressableScale>
      </ScrollView>

      <Modal visible={!!payModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHead}
            >
              <View style={styles.modalHeadIcon}>
                <Ionicons name="qr-code" size={22} color={COLORS.brand} />
              </View>
              <Text style={styles.modalTitle}>Pembayaran QRIS</Text>
              <Text style={styles.modalSub}>Mode simulasi — tekan tombol di bawah untuk mensimulasikan pembayaran</Text>
            </LinearGradient>
            {payModal?.amount_total_charged != null && (
              <View style={styles.payBreakdown}>
                <SummaryRow label="Harga Produk" value={rupiah(payModal.amount_product)} />
                <SummaryRow label="Biaya Admin" value={rupiah(payModal.amount_admin_fee)} />
                <Text style={styles.payTotal}>{rupiah(payModal.amount_total_charged)}</Text>
              </View>
            )}
            <PressableScale style={styles.payBtn} onPress={doPay} haptic>
              <LinearGradient
                colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.payBtnGrad}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.payBtnText}>SIMULASI BAYAR</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale onPress={() => setPayModal(null)} style={styles.cancelBtn} scaleTo={0.95}>
              <Text style={styles.cancelText}>Batalkan</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: any) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  err: { color: COLORS.textDim, fontFamily: FONT.medium },
  backRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  back: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border,
  },
  backTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },

  img: { width: "100%", height: 200, borderRadius: 18, backgroundColor: COLORS.surface2 },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 20, marginTop: 16 },
  price: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18, marginTop: 4 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  shopName: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  desc: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13, marginTop: 10, lineHeight: 20 },

  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 16,
  },
  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginBottom: 12 },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  qtyVal: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16, minWidth: 24, textAlign: "center" },

  toggleRow: { flexDirection: "row", gap: 10 },
  toggleChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim,
  },
  toggleChipActive: { backgroundColor: COLORS.brand },
  toggleText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 12 },
  toggleTextActive: { color: "#FFFFFF" },

  pickupBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  pickupAddr: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 12, flex: 1, lineHeight: 18 },

  mapHint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  mapBox: { height: 200, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  mapPin: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  addrInput: { backgroundColor: COLORS.bg, color: COLORS.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 13, minHeight: 60, textAlignVertical: "top" },
  gpsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.bg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  gpsBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 13 },

  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  sumLabel: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },
  sumVal: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  totalValue: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18 },

  orderBtnWrap: { borderRadius: 14, overflow: "hidden", marginTop: 20, shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  orderBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 16 },
  orderBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, alignItems: "center" },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: 12 },
  modalHead: { width: "100%", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 14 },
  modalHeadIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  modalTitle: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 16 },
  modalSub: { color: "rgba(255,255,255,0.85)", fontFamily: FONT.medium, fontSize: 12, marginTop: 4, textAlign: "center" },
  payBreakdown: { width: "100%", marginBottom: 14 },
  payTotal: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 20, textAlign: "right", marginTop: 8 },
  payBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  payBtnGrad: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 16 },
  payBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  cancelBtn: { padding: 14 },
  cancelText: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 13 },
});
