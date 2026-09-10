import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton from "@/src/components/Skeleton";

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: COLORS.success, bg: "#ECFDF5", label: "STREETBARBER AKTIF" },
  rejected: { color: COLORS.error, bg: "#FEF2F2", label: "DITOLAK" },
  pending: { color: COLORS.warning, bg: "#FFF7ED", label: "MENUNGGU VALIDASI" },
  seleksi_berkas_lolos: { color: COLORS.info, bg: "#EFF8FF", label: "BERKAS LOLOS" },
  menunggu_tes: { color: COLORS.info, bg: "#EFF8FF", label: "MENUNGGU TES" },
};

export default function ApplicationsHistory() {
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try { const r = await api.get("/karyawan/my"); setApps(r.applications || []); } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Riwayat Lamaran</Text>
      </View>
      <View style={{ padding: 16, gap: 10 }}><Skeleton style={{ height: 100 }} /><Skeleton style={{ height: 100 }} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()} scaleTo={0.92}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Riwayat Lamaran</Text>
      </View>
      {apps.length === 0 ? (
        <EmptyState icon="briefcase-outline" title="Belum ada lamaran" description="Semua lamaranmu akan muncul di sini." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 8 }}>
          {apps.map((a: any) => {
            const meta = STATUS_META[a.status] || STATUS_META.pending;
            return (
              <View key={a.id} style={styles.appCard}>
                <View style={styles.rowTop}>
                  <Image source={{ uri: a.shop?.image }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cName}>{a.shop?.name}</Text>
                    <Text style={styles.cMeta}>Skor: {a.total_score}/120</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {a.status === "active" && (
                  <View style={styles.congrats}>
                    <View style={styles.trophyWrap}><Ionicons name="trophy" size={14} color={COLORS.success} /></View>
                    <Text style={styles.congratsText}>Anda resmi menjadi StreetBarber, tervalidasi oleh toko ini!</Text>
                  </View>
                )}
                {["menunggu_tes", "seleksi_berkas_lolos", "active"].includes(a.status) && (
                  <PressableScale style={styles.chatBtnWrap} onPress={() => router.push(`/chat/recruitment/${a.id}` as any)} scaleTo={0.96}>
                    <View style={styles.chatBtn}>
                      <Ionicons name="chatbubbles" size={14} color={COLORS.brand} />
                      <Text style={styles.chatBtnText}>CHAT DENGAN VALIDATOR</Text>
                    </View>
                  </PressableScale>
                )}
                {a.status === "rejected" && (
                  <PressableScale style={styles.chatBtnWrap} onPress={() => router.push("/(streetbarber)/dashboard" as any)} scaleTo={0.96}>
                    <View style={styles.chatBtn}>
                      <Ionicons name="refresh" size={14} color={COLORS.brand} />
                      <Text style={styles.chatBtnText}>LAMAR KE TOKO LAIN</Text>
                    </View>
                  </PressableScale>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 22, fontFamily: FONT.extrabold },
  appCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 13 },
  cName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.5 },
  congrats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, backgroundColor: "#ECFDF5", borderRadius: 12 },
  trophyWrap: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  congratsText: { color: COLORS.success, fontFamily: FONT.semibold, fontSize: 12, flex: 1 },
  chatBtnWrap: { borderRadius: 11, marginTop: 10, overflow: "hidden" },
  chatBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
  chatBtnText: { color: COLORS.brand, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.4 },
});
