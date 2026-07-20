import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/api";
export default function AdminLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: COLORS.brand, tabBarInactiveTintColor: COLORS.textDim,
      tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, borderTopWidth: 1, height: 64, paddingBottom: 8, paddingTop: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="verification" options={{ title: "Verifikasi", tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} /> }} />
      <Tabs.Screen name="users" options={{ title: "Pengguna", tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
