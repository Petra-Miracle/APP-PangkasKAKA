import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api, COLORS, FONT, formatJarak } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonShopCard } from "@/src/components/Skeleton";

type Shop = {
  id: string; name: string; image: string; address: string; rating: number; reviews_count: number;
  price_range: string; distance_km: number | null; min_price: number | null; booking_count: number;
};

const SORTS = [
  { key: "terdekat", label: "Terdekat", icon: "navigate" },
  { key: "rating", label: "Rating Tertinggi", icon: "star" },
  { key: "harga", label: "Termurah", icon: "pricetag" },
  { key: "terpopuler", label: "Terpopuler", icon: "flame" },
];

const DISTANCE_OPTIONS = [
  { key: null, label: "Semua Jarak" },
  { key: 3, label: "< 3 km" },
  { key: 5, label: "< 5 km" },
  { key: 10, label: "< 10 km" },
];

const RATING_OPTIONS = [
  { key: null, label: "Semua Rating" },
  { key: 4, label: "4.0+" },
  { key: 4.5, label: "4.5+" },
];

const PRICE_OPTIONS = [
  { key: null, label: "Semua Harga" },
  { key: 50000, label: "< Rp 50rb" },
  { key: 100000, label: "< Rp 100rb" },
  { key: 200000, label: "< Rp 200rb" },
];

