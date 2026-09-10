import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { api, COLORS, FONT, formatJarak } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import PressableScale from "@/src/components/PressableScale";
import EmptyState from "@/src/components/EmptyState";

// MapLibre tidak jalan di web build — file .web.tsx ini otomatis dipilih Metro
// saat build untuk web: daftar tekstual saja, peta penuh tetap di aplikasi mobile.
export default function StreetBarberMapWeb() {
  const router = useRouter();
  const { user } = useAuth();
  const [barbers, setBarbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let c: { lat: number; lng: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      } catch {}
      if (!c) c = user?.lat != null && user?.lng != null ? { lat: user.lat, lng: user.lng } : { lat: -10.1789, lng: 123.607 };
      const r = await api.get(`/barbers/nearby?lat=${c.lat}&lng=${c.lng}`);
      setBarbers(r.barbers || []);
    } catch { setBarbers([]); } finally { setLoading(false); }
  }, [user?.lat, user?.lng]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={styles.backRow}>
          <PressableScale onPress={() => router.back()} style={styles.back} testID="map-back" scaleTo={0.9}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </PressableScale>
          <View>
            <Text style={styles.title}>StreetBarber Terdekat</Text>
            <Text style={styles.sub}>Maksimal 9,2 km darimu</Text>
          </View>
        </View>
        {barbers.length === 0 ? (
          <EmptyState
            icon="bicycle-outline"
            title="Belum ada yang online"
            description="Tidak ada StreetBarber dalam radius 9,2 km saat ini. Coba lagi nanti atau jelajahi barbershop."
            actionLabel="Jelajah Barbershop"
            onAction={() => router.push("/(customer)/explore" as any)}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {barbers.map((b: any) => (
              <PressableScale
                key={b.id}
                testID={`map-barber-${b.id}`}
                style={styles.row}
                onPress={() => router.push(`/(customer)/barber/${b.id}` as any)}
                scaleTo={0.98}
              >
                {b.photo ? (
                  <Image source={{ uri: b.photo }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(b.name || "?")[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.shop} numberOfLines={1}>{b.shop_name}</Text>
                  <Text style={styles.dist} numberOfLines={1}>
                    {formatJarak(b.distance_km)}{b.eta_minutes != null ? ` · ~${b.eta_minutes} mnt` : ""}
                  </Text>
                </View>
                <View style={styles.callPill}>
                  <Text style={styles.callPillText}>Panggil</Text>
                </View>
              </PressableScale>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  backRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  back: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  title: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 18 },
  sub: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.surface2 },
  avatarFallback: { backgroundColor: COLORS.brandDim, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 20 },
  name: { color: COLORS.text, fontFamily: FONT.extrabold, fontSize: 14 },
  shop: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11, marginTop: 1 },
  dist: { color: COLORS.brandLight, fontFamily: FONT.bold, fontSize: 12, marginTop: 3 },
  callPill: { backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  callPillText: { color: COLORS.brandLight, fontFamily: FONT.extrabold, fontSize: 12 },
});
