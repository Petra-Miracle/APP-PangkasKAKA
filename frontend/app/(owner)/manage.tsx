import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

export default function Manage() {
  const router = useRouter();
  const [tab, setTab] = useState<"barbers" | "services" | "products">("barbers");
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [b, setB] = useState({ name: "", specialization: "", skill_level: "Standar" });
  const [s, setS] = useState({ name: "", duration: "30", price: "35000" });
  const [p, setP] = useState({ name: "", price: "35000", description: "", photo: "" });
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const { scrollRef, handleFocus } = useScrollToInput();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/owner/shop");
      if (r.shop) {
        const [d, pr] = await Promise.allSettled([
          api.get(`/shops/${r.shop.id}`),
          api.get("/owner/products"),
        ]);
        if (d.status === "fulfilled") setShop(d.value);
        if (pr.status === "fulfilled") setProducts(pr.value.products);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetBarberForm = () => { setB({ name: "", specialization: "", skill_level: "Standar" }); setEditingBarberId(null); };
  const resetServiceForm = () => { setS({ name: "", duration: "30", price: "35000" }); setEditingServiceId(null); };

  const saveBarber = async () => {
    if (!b.name) return;
    try {
      if (editingBarberId) {
        await api.put(`/owner/barbers/${editingBarberId}`, { name: b.name, specialization: b.specialization, skill_level: b.skill_level });
      } else {
        await api.post("/owner/barbers", { name: b.name, specialization: b.specialization, skill_level: "Standar" });
      }
      resetBarberForm();
      await load();
    } catch (e: any) { alert(e.message); }
  };
  const startEditBarber = (br: any) => {
    setEditingBarberId(br.id);
    setB({ name: br.name, specialization: br.specialization || "", skill_level: br.skill_level || "Standar" });
  };
  const deleteBarber = (br: any) => {
    Alert.alert("Hapus Barber", `Yakin ingin menghapus ${br.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (editingBarberId === br.id) resetBarberForm(); await api.del(`/owner/barbers/${br.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  const saveService = async () => {
    if (!s.name) return;
    try {
      if (editingServiceId) {
        await api.put(`/owner/services/${editingServiceId}`, { name: s.name, duration: parseInt(s.duration), price: parseInt(s.price) });
      } else {
        await api.post("/owner/services", { name: s.name, duration: parseInt(s.duration), price: parseInt(s.price) });
      }
      resetServiceForm();
      await load();
    } catch (e: any) { alert(e.message); }
  };
  const startEditService = (sv: any) => {
    setEditingServiceId(sv.id);
    setS({ name: sv.name, duration: String(sv.duration), price: String(sv.price) });
  };
  const deleteService = (sv: any) => {
    Alert.alert("Hapus Layanan", `Yakin ingin menghapus ${sv.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (editingServiceId === sv.id) resetServiceForm(); await api.del(`/owner/services/${sv.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  const resetProductForm = () => { setP({ name: "", price: "35000", description: "", photo: "" }); setEditingProductId(null); };

  const pickProductPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { alert("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    const resized = await ImageManipulator.manipulateAsync(
      res.assets[0].uri,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    setP({ ...p, photo: `data:image/jpeg;base64,${resized.base64}` });
  };

  const saveProduct = async () => {
    if (!p.name) return;
    setSavingProduct(true);
    try {
      const body = { name: p.name, price: parseInt(p.price || "0", 10), description: p.description, photo: p.photo };
      if (editingProductId) await api.put(`/owner/products/${editingProductId}`, body);
      else await api.post("/owner/products", body);
      resetProductForm();
      await load();
    } catch (e: any) { alert(e.message); }
    setSavingProduct(false);
  };
  const startEditProduct = (pr: any) => {
    setEditingProductId(pr.id);
    setP({ name: pr.name, price: String(pr.price), description: pr.description || "", photo: "" });
  };
  const deleteProduct = (pr: any) => {
    Alert.alert("Hapus Produk", `Yakin ingin menghapus ${pr.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (editingProductId === pr.id) resetProductForm(); await api.del(`/owner/products/${pr.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.amberHeader}>
        <Skeleton style={{ height: 22, width: 160, backgroundColor: "rgba(15,26,46,0.12)" }} />
        <Skeleton style={{ height: 12, width: 120, marginTop: 8, backgroundColor: "rgba(15,26,46,0.12)" }} />
      </View>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 70 }} />
        <Skeleton style={{ height: 70 }} />
        <Skeleton style={{ height: 160 }} />
      </View>
    </SafeAreaView>
  );
  if (!shop) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.amberHeader}>
        <Text style={styles.headerTitle}>Kelola Toko</Text>
      </View>
      <EmptyState icon="storefront-outline" title="Belum ada toko" description="Daftarkan toko terlebih dulu di Dashboard." onAction={() => router.push("/(owner)/dashboard" as any)} actionLabel="Ke Dashboard" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.amberHeader}>
        <View pointerEvents="none" style={styles.headerDeco} />
        <Text style={styles.headerEyebrow}>{shop.name?.toUpperCase()}</Text>
        <Text style={styles.headerTitle}>Kelola Toko</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ maxHeight: 60 }}>
        {[["barbers", "Barber Toko", "cut"], ["services", "Layanan", "pricetag"], ["products", "Produk", "bag-handle"]].map(([k, l, i]) => (
          <PressableScale key={k} testID={`tab-${k}`} onPress={() => setTab(k as any)} style={[styles.tab, tab === k && styles.tabActive]} scaleTo={0.94}>
            <Ionicons name={i as any} size={14} color={tab === k ? COLORS.onBrand : COLORS.textDim} />
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </PressableScale>
        ))}
      </ScrollView>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {tab === "barbers" && (
          <View>
            <Text style={styles.countLabel}>{shop.barbers.filter((br: any) => !br.is_street_barber).length} barber terdaftar</Text>
            {shop.barbers.filter((br: any) => !br.is_street_barber).map((br: any) => (
              <View key={br.id} style={styles.item} testID={`brb-${br.id}`}>
                <View style={styles.avatar}><Ionicons name="cut" size={18} color={COLORS.brandLight} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{br.name}</Text>
                  <View style={styles.rowInline}>
                    <View style={styles.pill}><Text style={styles.pillText}>{br.skill_level}</Text></View>
                    <Text style={styles.itemMeta}>{br.specialization || "-"}</Text>
                  </View>
                </View>
                <PressableScale style={styles.iconBtn} onPress={() => startEditBarber(br)} testID={`edit-brb-${br.id}`} scaleTo={0.9}>
                    <Ionicons name="pencil" size={16} color={COLORS.brandLight} />
                </PressableScale>
                <PressableScale style={styles.iconBtn} onPress={() => deleteBarber(br)} testID={`del-brb-${br.id}`} scaleTo={0.9}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                </PressableScale>
              </View>
            ))}
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>{editingBarberId ? "Edit Barber" : "Tambah Barber Manual"}</Text>
                {editingBarberId && (
                  <PressableScale onPress={resetBarberForm} scaleTo={0.9}>
                    <Text style={styles.cancelEditText}>Batal</Text>
                  </PressableScale>
                )}
              </View>
              <TextInput style={styles.input} value={b.name} onChangeText={(t) => setB({ ...b, name: t })} placeholder="Nama barber" placeholderTextColor={COLORS.textDim} testID="new-barber-name" onFocus={handleFocus} />
              <TextInput style={styles.input} value={b.specialization} onChangeText={(t) => setB({ ...b, specialization: t })} placeholder="Spesialisasi (mis. Fade & Undercut)" placeholderTextColor={COLORS.textDim} onFocus={handleFocus} />
              <PressableScale style={styles.btnWrap} onPress={saveBarber} testID="add-barber" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>{editingBarberId ? "SIMPAN PERUBAHAN" : "TAMBAH BARBER"}</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          </View>
        )}
        {tab === "services" && (
          <View>
            <Text style={styles.countLabel}>{shop.services.length} layanan</Text>
            {shop.services.map((sv: any) => (
              <View key={sv.id} style={styles.item} testID={`svc-${sv.id}`}>
                <View style={styles.avatar}><Ionicons name="pricetag" size={18} color={COLORS.brandLight} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{sv.name}</Text>
                  <Text style={styles.itemMeta}>{sv.duration} menit</Text>
                </View>
                <Text style={styles.itemPrice}>{rupiah(sv.price)}</Text>
                <PressableScale style={styles.iconBtn} onPress={() => startEditService(sv)} testID={`edit-svc-${sv.id}`} scaleTo={0.9}>
                    <Ionicons name="pencil" size={16} color={COLORS.brandLight} />
                </PressableScale>
                <PressableScale style={styles.iconBtn} onPress={() => deleteService(sv)} testID={`del-svc-${sv.id}`} scaleTo={0.9}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                </PressableScale>
              </View>
            ))}
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>{editingServiceId ? "Edit Layanan" : "Tambah Layanan"}</Text>
                {editingServiceId && (
                  <PressableScale onPress={resetServiceForm} scaleTo={0.9}>
                    <Text style={styles.cancelEditText}>Batal</Text>
                  </PressableScale>
                )}
              </View>
              <TextInput style={styles.input} value={s.name} onChangeText={(t) => setS({ ...s, name: t })} placeholder="Nama layanan" placeholderTextColor={COLORS.textDim} testID="new-svc-name" onFocus={handleFocus} />
              <TextInput style={styles.input} value={s.duration} onChangeText={(t) => setS({ ...s, duration: t })} placeholder="Durasi (menit)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" onFocus={handleFocus} />
              <TextInput style={styles.input} value={s.price} onChangeText={(t) => setS({ ...s, price: t })} placeholder="Harga (Rp)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" onFocus={handleFocus} />
              <PressableScale style={styles.btnWrap} onPress={saveService} testID="add-service" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>{editingServiceId ? "SIMPAN PERUBAHAN" : "TAMBAH LAYANAN"}</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          </View>
        )}
        {tab === "products" && (
          <View>
            <Text style={styles.countLabel}>{products.length} produk</Text>
            {products.map((pr: any) => (
              <View key={pr.id} style={styles.item} testID={`prod-${pr.id}`}>
                {pr.image ? (
                  <Image source={{ uri: pr.image }} style={styles.productThumb} contentFit="cover" />
                ) : (
                  <View style={styles.avatar}><Ionicons name="bag-handle" size={18} color={COLORS.brandLight} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{pr.name}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>{pr.description || "-"}</Text>
                </View>
                <Text style={styles.itemPrice}>{rupiah(pr.price)}</Text>
                <PressableScale style={styles.iconBtn} onPress={() => startEditProduct(pr)} testID={`edit-prod-${pr.id}`} scaleTo={0.9}>
                    <Ionicons name="pencil" size={16} color={COLORS.brandLight} />
                </PressableScale>
                <PressableScale style={styles.iconBtn} onPress={() => deleteProduct(pr)} testID={`del-prod-${pr.id}`} scaleTo={0.9}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                </PressableScale>
              </View>
            ))}
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>{editingProductId ? "Edit Produk" : "Tambah Produk"}</Text>
                {editingProductId && (
                  <PressableScale onPress={resetProductForm} scaleTo={0.9}>
                    <Text style={styles.cancelEditText}>Batal</Text>
                  </PressableScale>
                )}
              </View>
              <PressableScale style={styles.photoPick} onPress={pickProductPhoto} testID="pick-product-photo" scaleTo={0.99}>
                {p.photo ? (
                  <Image source={{ uri: p.photo }} style={styles.photoPreview} contentFit="cover" />
                ) : (
                  <>
                    <View style={styles.photoIcon}><Ionicons name="camera-outline" size={20} color={COLORS.brandLight} /></View>
                    <Text style={styles.photoPickText}>{editingProductId ? "Ganti foto produk (opsional)" : "Unggah foto produk"}</Text>
                  </>
                )}
              </PressableScale>
              <TextInput style={styles.input} value={p.name} onChangeText={(t) => setP({ ...p, name: t })} placeholder="Nama produk" placeholderTextColor={COLORS.textDim} testID="new-product-name" onFocus={handleFocus} />
              <TextInput style={styles.input} value={p.price} onChangeText={(t) => setP({ ...p, price: t })} placeholder="Harga (Rp)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" onFocus={handleFocus} />
              <TextInput style={styles.input} value={p.description} onChangeText={(t) => setP({ ...p, description: t })} placeholder="Deskripsi singkat (opsional)" placeholderTextColor={COLORS.textDim} onFocus={handleFocus} />
              <PressableScale style={[styles.btnWrap, savingProduct && { opacity: 0.6 }]} onPress={saveProduct} disabled={savingProduct} testID="add-product" haptic>
                <LinearGradient
                  colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>{savingProduct ? "..." : editingProductId ? "SIMPAN PERUBAHAN" : "TAMBAH PRODUK"}</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  amberHeader: {
    backgroundColor: COLORS.brand, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  headerDeco: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.18)", top: -65, right: -35 },
  headerEyebrow: { color: "rgba(15,26,46,0.6)", fontSize: 11, fontFamily: FONT.bold, letterSpacing: 2 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontFamily: FONT.extrabold, marginTop: 2 },
  tabRow: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 12 },
  tab: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brandLight },
  tabText: { color: COLORS.textMuted, fontFamily: FONT.semibold, fontSize: 12 },
  tabTextActive: { color: COLORS.onBrand },
  countLabel: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12, marginBottom: 10 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  productThumb: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.surface2 },
  photoPick: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface2,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 14, height: 90, overflow: "hidden", marginBottom: 12,
  },
  photoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  photoPickText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  photoPreview: { width: "100%", height: "100%" },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 14 },
  rowInline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.brandDim },
  pillText: { color: COLORS.brandLight, fontSize: 10, fontFamily: FONT.bold },
  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, marginTop: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14, marginBottom: 12 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cancelEditText: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 12 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  input: { backgroundColor: COLORS.surface2, color: COLORS.text, padding: 13, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14 },
  btnWrap: { borderRadius: 14, marginTop: 4, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, letterSpacing: 1, fontSize: 13 },

  // Applicant card
  applicantCard: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.3 },
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  scoreDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  scoreText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12 },
  evalBtnWrap: { borderRadius: 13, marginTop: 12, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  evalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
  evalBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  evalBtnGhost: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 13, marginTop: 8, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  evalBtnGhostText: { color: COLORS.brand, fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 12 },
  berkasRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  berkasRejectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: COLORS.error, backgroundColor: "#FEF2F2",
  },
  berkasRejectText: { color: COLORS.error, fontFamily: FONT.extrabold, letterSpacing: 0.6, fontSize: 11 },
  berkasApproveBtnWrap: { flex: 1, borderRadius: 13, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  berkasApproveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
  berkasApproveText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.6, fontSize: 11 },

  // Modal
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "94%", shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 10 },
  mHeader: { alignItems: "center", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  mAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.brandDim },
  mInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 28 },
  mName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18, marginTop: 10 },
  mEmail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },

  sec: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 11, fontFamily: FONT.bold, marginTop: 16, marginBottom: 10 },
  docsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  docChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface2, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  docChipText: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 12, maxWidth: 100 },

  critCard: { backgroundColor: COLORS.surface2, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  critHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  critIco: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  critLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  critDesc: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  critScorePill: { width: 44, height: 32, borderRadius: 10, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  critScoreText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 14 },

  hint: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 12, lineHeight: 16, textAlign: "center" },
  saveBtnWrap: { borderRadius: 15, marginTop: 16, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  saveBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 0.8, fontSize: 13 },
  closeBtn: { alignItems: "center", padding: 12, marginTop: 4 },
  closeText: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 13 },

  critList: { gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultIco: { width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  resultLabel: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 13, flex: 1 },
  resultVal: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  resultTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 12 },
  resultTotalLabel: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  resultTotalVal: { fontFamily: FONT.extrabold, fontSize: 20 },

  // Preview modal
  previewBg: { flex: 1, backgroundColor: COLORS.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  previewCard: { backgroundColor: COLORS.surface, borderRadius: 22, width: "100%", maxWidth: 500, maxHeight: "85%", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  previewTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 16 },
  previewImg: { width: "100%", height: 400, borderRadius: 12 },
  previewText: { backgroundColor: COLORS.surface2, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  previewTextContent: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, lineHeight: 20 },
});