export default function Explore() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("terdekat");
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  // Draft values edited inside the filter sheet, committed on "Terapkan" so the
  // list doesn't refetch on every tap while the sheet is still open.
  const [draft, setDraft] = useState({ sort, maxDistance, minRating, maxPrice });

  const load = useCallback(async (c: { lat: number; lng: number } | null, opts: { sort: string; maxDistance: number | null; minRating: number | null; maxPrice: number | null; search: string }) => {
    setLoading(true);
    try {
      let url = `/shops?sort=${opts.sort}`;
      if (c) url += `&lat=${c.lat}&lng=${c.lng}`;
      if (opts.maxDistance) url += `&max_distance_km=${opts.maxDistance}`;
      if (opts.minRating) url += `&min_rating=${opts.minRating}`;
      if (opts.maxPrice) url += `&max_price=${opts.maxPrice}`;
      if (opts.search) url += `&q=${encodeURIComponent(opts.search)}`;
      const res = await api.get(url);
      setShops(res.shops);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let c: { lat: number; lng: number } | null = null;
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch { c = { lat: -10.1789, lng: 123.607 }; }
      } else {
        c = { lat: -10.1789, lng: 123.607 };
      }
      setCoords(c);
      await load(c, { sort, maxDistance, minRating, maxPrice, search });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (text: string) => {
    setSearch(text);
    await load(coords, { sort, maxDistance, minRating, maxPrice, search: text });
  };

  const openFilter = () => { setDraft({ sort, maxDistance, minRating, maxPrice }); setShowFilter(true); };
  const applyFilter = async () => {
    setSort(draft.sort); setMaxDistance(draft.maxDistance); setMinRating(draft.minRating); setMaxPrice(draft.maxPrice);
    setShowFilter(false);
    await load(coords, { ...draft, search });
  };
  const resetFilter = () => setDraft({ sort: "terdekat", maxDistance: null, minRating: null, maxPrice: null });

  const activeFilterCount = [maxDistance, minRating, maxPrice].filter((v) => v !== null).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={["#F9F9FA", COLORS.brandDim]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.title}>Jelajah Barbershop</Text>
        <Text style={styles.headerSub}>Temukan barber terbaik di sekitarmu</Text>
      </LinearGradient>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textDim} />
          <TextInput
            testID="explore-search" style={styles.searchInput} placeholder="Cari nama atau alamat toko..."
            placeholderTextColor={COLORS.textDim} value={search} onChangeText={runSearch}
          />
        </View>
        <PressableScale testID="open-filter" style={styles.filterBtn} onPress={openFilter} scaleTo={0.92}>
          <Ionicons name="options" size={18} color={COLORS.brand} />
          {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ maxHeight: 48 }}>
        {SORTS.map((s) => (
          <PressableScale key={s.key} testID={`sort-${s.key}`} onPress={async () => { setSort(s.key); await load(coords, { sort: s.key, maxDistance, minRating, maxPrice, search }); }}
            style={[styles.chip, sort === s.key && styles.chipActive]}>
            <Ionicons name={s.icon as any} size={13} color={sort === s.key ? "#FFFFFF" : COLORS.textDim} />
            <Text style={[styles.chipText, sort === s.key && styles.chipTextActive]}>{s.label}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      <FlatList
        data={shops}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 100, gap: 14 }}
        ListEmptyComponent={
          loading ? (
            <View style={{ marginTop: 8 }}>
              <SkeletonShopCard />
              <SkeletonShopCard />
              <SkeletonShopCard />
            </View>
          ) : (
            <EmptyState
              icon="search-outline"
              title="Tidak ada hasil"
              description="Tidak ada barbershop yang cocok dengan filter ini. Coba ubah kata kunci atau reset filter."
              actionLabel="Reset Filter"
              onAction={() => { resetFilter(); setSearch(""); load(coords, { sort: "terdekat", maxDistance: null, minRating: null, maxPrice: null, search: "" }); }}
            />
          )
        }
        renderItem={({ item }) => (
          <PressableScale testID={`explore-shop-${item.id}`} style={styles.card} onPress={() => router.push(`/(customer)/shop/${item.id}` as any)} scaleTo={0.97}>
            <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
            {item.distance_km !== null && (
              <View style={styles.distBadge}>
                <Ionicons name="navigate" size={11} color={COLORS.brand} />
                <Text style={styles.distText}>{formatJarak(item.distance_km)}</Text>
              </View>
            )}
            <LinearGradient colors={["rgba(10,37,64,0)", "rgba(10,37,64,0.55)"]} style={styles.cardScrim} pointerEvents="none" />
            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {item.rating > 0 && (
                  <View style={styles.ratePill}>
                    <Ionicons name="star" size={11} color={COLORS.gold} />
                    <Text style={styles.rateText}>{item.rating?.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.addrRow}>
                <Ionicons name="location-outline" size={12} color={COLORS.textDim} />
                <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
              </View>
              <View style={styles.cardRow}>
                <View style={styles.rateBox}>
                  <Text style={styles.rateCount}>({item.reviews_count} ulasan)</Text>
                  {item.booking_count > 0 && <Text style={styles.rateCount}>· {item.booking_count}x dipesan</Text>}
                </View>
                <Text style={styles.price}>{item.price_range}</Text>
              </View>
            </View>
          </PressableScale>
        )}
      />

      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.grabber} />
            <View style={styles.modalHeadRow}>
              <Text style={styles.modalTitle}>Filter & Urutkan</Text>
              <PressableScale onPress={resetFilter} scaleTo={0.95}><Text style={styles.resetText}>Reset</Text></PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Urutkan</Text>
              <View style={styles.optRow}>
                {SORTS.map((s) => (
                  <PressableScale key={s.key} onPress={() => setDraft({ ...draft, sort: s.key })} style={[styles.optChip, draft.sort === s.key && styles.optChipActive]} scaleTo={0.95}>
                    <Ionicons name={s.icon as any} size={13} color={draft.sort === s.key ? "#FFFFFF" : COLORS.textDim} />
                    <Text style={[styles.optChipText, draft.sort === s.key && styles.optChipTextActive]}>{s.label}</Text>
                  </PressableScale>
                ))}
              </View>

              <Text style={styles.filterLabel}>Jarak Maksimal</Text>
              <View style={styles.optRow}>
                {DISTANCE_OPTIONS.map((d) => (
                  <PressableScale key={d.label} onPress={() => setDraft({ ...draft, maxDistance: d.key })} style={[styles.optChip, draft.maxDistance === d.key && styles.optChipActive]} scaleTo={0.95}>
                    <Text style={[styles.optChipText, draft.maxDistance === d.key && styles.optChipTextActive]}>{d.label}</Text>
                  </PressableScale>
                ))}
              </View>

              <Text style={styles.filterLabel}>Rating Minimal</Text>
              <View style={styles.optRow}>
                {RATING_OPTIONS.map((r) => (
                  <PressableScale key={r.label} onPress={() => setDraft({ ...draft, minRating: r.key })} style={[styles.optChip, draft.minRating === r.key && styles.optChipActive]} scaleTo={0.95}>
                    <Text style={[styles.optChipText, draft.minRating === r.key && styles.optChipTextActive]}>{r.label}</Text>
                  </PressableScale>
                ))}
              </View>

              <Text style={styles.filterLabel}>Harga Maksimal</Text>
              <View style={styles.optRow}>
                {PRICE_OPTIONS.map((p) => (
                  <PressableScale key={p.label} onPress={() => setDraft({ ...draft, maxPrice: p.key })} style={[styles.optChip, draft.maxPrice === p.key && styles.optChipActive]} scaleTo={0.95}>
                    <Text style={[styles.optChipText, draft.maxPrice === p.key && styles.optChipTextActive]}>{p.label}</Text>
                  </PressableScale>
                ))}
              </View>

              <PressableScale style={styles.applyBtn} onPress={applyFilter} testID="apply-filter" haptic>
                <Text style={styles.applyBtnText}>TERAPKAN FILTER</Text>
              </PressableScale>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, letterSpacing: -0.3 },
  headerSub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginTop: 12 },
  searchWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, paddingHorizontal: 16,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 14, fontFamily: FONT.medium, fontSize: 14 },
  filterBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.brand },
  filterBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: "#FFFFFF" },
  filterBadgeText: { color: "#FFFFFF", fontSize: 9, fontFamily: FONT.bold },
  chipRow: { gap: 8, alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.semibold },
  chipTextActive: { color: "#FFFFFF" },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4,
  },
  cardImg: { width: "100%", height: 170 },
  cardScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80 },
  distBadge: {
    position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  distText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11 },
  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardName: { color: COLORS.text, fontSize: 16, fontFamily: FONT.extrabold, flex: 1 },
  ratePill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFF9EC", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rateText: { color: "#B45309", fontFamily: FONT.bold, fontSize: 11 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardAddr: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, flex: 1 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  rateBox: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  rateCount: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium },
  price: { color: COLORS.brand, fontSize: 12, fontFamily: FONT.bold },
  modalBg: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: {
    backgroundColor: COLORS.surface, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "80%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 20,
  },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.borderStrong, alignSelf: "center", marginBottom: 16 },
  modalHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontFamily: FONT.extrabold },
  resetText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 13 },
  filterLabel: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.bold, marginTop: 16, marginBottom: 8, letterSpacing: 0.3 },
  optRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border },
  optChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  optChipText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.semibold },
  optChipTextActive: { color: "#FFFFFF" },
  applyBtn: {
    backgroundColor: COLORS.brand, padding: 16, borderRadius: 16, alignItems: "center", marginTop: 24, marginBottom: 8,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5,
  },
  applyBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
});