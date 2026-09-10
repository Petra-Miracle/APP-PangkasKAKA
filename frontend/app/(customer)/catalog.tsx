import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT, rupiah } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import { SkeletonShopCard } from "@/src/components/Skeleton";

export default function ProductCatalog() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Cari lokal (nama/toko/deskripsi) — endpoint katalog tidak punya param search,
  // jadi filter dilakukan di klien dari data yang sudah di-fetch. Tanpa endpoint baru.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter((p: any) =>
        `${p.name || ""} ${p.shop_name || ""} ${p.description || ""}`.toLowerCase().includes(q))
    : products;

  const load = useCallback(async () => {
    try { const r = await api.get("/products/catalog"); setProducts(r.products || []); } catch { setProducts([]); }
  }, []);

  // Refetch tiap fokus — skeleton cuma di load pertama, supaya pindah tab-tab
  // tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!hasLoadedRef.current) setLoading(true);
    load().finally(() => { setLoading(false); hasLoadedRef.current = true; });
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Produk grooming</Text>
        {/* Tas = pesanan produk saya (rute yang sudah ada, bukan keranjang baru) */}
        <PressableScale testID="catalog-orders-btn" style={styles.bagBtn} onPress={() => router.push("/(customer)/product-orders" as any)} scaleTo={0.92}>
          <Ionicons name="bag-handle" size={20} color="#FFFFFF" />
        </PressableScale>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textDim} />
        <TextInput
          testID="catalog-search"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Cari pomade, minyak rambut..."
          placeholderTextColor={COLORS.textDim}
        />
        {!!query && (
          <PressableScale onPress={() => setQuery("")} testID="catalog-search-clear" scaleTo={0.9}>
            <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
          </PressableScale>
        )}
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          <SkeletonShopCard />
          <SkeletonShopCard />
        </View>
      ) : products.length === 0 ? (
        <EmptyState
          icon="bag-handle-outline"
          title="Belum ada produk"
          description="Katalog produk dari barbershop rekanan akan muncul di sini."
        />
      ) : (
        <FlatList
          data={filtered}
          key="grid-2"
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Tidak ketemu"
              description={`Tidak ada produk yang cocok dengan "${query}". Coba kata kunci lain.`}
            />
          }
          renderItem={({ item }) => (
            <PressableScale
              testID={`catalog-item-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/(customer)/product/${item.id}` as any)}
              scaleTo={0.97}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" />
              ) : (
                <View style={[styles.img, styles.imgFallback]}>
                  <Ionicons name="bag-handle" size={26} color={COLORS.brandLight} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                {!!item.shop_name && <Text style={styles.shopName} numberOfLines={1}>{item.shop_name}</Text>}
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{rupiah(item.price)}</Text>
                  {/* Tombol tambah: pintasan visual ke halaman detail (aksi sama dgn card) */}
                  <View style={styles.quickAdd}>
                    <Ionicons name="add" size={18} color={COLORS.onBrand} />
                  </View>
                </View>
              </View>
            </PressableScale>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 10 },
  backBtn: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  headerTitle: { flex: 1, color: COLORS.text, fontSize: 20, fontFamily: FONT.extrabold, letterSpacing: -0.3, textAlign: "center" },
  bagBtn: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16,
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginHorizontal: 16, marginTop: 4, marginBottom: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  img: { width: "100%", height: 150, backgroundColor: COLORS.surface2 },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 12 },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15, lineHeight: 20, minHeight: 40 },
  shopName: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  price: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 15 },
  quickAdd: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
});
