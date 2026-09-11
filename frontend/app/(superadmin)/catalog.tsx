import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

export default function AdminCatalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState({ name: "", price: "35000", description: "", photo: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { scrollRef, handleFocus } = useScrollToInput();

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/admin/products"); setProducts(r.products); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => { setP({ name: "", price: "35000", description: "", photo: "" }); setEditingId(null); };

  const pickPhoto = async () => {
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

  const save = async () => {
    if (!p.name) return;
    setSaving(true);
    try {
      const body = { name: p.name, price: parseInt(p.price || "0", 10), description: p.description, photo: p.photo };
      if (editingId) await api.put(`/admin/products/${editingId}`, body);
      else await api.post("/admin/products", body);
      resetForm();
      await load();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };
  const startEdit = (pr: any) => {
    setEditingId(pr.id);
    setP({ name: pr.name, price: String(pr.price), description: pr.description || "", photo: "" });
  };
  const remove = (pr: any) => {
    Alert.alert("Hapus Produk", `Yakin ingin menghapus ${pr.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (editingId === pr.id) resetForm(); await api.del(`/admin/products/${pr.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 12, width: 110, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 24, width: 200, marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton style={{ height: 76 }} />
        <Skeleton style={{ height: 76 }} />
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
        <View style={styles.badge}><Ionicons name="bag-handle" size={12} color={COLORS.gold} /><Text style={styles.badgeText}>KATALOG PLATFORM</Text></View>
        <Text style={styles.headerTitle}>Katalog Produk Umum</Text>
        <Text style={styles.headerSub}>Produk ini tampil untuk semua customer, tidak terikat toko manapun</Text>
      </LinearGradient>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {products.length === 0 && (
          <EmptyState
            icon="bag-handle-outline"
            title="Belum ada produk umum"
            description="Tambahkan produk di bawah untuk ditampilkan di katalog beranda customer."
          />
        )}
        {products.map((pr: any) => (
          <View key={pr.id} style={styles.item} testID={`admin-prod-${pr.id}`}>
            {pr.image ? (
              <Image source={{ uri: pr.image }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={styles.avatar}><Ionicons name="bag-handle" size={18} color={COLORS.brand} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{pr.name}</Text>
              <Text style={styles.itemMeta} numberOfLines={1}>{pr.description || "-"}</Text>
            </View>
            <Text style={styles.itemPrice}>{rupiah(pr.price)}</Text>
            <PressableScale style={styles.iconBtn} onPress={() => startEdit(pr)} testID={`edit-admin-prod-${pr.id}`} scaleTo={0.9}>
              <Ionicons name="pencil" size={16} color={COLORS.brand} />
            </PressableScale>
            <PressableScale style={styles.iconBtn} onPress={() => remove(pr)} testID={`del-admin-prod-${pr.id}`} scaleTo={0.9}>
              <Ionicons name="trash" size={16} color={COLORS.error} />
            </PressableScale>
          </View>
        ))}

        <View style={styles.card}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>{editingId ? "Edit Produk" : "Tambah Produk Umum"}</Text>
            {editingId && (
              <PressableScale onPress={resetForm} scaleTo={0.9}>
                <Text style={styles.cancelEditText}>Batal</Text>
              </PressableScale>
            )}
          </View>
          <PressableScale style={styles.photoPick} onPress={pickPhoto} testID="pick-admin-product-photo" scaleTo={0.99}>
            {p.photo ? (
              <Image source={{ uri: p.photo }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <>
                <View style={styles.photoIcon}><Ionicons name="camera-outline" size={20} color={COLORS.brand} /></View>
                <Text style={styles.photoPickText}>{editingId ? "Ganti foto produk (opsional)" : "Unggah foto produk"}</Text>
              </>
            )}
          </PressableScale>
          <TextInput style={styles.input} value={p.name} onChangeText={(t) => setP({ ...p, name: t })} placeholder="Nama produk" placeholderTextColor={COLORS.textDim} testID="new-admin-product-name" onFocus={handleFocus} />
          <TextInput style={styles.input} value={p.price} onChangeText={(t) => setP({ ...p, price: t })} placeholder="Harga (Rp)" placeholderTextColor={COLORS.textDim} keyboardType="numeric" onFocus={handleFocus} />
          <TextInput style={styles.input} value={p.description} onChangeText={(t) => setP({ ...p, description: t })} placeholder="Deskripsi singkat (opsional)" placeholderTextColor={COLORS.textDim} onFocus={handleFocus} />
          <PressableScale style={[styles.btnWrap, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="add-admin-product" haptic>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{saving ? "..." : editingId ? "SIMPAN PERUBAHAN" : "TAMBAH PRODUK"}</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -70, right: -40 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 10 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },

  item: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  thumb: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.surface2 },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  itemPrice: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  iconBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, marginTop: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cancelEditText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  photoPick: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface2,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 14, height: 90, overflow: "hidden", marginBottom: 12,
  },
  photoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  photoPickText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  photoPreview: { width: "100%", height: "100%" },
  input: {
    backgroundColor: COLORS.surface2, color: COLORS.text, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14, marginBottom: 10,
  },
  btnWrap: { borderRadius: 14, marginTop: 4, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
});
