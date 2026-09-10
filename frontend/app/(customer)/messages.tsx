import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonRow } from "@/src/components/Skeleton";

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function waktuRelatif(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":");
  if (diffDays === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function Messages() {
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Cari lokal (judul/sub/pratinjau) — thread tidak punya endpoint search,
  // jadi filter dilakukan di klien. Tanpa endpoint baru.
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? threads.filter((t: any) =>
        `${t.title || ""} ${t.subtitle || ""} ${t.last_message?.text || ""}`.toLowerCase().includes(q))
    : threads;

  // Layar ini di-refetch tiap kali difokuskan (lihat useFocusEffect di bawah) —
  // jangan tampilkan skeleton lagi kalau sudah pernah dimuat, supaya perpindahan
  // tab tidak terasa mengosongkan lalu memuat ulang setiap kali (hasLoadedRef).
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/messages/threads"); setThreads(r.threads || []); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const previewText = (t: any) => {
    if (!t.last_message) return "Belum ada pesan — mulai obrolan";
    if (t.last_message.attachment && !t.last_message.text) return "📎 Lampiran";
    return t.last_message.text || "";
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pesan</Text>
          <Text style={styles.sub}>Obrolan dengan toko & barber</Text>
        </View>
        <PressableScale testID="msg-search-btn" style={styles.iconBtn} onPress={() => setShowSearch((v) => !v)} scaleTo={0.92}>
          <Ionicons name="search" size={20} color={COLORS.text} />
        </PressableScale>
      </View>

      {showSearch && !loading && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textDim} />
          <TextInput
            testID="msg-search-input"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Cari obrolan..."
            placeholderTextColor={COLORS.textDim}
          />
          {!!query && (
            <PressableScale onPress={() => setQuery("")} scaleTo={0.9}>
              <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
            </PressableScale>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyArt}>
            <Ionicons name="chatbubbles" size={64} color={COLORS.brandLight} />
            <View style={styles.emptyScissors}>
              <Ionicons name="cut" size={20} color={COLORS.text} />
            </View>
          </View>
          <Text style={styles.emptyTitle}>Belum ada percakapan</Text>
          <Text style={styles.emptyDesc}>
            Chat kamu dengan barbershop atau StreetBarber akan muncul di sini.
          </Text>
          <PressableScale
            style={styles.emptyBtn}
            onPress={() => router.push("/(customer)/explore" as any)}
            scaleTo={0.97}
            haptic
          >
            <Text style={styles.emptyBtnText}>Cari barbershop</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
          </PressableScale>
        </View>
      ) : shown.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Tidak ketemu"
          description={`Tidak ada obrolan yang cocok dengan "${query}".`}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120 }}>
          {shown.map((t, i) => (
            <PressableScale
              key={`${t.booking_id}-${t.type}-${i}`}
              testID={`thread-${t.type}-${t.booking_id}`}
              style={[styles.row, t.unread > 0 ? styles.rowUnread : styles.rowRead]}
              onPress={() => router.push(t.type === "barber" ? `/chat/booking/${t.booking_id}` : `/chat/owner/${t.booking_id}`)}
              scaleTo={0.98}
            >
              {t.image ? (
                <Image source={{ uri: t.image }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{(t.title || "?")[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, t.unread > 0 && styles.nameBold]} numberOfLines={1}>{t.title}</Text>
                  {t.last_message && (
                    <Text style={[styles.time, t.unread > 0 && styles.timeUnread]}>{waktuRelatif(t.updated_at)}</Text>
                  )}
                </View>
                {t.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{t.subtitle}</Text> : null}
                <Text style={[styles.preview, t.unread > 0 && styles.previewBold]} numberOfLines={2}>{previewText(t)}</Text>
              </View>
              {t.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{t.unread > 99 ? "99+" : t.unread}</Text>
                </View>
              )}
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 10 },
  iconBtn: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  title: { color: COLORS.text, fontSize: 28, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  sub: { color: COLORS.textDim, fontSize: 13, fontFamily: FONT.medium, marginTop: 2 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginHorizontal: 16, marginBottom: 8,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 11, fontFamily: FONT.medium, fontSize: 14 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadowStrong, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  rowUnread: { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  rowRead: { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0, elevation: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border, borderRadius: 0, paddingVertical: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.surface2 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 20 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 14, flex: 1 },
  nameBold: { fontFamily: FONT.extrabold },
  time: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, flexShrink: 0 },
  timeUnread: { color: COLORS.brandLight, fontFamily: FONT.bold },
  subtitle: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 1 },
  preview: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 3 },
  previewBold: { color: COLORS.textMuted, fontFamily: FONT.semibold },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 4 },
  unreadText: { color: COLORS.onBrand, fontSize: 11, fontFamily: FONT.bold },
  emptyWrap: { flex: 1, alignItems: "center", paddingHorizontal: 32, paddingTop: 56 },
  emptyArt: {
    width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.brandDim,
    alignItems: "center", justifyContent: "center",
  },
  emptyScissors: {
    position: "absolute", right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold, marginTop: 28, textAlign: "center" },
  emptyDesc: { color: COLORS.textDim, fontSize: 14, fontFamily: FONT.medium, marginTop: 10, textAlign: "center", lineHeight: 21 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.brand,
    paddingVertical: 16, paddingHorizontal: 28, borderRadius: 18, marginTop: 24, minHeight: 54,
    shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 5,
  },
  emptyBtnText: { color: COLORS.onBrand, fontFamily: FONT.extrabold, fontSize: 15 },
});
