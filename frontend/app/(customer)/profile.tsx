import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";
import PressableScale from "@/src/components/PressableScale";

const ROLE_LABEL: Record<string, string> = {
  customer: "Pelanggan", owner: "Pemilik Toko", admin: "Admin", superadmin: "Super Admin", streetbarber: "StreetBarber",
};

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const doLogout = async () => { await logout(); router.replace("/(auth)/login"); };
  const showAccount = user?.role === "customer" || user?.role === "owner" || user?.role === "streetbarber";
  const showActivity = user?.role === "customer" || user?.role === "streetbarber" || user?.role === "superadmin";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={styles.title}>Akun</Text>

        <View style={styles.profileCard}>
          <View>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "?"}</Text>
              </View>
            )}
            <PressableScale
              style={styles.cameraBadge}
              onPress={() => router.push("/(customer)/edit-profile" as any)}
              scaleTo={0.9}
            >
              <Ionicons name="camera" size={13} color={COLORS.onBrand} />
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{ROLE_LABEL[user?.role || ""] || user?.role}</Text>
            </View>
            <Text style={styles.name} testID="profile-name" numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.mail} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        {showAccount && (
          <>
            <Text style={styles.sectionLabel}>AKUN</Text>
            <View style={styles.menu}>
              <MenuItem icon="person-circle-outline" label="Edit Profil" sub="Nama dan foto profil" onPress={() => router.push("/(customer)/edit-profile" as any)} testID="menu-edit-profile" />
              <MenuItem icon="lock-closed-outline" label="Ubah Password" sub="Ganti kata sandi akun" last onPress={() => router.push("/(customer)/change-password" as any)} testID="menu-change-password" />
            </View>
          </>
        )}

        {showActivity && (
          <>
            <Text style={styles.sectionLabel}>AKTIVITAS</Text>
            <View style={styles.menu}>
              {user?.role === "customer" && <>
                <MenuItem icon="receipt-outline" label="Riwayat Pesanan" sub="Booking layanan kamu" onPress={() => router.push("/(customer)/orders" as any)} />
                <MenuItem icon="wallet-outline" label="Riwayat Pembayaran" sub="Semua transaksi kamu" onPress={() => router.push("/(customer)/payment-history" as any)} testID="menu-payment-history" />
                <MenuItem icon="bag-handle-outline" label="Pesanan Produk" sub="Belanja dari katalog" onPress={() => router.push("/(customer)/product-orders" as any)} testID="menu-product-orders" />
                <MenuItem icon="sparkles-outline" label="AI Face Scan" sub="Rekomendasi gaya rambut" last onPress={() => router.push("/(customer)/ai-scan" as any)} />
              </>}
              {user?.role === "streetbarber" && <>
                <MenuItem icon="cut-outline" label="Riwayat Layanan" sub="Jumlah & jenis layanan yang sudah diberikan" onPress={() => router.push("/(streetbarber)/service-history" as any)} />
                <MenuItem icon="briefcase-outline" label="Riwayat Lamaran" sub="Lamaran StreetBarber kamu" last onPress={() => router.push("/(streetbarber)/applications" as any)} />
              </>}
              {user?.role === "superadmin" && <>
                <MenuItem icon="shield-checkmark-outline" label="Verifikasi Toko" sub="Tinjau pengajuan toko" onPress={() => router.push("/(superadmin)/verification" as any)} />
                <MenuItem icon="people-outline" label="Pengguna" sub="Kelola pengguna aplikasi" last onPress={() => router.push("/(superadmin)/users" as any)} />
              </>}
            </View>
          </>
        )}

        <PressableScale style={styles.logoutBtn} onPress={doLogout} testID="logout-btn" scaleTo={0.98}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Keluar</Text>
        </PressableScale>
        <Text style={styles.footer}>PangkasKAKA v1.0.0 · Kupang, NTT</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, sub, onPress, testID, last }: any) {
  return (
    <PressableScale
      style={[styles.item, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      testID={testID}
      scaleTo={0.98}
    >
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={20} color={COLORS.brandLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemText}>{label}</Text>
        {!!sub && <Text style={styles.itemSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 30, fontFamily: FONT.extrabold, marginBottom: 16, letterSpacing: -0.5 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, padding: 18,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.brandDim },
  avatarText: { color: COLORS.brandLight, fontSize: 34, fontFamily: FONT.extrabold },
  cameraBadge: {
    position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.surface,
  },
  rolePill: { alignSelf: "flex-start", backgroundColor: COLORS.brandDim, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  rolePillText: { color: COLORS.brandLight, fontSize: 12, fontFamily: FONT.bold },
  name: { color: COLORS.text, fontSize: 21, fontFamily: FONT.extrabold, marginTop: 8 },
  mail: { color: COLORS.textDim, marginTop: 3, fontFamily: FONT.medium, fontSize: 13 },
  sectionLabel: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 1.5, marginTop: 24, marginBottom: 10 },
  menu: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 3 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  itemText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 15 },
  itemSub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: COLORS.error, borderRadius: 18, paddingVertical: 16, marginTop: 24,
    backgroundColor: "#FEF2F2",
  },
  logoutText: { color: COLORS.error, fontFamily: FONT.extrabold, fontSize: 15 },
  footer: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, textAlign: "center", marginTop: 16 },
});