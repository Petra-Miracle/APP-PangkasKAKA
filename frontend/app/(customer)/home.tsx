import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, ScrollView, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api, COLORS, formatJarak } from "@/src/lib/api";

type Shop = { id: string; name: string; image: string; address: string; rating: number; reviews_count: number; price_range: string; distance_km: number | null; is_verified: boolean };

const FILTERS = [
  { key: "terdekat", label: "Terdekat" },
  { key: "rating", label: "Rating" },
  { key: "harga", label: "Harga" },
];

export default function Home() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState("terdekat");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState("");
  const [gpsDenied, setGpsDenied] = useState(false);

  const loadShops = useCallback(async (s: string, c: { lat: number; lng: number } | null) => {
    let url = `/shops?sort=${s}`;
    if (c) url += `&lat=${c.lat}&lng=${c.lng}`;
    const res = await api.get(url);
    setShops(res.shops);
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let c: { lat: number; lng: number } | null = null;
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setCoords(c);
        } catch { setGpsDenied(true); }
      } else {
        setGpsDenied(true);
        // fallback to Kupang center
        c = { lat: -10.1789, lng: 123.607 };
        setCoords(c);
      }
      await loadShops(sort, c);
    } catch (e) {} finally { setLoading(false); }
  }, [loadShops, sort]);

  useEffect(() => { init(); }, [init]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShops(sort, coords);
    setRefreshing(false);
  };

  const onSort = async (s: string) => {
    setSort(s);
    await loadShops(s, coords);
  };

  const filtered = shops.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Halo,</Text>
          <Text style={styles.city} testID="city-name">Kupang · NTT</Text>
        </View>
        <Pressable testID="notif-btn" onPress={() => router.push("/(customer)/profile")}>
          <Ionicons name="notifications-outline" size={26} color={COLORS.text} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textDim} />
        <TextInput testID="search-shops" style={styles.searchInput} placeholder="Cari barbershop..." placeholderTextColor={COLORS.textDim} value={search} onChangeText={setSearch} />
      </View>

      <Pressable testID="ai-banner" style={styles.aiBanner} onPress={() => router.push("/(customer)/ai-scan")}>
        <Ionicons name="sparkles" size={28} color={COLORS.brandLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.aiTitle}>AI Face Scan</Text>
          <Text style={styles.aiSub}>Cari gaya rambut yang cocok dengan wajahmu</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={COLORS.brandLight} />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ maxHeight: 56 }}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} testID={`filter-${f.key}`} onPress={() => onSort(f.key)}
            style={[styles.chip, sort === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, sort === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
          ListEmptyComponent={<Text style={styles.empty}>Tidak ada barbershop ditemukan</Text>}
          renderItem={({ item }) => (
            <Pressable testID={`shop-card-${item.id}`} style={styles.card} onPress={() => router.push(`/(customer)/shop/${item.id}` as any)}>
              <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
                <View style={styles.cardRow}>
                  <View style={styles.rateBox}>
                    <Ionicons name="star" size={13} color={COLORS.warning} />
                    <Text style={styles.rateText}>{item.rating?.toFixed(1) || "0.0"}</Text>
                    <Text style={styles.rateCount}> · {item.reviews_count} ulasan</Text>
                  </View>
                  <Text style={styles.dist}>{formatJarak(item.distance_km)}</Text>
                </View>
                <Text style={styles.price}>{item.price_range}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  hi: { color: COLORS.textDim, fontSize: 12 },
  city: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, marginHorizontal: 16, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 12 },
  aiBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.brandDim, marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: COLORS.brand },
  aiTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  aiSub: { color: COLORS.brandLight, fontSize: 12, marginTop: 2 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 12, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { color: COLORS.textDim, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#121212" },
  card: { backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  cardImg: { width: "100%", height: 140 },
  cardBody: { padding: 14 },
  cardName: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  cardAddr: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  rateBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  rateText: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  rateCount: { color: COLORS.textDim, fontSize: 11 },
  dist: { color: COLORS.brandLight, fontWeight: "700", fontSize: 12 },
  price: { color: COLORS.textDim, fontSize: 12, marginTop: 6 },
  empty: { color: COLORS.textDim, textAlign: "center", marginTop: 40 },
});
