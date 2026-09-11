import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { api, COLORS, FONT } from "@/src/lib/api";
import { useScrollToInput } from "@/src/lib/useScrollToInput";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";
import Skeleton, { SkeletonRow } from "@/src/components/Skeleton";

export default function AdminAccounts() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [scopeEditId, setScopeEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { scrollRef, handleFocus } = useScrollToInput();

  // Refetch tiap fokus (useFocusEffect di bawah) — skeleton cuma di load pertama,
  // supaya pindah tab-tab tidak mengosongkan layar yang sudah terisi.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [a, s] = await Promise.all([
        api.get("/superadmin/admins"),
        api.get("/shops?sort=rating"),
      ]);
      setAdmins(a.admins);
      setShops(s.shops);
    } catch {} finally { setLoading(false); hasLoadedRef.current = true; }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => { setForm({ name: "", email: "", phone: "" }); setSelectedShopIds([]); setScopeEditId(null); };

  const toggleShop = (id: string) => {
    setSelectedShopIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const startEditScope = (a: any) => {
    setScopeEditId(a.id);
    setSelectedShopIds(a.managed_shop_ids || []);
  };

  const showPasswordOnce = (email: string, password: string) => {
    Alert.alert(
      "Password Dibuat",
      `Email: ${email}\nPassword: ${password}\n\nSalin & sampaikan ke Admin yang bersangkutan secara manual — password ini tidak akan ditampilkan lagi.`
    );
  };

  const submit = async () => {
    if (scopeEditId) {
      setSaving(true);
      try {
        await api.put(`/superadmin/admins/${scopeEditId}`, { managed_shop_ids: selectedShopIds });
        resetForm();
        await load();
      } catch (e: any) { alert(e.message); }
      setSaving(false);
      return;
    }
    if (!form.name || !form.email || !form.phone) { alert("Nama, email, dan no HP wajib diisi"); return; }
    setSaving(true);
    try {
      const r = await api.post("/superadmin/admins", { ...form, managed_shop_ids: selectedShopIds });
      resetForm();
      await load();
      showPasswordOnce(r.admin.email, r.password);
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const resetPassword = (a: any) => {
    Alert.alert("Reset Password", `Buat password baru untuk ${a.name}? Password lama tidak akan berlaku lagi.`, [
      { text: "Batal", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: async () => {
          try { const r = await api.post(`/superadmin/admins/${a.id}/reset-password`); showPasswordOnce(a.email, r.password); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  const toggleSuspend = (a: any) => {
    const suspending = !a.is_suspended;
    Alert.alert(
      suspending ? "Nonaktifkan Admin" : "Aktifkan Kembali",
      suspending ? `Yakin ingin menonaktifkan ${a.name}? Admin ini tidak akan bisa login sampai diaktifkan kembali.` : `Aktifkan kembali akun ${a.name}?`,
      [
        { text: "Batal", style: "cancel" },
        { text: suspending ? "Nonaktifkan" : "Aktifkan", style: suspending ? "destructive" : "default", onPress: async () => {
            try {
              if (suspending) await api.post(`/admin/users/${a.id}/suspend`, {});
              else await api.post(`/admin/users/${a.id}/activate`);
              await load();
            } catch (e: any) { alert(e.message); }
          } },
      ]
    );
  };

  const remove = (a: any) => {
    Alert.alert("Hapus Akun Admin", `Yakin ingin menghapus akun ${a.name}? Aksi ini tidak bisa dibatalkan.`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
          try { if (scopeEditId === a.id) resetForm(); await api.del(`/admin/users/${a.id}`); await load(); }
          catch (e: any) { alert(e.message); }
        } },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.navyGradStart, COLORS.navyGradMid, COLORS.navyGradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navyHeader}>
        <Skeleton style={{ height: 12, width: 110, backgroundColor: "rgba(255,255,255,0.25)" }} />
        <Skeleton style={{ height: 24, width: 200, marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)" }} />
      </LinearGradient>
      <View style={{ padding: 20, gap: 10 }}>
        <SkeletonRow />
        <SkeletonRow />
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
        <View style={styles.badge}><Ionicons name="shield" size={12} color={COLORS.gold} /><Text style={styles.badgeText}>VALIDATOR STREETBARBER</Text></View>
        <Text style={styles.headerTitle}>Kelola Admin</Text>
        <Text style={styles.headerSub}>{admins.length} akun Admin — memvalidasi pelamar StreetBarber per toko</Text>
      </LinearGradient>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {admins.length === 0 && (
          <EmptyState
            icon="shield-outline"
            title="Belum ada akun Admin"
            description="Buat akun Admin di bawah untuk mulai memvalidasi pelamar StreetBarber pada toko tertentu."
          />
        )}
        {admins.map((a: any) => (
          <View key={a.id} style={styles.item} testID={`admin-${a.id}`}>
            <View style={styles.itemTop}>
              <View style={[styles.avatar, a.is_suspended && { backgroundColor: COLORS.surface2 }]}>
                <Text style={[styles.avatarText, a.is_suspended && { color: COLORS.textDim }]}>{a.name?.[0]?.toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{a.name}</Text>
                <Text style={styles.itemMeta}>{a.email}</Text>
              </View>
              {a.is_suspended && (
                <View style={styles.suspendedBadge}><Text style={styles.suspendedBadgeText}>NONAKTIF</Text></View>
              )}
            </View>
            <View style={styles.shopChips}>
              {(a.managed_shops || []).length === 0 ? (
                <Text style={styles.noShopText}>Belum ada toko di-assign</Text>
              ) : a.managed_shops.map((s: any) => (
                <View key={s.id} style={styles.shopChip}><Text style={styles.shopChipText} numberOfLines={1}>{s.name}</Text></View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <PressableScale style={styles.actionBtn} onPress={() => startEditScope(a)} testID={`edit-scope-${a.id}`} scaleTo={0.95}>
                <Ionicons name="storefront-outline" size={14} color={COLORS.brand} />
                <Text style={styles.actionBtnText}>Cakupan Toko</Text>
              </PressableScale>
              <PressableScale style={styles.actionBtn} onPress={() => resetPassword(a)} testID={`reset-pw-${a.id}`} scaleTo={0.95}>
                <Ionicons name="key-outline" size={14} color={COLORS.brand} />
                <Text style={styles.actionBtnText}>Reset Password</Text>
              </PressableScale>
              <PressableScale style={styles.actionBtn} onPress={() => toggleSuspend(a)} testID={`suspend-${a.id}`} scaleTo={0.95}>
                <Ionicons name={a.is_suspended ? "checkmark-circle-outline" : "pause-circle-outline"} size={14} color={a.is_suspended ? COLORS.success : COLORS.warning} />
                <Text style={[styles.actionBtnText, { color: a.is_suspended ? COLORS.success : COLORS.warning }]}>{a.is_suspended ? "Aktifkan" : "Nonaktifkan"}</Text>
              </PressableScale>
              <PressableScale style={styles.actionBtn} onPress={() => remove(a)} testID={`del-admin-${a.id}`} scaleTo={0.95}>
                <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Hapus</Text>
              </PressableScale>
            </View>
          </View>
        ))}

        <View style={styles.card}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>{scopeEditId ? "Edit Cakupan Toko" : "Tambah Admin Baru"}</Text>
            {scopeEditId && (
              <PressableScale onPress={resetForm} scaleTo={0.9}>
                <Text style={styles.cancelEditText}>Batal</Text>
              </PressableScale>
            )}
          </View>

          {!scopeEditId && (
            <>
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Nama lengkap" placeholderTextColor={COLORS.textDim} testID="new-admin-name" onFocus={handleFocus} />
              <TextInput style={styles.input} value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} placeholder="Email" placeholderTextColor={COLORS.textDim} keyboardType="email-address" autoCapitalize="none" testID="new-admin-email" onFocus={handleFocus} />
              <TextInput style={styles.input} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} placeholder="Nomor HP" placeholderTextColor={COLORS.textDim} keyboardType="phone-pad" testID="new-admin-phone" onFocus={handleFocus} />
            </>
          )}

          <Text style={styles.pickLabel}>PILIH TOKO YANG DIKELOLA</Text>
          <View style={styles.shopPickWrap}>
            {shops.length === 0 && <Text style={styles.noShopText}>Belum ada toko terverifikasi.</Text>}
            {shops.map((s: any) => {
              const selected = selectedShopIds.includes(s.id);
              return (
                <PressableScale key={s.id} testID={`pick-shop-${s.id}`} onPress={() => toggleShop(s.id)} style={[styles.shopPickChip, selected && styles.shopPickChipActive]} scaleTo={0.96}>
                  <Text style={[styles.shopPickChipText, selected && { color: "#FFFFFF" }]} numberOfLines={1}>{s.name}</Text>
                  {selected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </PressableScale>
              );
            })}
          </View>

          <PressableScale style={[styles.btnWrap, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving} testID="submit-admin" haptic>
            <LinearGradient
              colors={[COLORS.brandGradStart, COLORS.brandGradMid, COLORS.brandGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{saving ? "..." : scopeEditId ? "SIMPAN CAKUPAN" : "TAMBAH ADMIN"}</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  navyHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", shadowColor: COLORS.sidebar, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  headerDeco: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -70, right: -40 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.5 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONT.extrabold, marginTop: 10 },
  headerSub: { color: COLORS.sidebarTextDim, fontSize: 12, fontFamily: FONT.medium, marginTop: 4 },

  item: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.brand, fontFamily: FONT.extrabold, fontSize: 18 },
  itemName: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 14 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginTop: 1, fontFamily: FONT.medium },
  suspendedBadge: { backgroundColor: "#FEF2F2", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  suspendedBadgeText: { color: COLORS.error, fontSize: 10, fontFamily: FONT.bold, letterSpacing: 0.4 },
  shopChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  shopChip: { backgroundColor: COLORS.brandDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 160 },
  shopChipText: { color: COLORS.brand, fontSize: 11, fontFamily: FONT.semibold },
  noShopText: { color: COLORS.textDim, fontSize: 12, fontFamily: FONT.medium },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.surface2, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  actionBtnText: { color: COLORS.brand, fontSize: 11, fontFamily: FONT.bold },

  card: {
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 18, marginTop: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  cancelEditText: { color: COLORS.textDim, fontFamily: FONT.semibold, fontSize: 12 },
  input: {
    backgroundColor: COLORS.surface2, color: COLORS.text, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontFamily: FONT.medium, fontSize: 14, marginBottom: 10,
  },
  pickLabel: { color: COLORS.textDim, letterSpacing: 0.8, fontSize: 10, fontFamily: FONT.bold, marginBottom: 8, marginTop: 2 },
  shopPickWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  shopPickChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 200,
  },
  shopPickChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  shopPickChipText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.semibold },
  btnWrap: { borderRadius: 14, marginTop: 4, overflow: "hidden", shadowColor: COLORS.brand, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  btn: { padding: 14, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontFamily: FONT.extrabold, letterSpacing: 1 },
});
