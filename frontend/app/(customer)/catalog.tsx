import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
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

  const load = useCallback(async () => {
    try { const r = await api.get("/products/catalog"); setProducts(r.products || []); } catch { setProducts([]); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Katalog Produk</Text>
          <Text style={styles.sub}>Produk pangkas rambut dari barbershop rekanan</Text>
        </View>
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
          data={products}
          key="grid-2"
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
          renderItem={({ item }) => (
            <PressableScale
              testID={`catalog-item-${item.id}`}
              style={styles.card}
              onPress={() => { if (item.shop_id) router.push(`/(customer)/shop/${item.shop_id}` as any); }}
              scaleTo={0.97}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" />
              ) : (
                <View style={[styles.img, styles.imgFallback]}>
                  <Ionicons name="bag-handle" size={26} color={COLORS.brand} />
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {!!item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
              <View style={styles.bottomRow}>
                <Text style={styles.price}>{rupiah(item.price)}</Text>
                {item.shop_name && (
                  <View style={styles.shopBadge}>
                    <Text style={styles.shopBadgeText} numberOfLines={1}>{item.shop_name}</Text>
                  </View>
                )}
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
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  sub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  img: { width: "100%", height: 110, borderRadius: 14, backgroundColor: COLORS.surface2 },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13, marginTop: 10 },
  desc: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 3, lineHeight: 15 },
  bottomRow: { marginTop: 8, gap: 6 },
  price: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 14 },
  shopBadge: { alignSelf: "flex-start", backgroundColor: COLORS.brandDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, maxWidth: "100%" },
  shopBadgeText: { color: COLORS.brand, fontSize: 10, fontFamily: FONT.bold },
});
