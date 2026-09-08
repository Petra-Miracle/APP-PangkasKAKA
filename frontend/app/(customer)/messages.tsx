import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonRow } from "@/src/components/Skeleton";

function waktuRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const menit = Math.floor(diff / 60000);
  if (menit < 1) return "Baru saja";
  if (menit < 60) return `${menit}m lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam}j lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari}h lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function Messages() {
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/messages/threads"); setThreads(r.threads || []); } catch {} finally { setLoading(false); }
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
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pesan</Text>
          <Text style={styles.sub}>Percakapan dengan toko & barber</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : threads.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Belum ada percakapan"
          description="Booking pertamamu akan muncul di sini untuk mulai chat dengan toko atau barber."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120 }}>
          {threads.map((t, i) => (
            <PressableScale
              key={`${t.booking_id}-${t.type}-${i}`}
              testID={`thread-${t.type}-${t.booking_id}`}
              style={[styles.row, t.unread > 0 && styles.rowUnread]}
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
                  {t.last_message && <Text style={styles.time}>{waktuRelatif(t.updated_at)}</Text>}
                </View>
                {t.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{t.subtitle}</Text> : null}
                <Text style={[styles.preview, t.unread > 0 && styles.previewBold]} numberOfLines={1}>{previewText(t)}</Text>
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
  headerBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  sub: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  rowUnread: { borderColor: COLORS.brandDim, backgroundColor: "#FAFCFF" },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.surface2 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 20 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { color: COLORS.text, fontFamily: FONT.semibold, fontSize: 14, flex: 1 },
  nameBold: { fontFamily: FONT.extrabold },
  time: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, flexShrink: 0 },
  subtitle: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.medium, marginTop: 1 },
  preview: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 3 },
  previewBold: { color: COLORS.textMuted, fontFamily: FONT.semibold },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 4 },
  unreadText: { color: "#FFFFFF", fontSize: 11, fontFamily: FONT.bold },
});
