import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";
import Skeleton from "@/src/components/Skeleton";

const DAYS: { key: string; label: string }[] = [
  { key: "Senin", label: "Senin" },
  { key: "Selasa", label: "Selasa" },
  { key: "Rabu", label: "Rabu" },
  { key: "Kamis", label: "Kamis" },
  { key: "Jumat", label: "Jumat" },
  { key: "Sabtu", label: "Sabtu" },
  { key: "Minggu", label: "Minggu" },
];

type DayRow = { day_name: string; open_time: string; close_time: string; is_closed: boolean };
type Override = { date: string; is_closed: boolean; open_time: string; close_time: string; note?: string };

const nextDays = Array.from({ length: 30 }).map((_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i);
  return { iso: d.toISOString().slice(0, 10), day: d.toLocaleDateString("id-ID", { weekday: "short" }), date: d.getDate() };
});

export default function OwnerSchedule() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<DayRow[]>(DAYS.map((d) => ({ day_name: d.key, open_time: "09:00", close_time: "21:00", is_closed: false })));
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [pickedDate, setPickedDate] = useState(nextDays[0].iso);
  const [ovClosed, setOvClosed] = useState(false);
  const [ovOpen, setOvOpen] = useState("09:00");
  const [ovClose, setOvClose] = useState("21:00");
  const [ovNote, setOvNote] = useState("");
  const [savingOv, setSavingOv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.get("/owner/schedules");
      if (s.schedules?.length) {
        setRows(DAYS.map((d) => {
          const found = s.schedules.find((r: DayRow) => r.day_name === d.key);
          return found || { day_name: d.key, open_time: "09:00", close_time: "21:00", is_closed: false };
        }));
      }
      const o = await api.get("/owner/schedule-overrides");
      setOverrides(o.overrides || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRow = (day: string, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((r) => (r.day_name === day ? { ...r, ...patch } : r)));
  };

  const saveWeekly = async () => {
    setSaving(true);
    try {
      await api.post("/owner/schedules", { schedules: rows });
      alert("Jadwal mingguan tersimpan");
    } catch (e: any) { alert(e.message || "Gagal menyimpan jadwal"); }
    setSaving(false);
  };

  const saveOverride = async () => {
    setSavingOv(true);
    try {
      await api.post("/owner/schedule-overrides", { date: pickedDate, is_closed: ovClosed, open_time: ovOpen, close_time: ovClose, note: ovNote });
      setOvNote("");
      await load();
    } catch (e: any) { alert(e.message || "Gagal menyimpan pengecualian"); }
    setSavingOv(false);
  };

  const deleteOverride = async (date: string) => {
    try { await api.del(`/owner/schedule-overrides/${date}`); await load(); }
    catch (e: any) { alert(e.message || "Gagal menghapus"); }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <View style={styles.backBtn}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></View>
        <Skeleton style={{ height: 18, width: 200, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 10 }}>
        <Skeleton style={{ height: 76 }} />
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
        <PressableScale onPress={() => router.back()} style={styles.backBtn} testID="schedule-back" scaleTo={0.88}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </PressableScale>
        <Text style={styles.headerTitle}>Atur Jadwal Buka Toko</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.sec}>JADWAL MINGGUAN</Text>
        {rows.map((r) => (
          <View key={r.day_name} style={styles.dayCard} testID={`day-row-${r.day_name}`}>
            <View style={styles.dayHead}>
              <View style={styles.dayNameRow}>
                <View style={styles.dayIcon}><Ionicons name="calendar" size={14} color={COLORS.brand} /></View>
                <Text style={styles.dayName}>{r.day_name}</Text>
              </View>
              <View style={styles.dayClosedRow}>
                <Text style={styles.dayClosedLabel}>Tutup</Text>
                <Switch
                  value={r.is_closed}
                  onValueChange={(v) => updateRow(r.day_name, { is_closed: v })}
                  trackColor={{ false: COLORS.border, true: "#FCA5A5" }}
                  thumbColor={r.is_closed ? COLORS.error : COLORS.textDim}
                />
              </View>
            </View>
            {!r.is_closed && (
              <View style={styles.timeRow}>
                <TextInput style={styles.timeInput} value={r.open_time} onChangeText={(t) => updateRow(r.day_name, { open_time: t })} placeholder="09:00" placeholderTextColor={COLORS.textDim} />
                <View style={styles.dashDot} />
                <Text style={styles.timeDash}>—</Text>
                <View style={styles.dashDot} />
                <TextInput style={styles.timeInput} value={r.close_time} onChangeText={(t) => updateRow(r.day_name, { close_time: t })} placeholder="21:00" placeholderTextColor={COLORS.textDim} />
              </View>
            )}
          </View>
        ))}
        <PressableScale style={styles.saveBtnWrap} onPress={saveWeekly} disabled={saving} testID="save-weekly-schedule" haptic>
          <LinearGradient
            colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>{saving ? "MENYIMPAN..." : "SIMPAN JADWAL MINGGUAN"}</Text>
          </LinearGradient>
        </PressableScale>

        <View style={styles.divider} />

        <Text style={styles.sec}>JADWAL KHUSUS TANGGAL</Text>
        <Text style={styles.hint}>Untuk pengecualian di luar jadwal mingguan — misal libur nasional atau jam berbeda di tanggal tertentu.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {nextDays.map((d) => (
            <PressableScale key={d.iso} testID={`ov-day-${d.iso}`} onPress={() => setPickedDate(d.iso)} style={[styles.dayChip, pickedDate === d.iso && styles.dayChipActive]} scaleTo={0.92}>
              <Text style={[styles.dayChipLabel, pickedDate === d.iso && { color: "rgba(255,255,255,0.85)" }]}>{d.day}</Text>
              <Text style={[styles.dayChipNum, pickedDate === d.iso && { color: "#FFFFFF" }]}>{d.date}</Text>
            </PressableScale>
          ))}
        </ScrollView>

        <View style={styles.ovCard}>
          <View style={styles.dayClosedRow}>
            <Text style={styles.dayClosedLabel}>Tutup di tanggal ini</Text>
            <Switch value={ovClosed} onValueChange={setOvClosed} trackColor={{ false: COLORS.border, true: "#FCA5A5" }} thumbColor={ovClosed ? COLORS.error : COLORS.textDim} />
          </View>
          {!ovClosed && (
            <View style={styles.timeRow}>
              <TextInput style={styles.timeInput} value={ovOpen} onChangeText={setOvOpen} placeholder="09:00" placeholderTextColor={COLORS.textDim} />
              <Text style={styles.timeDash}>—</Text>
              <TextInput style={styles.timeInput} value={ovClose} onChangeText={setOvClose} placeholder="21:00" placeholderTextColor={COLORS.textDim} />
            </View>
          )}
          <TextInput style={styles.noteInput} value={ovNote} onChangeText={setOvNote} placeholder="Catatan (mis. Libur Natal)" placeholderTextColor={COLORS.textDim} />
          <PressableScale style={styles.saveBtnSmWrap} onPress={saveOverride} disabled={savingOv} testID="save-override" haptic>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtnSm}
            >
              <Text style={styles.saveBtnText}>{savingOv ? "MENYIMPAN..." : `SIMPAN UNTUK ${pickedDate}`}</Text>
            </LinearGradient>
          </PressableScale>
        </View>

        {overrides.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.subSec}>PENGECUALIAN AKTIF</Text>
            {overrides.map((o) => (
              <View key={o.date} style={styles.ovItem} testID={`ov-item-${o.date}`}>
                <View style={styles.ovItemIcon}>
                  <Ionicons name={o.is_closed ? "lock-closed" : "calendar"} size={16} color={o.is_closed ? COLORS.error : COLORS.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ovItemDate}>{o.date}</Text>
                  <Text style={styles.ovItemDetail}>
                    {o.is_closed ? "Tutup" : `${o.open_time} - ${o.close_time}`}{o.note ? ` · ${o.note}` : ""}
                  </Text>
                </View>
                <PressableScale onPress={() => deleteOverride(o.date)} testID={`delete-ov-${o.date}`} scaleTo={0.85}>
                  <View style={styles.trashBtn}><Ionicons name="trash-outline" size={16} color={COLORS.error} /></View>
                </PressableScale>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.05)", top: -55, right: -30 },
  backBtn: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 17, fontFamily: FONT.extrabold },
  sec: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.8, marginBottom: 10 },
  subSec: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.8, marginBottom: 8 },
  hint: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: -4, marginBottom: 4, lineHeight: 18 },
  dayCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  dayName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  dayClosedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayClosedLabel: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  timeInput: {
    flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, textAlign: "center",
  },
  timeDash: { color: COLORS.textDim, fontFamily: FONT.bold },
  dashDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  saveBtnWrap: { borderRadius: 14, marginTop: 4, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 14 },
  saveBtnSmWrap: { borderRadius: 12, marginTop: 10, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  saveBtnSm: { padding: 12, alignItems: "center" },
  saveBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 12, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24 },
  dayChip: {
    width: 52, alignItems: "center", paddingVertical: 10, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  dayChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  dayChipLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold },
  dayChipNum: { color: COLORS.text, fontSize: 15, fontFamily: FONT.extrabold, marginTop: 2 },
  ovCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginTop: 8,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  noteInput: {
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, marginTop: 10,
  },
  ovItem: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12, marginBottom: 8,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  },
  ovItemIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  ovItemDate: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  ovItemDetail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
  trashBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
});