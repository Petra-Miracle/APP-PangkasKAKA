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

export default function StreetBarberMessages() {
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? threads.filter((t: any) =>
        `${t.title || ""} ${t.subtitle || ""} ${t.last_message?.text || ""}`.toLowerCase().includes(q))
    : threads;

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/messages/threads"); setThreads(r.threads || []); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const previewText = (t: any) => {
    if (!t.last_message) return t.type === "recruitment" ? "Belum ada pesan — tanya validator" : "Belum ada pesan — mulai obrolan";
    if (t.last_message.attachment && !t.last_message.text) return "📎 Lampiran";
    return t.last_message.text || "";
  };

  const openThread = (t: any) =>
    router.push((t.type === "recruitment" ? `/chat/recruitment/${t.karyawan_id}` : `/chat/booking/${t.booking_id}`) as any);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pesan</Text>
          <Text style={styles.sub}>Obrolan dengan pelanggan & toko validator</Text>
        </View>
        <PressableScale testID="sb-msg-search-btn" style={styles.iconBtn} onPress={() => setShowSearch((v) => !v)} scaleTo={0.92}>
          <Ionicons name="search" size={20} color={COLORS.text} />
        </PressableScale>
      </View>

      {showSearch && !loading && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textDim} />
          <TextInput
            testID="sb-msg-search-input"
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
            Chat dengan pelanggan panggilanmu dan toko validator lamaranmu akan muncul di sini.
          </Text>
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
              key={`${t.type}-${t.booking_id || t.karyawan_id}-${i}`}
              testID={`sb-thread-${t.type}-${t.booking_id || t.karyawan_id}`}
              style={[styles.row, t.unread > 0 ? styles.rowUnread : styles.rowRead]}
              onPress={() => openThread(t)}
              scaleTo={0.98}
            >
              {t.image ? (
                <Image source={{ uri: t.image }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name={t.type === "recruitment" ? "briefcase" : "person"} size={22} color={COLORS.brandLight} />
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
});
