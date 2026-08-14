import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";

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

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.navyHeader}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="schedule-back">
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Atur Jadwal Buka Toko</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.sec}>JADWAL MINGGUAN</Text>
        {rows.map((r) => (
          <View key={r.day_name} style={styles.dayCard} testID={`day-row-${r.day_name}`}>
            <View style={styles.dayHead}>
              <Text style={styles.dayName}>{r.day_name}</Text>
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
                <Text style={styles.timeDash}>—</Text>
                <TextInput style={styles.timeInput} value={r.close_time} onChangeText={(t) => updateRow(r.day_name, { close_time: t })} placeholder="21:00" placeholderTextColor={COLORS.textDim} />
              </View>
            )}
          </View>
        ))}
        <Pressable style={styles.saveBtn} onPress={saveWeekly} disabled={saving} testID="save-weekly-schedule">
          <Text style={styles.saveBtnText}>{saving ? "MENYIMPAN..." : "SIMPAN JADWAL MINGGUAN"}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.sec}>JADWAL KHUSUS TANGGAL</Text>
        <Text style={styles.hint}>Untuk pengecualian di luar jadwal mingguan — misal libur nasional atau jam berbeda di tanggal tertentu.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {nextDays.map((d) => (
            <Pressable key={d.iso} testID={`ov-day-${d.iso}`} onPress={() => setPickedDate(d.iso)} style={[styles.dayChip, pickedDate === d.iso && styles.dayChipActive]}>
              <Text style={[styles.dayChipLabel, pickedDate === d.iso && { color: "#FFFFFF" }]}>{d.day}</Text>
              <Text style={[styles.dayChipNum, pickedDate === d.iso && { color: "#FFFFFF" }]}>{d.date}</Text>
            </Pressable>
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
          <Pressable style={styles.saveBtnSm} onPress={saveOverride} disabled={savingOv} testID="save-override">
            <Text style={styles.saveBtnText}>{savingOv ? "MENYIMPAN..." : `SIMPAN UNTUK ${pickedDate}`}</Text>
          </Pressable>
        </View>

        {overrides.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.subSec}>PENGECUALIAN AKTIF</Text>
            {overrides.map((o) => (
              <View key={o.date} style={styles.ovItem} testID={`ov-item-${o.date}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ovItemDate}>{o.date}</Text>
                  <Text style={styles.ovItemDetail}>
                    {o.is_closed ? "Tutup" : `${o.open_time} - ${o.close_time}`}{o.note ? ` · ${o.note}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => deleteOverride(o.date)} testID={`delete-ov-${o.date}`}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </Pressable>
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
  navyHeader: { backgroundColor: COLORS.sidebar, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 17, fontFamily: FONT.extrabold },
  sec: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.8, marginBottom: 10 },
  subSec: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.8, marginBottom: 8 },
  hint: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium, marginTop: -4, marginBottom: 4, lineHeight: 18 },
  dayCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  dayClosedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayClosedLabel: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  timeInput: { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, textAlign: "center" },
  timeDash: { color: COLORS.textDim, fontFamily: FONT.bold },
  saveBtn: { backgroundColor: COLORS.brand, borderRadius: 14, padding: 14, alignItems: "center", marginTop: 4 },
  saveBtnSm: { backgroundColor: COLORS.brand, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 10 },
  saveBtnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, fontSize: 12, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24 },
  dayChip: { width: 52, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  dayChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  dayChipLabel: { color: COLORS.textDim, fontSize: 11, fontFamily: FONT.semibold },
  dayChipNum: { color: COLORS.text, fontSize: 15, fontFamily: FONT.extrabold, marginTop: 2 },
  ovCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginTop: 8 },
  noteInput: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, marginTop: 10 },
  ovItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  ovItemDate: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 13 },
  ovItemDetail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 2 },
});
