import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";
export default function AdminLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#FFFFFF",
      tabBarInactiveTintColor: COLORS.sidebarTextDim,
      tabBarStyle: { backgroundColor: COLORS.sidebar, borderTopColor: COLORS.sidebarSurface, borderTopWidth: 1, height: 72, paddingBottom: 12, paddingTop: 10 },
      tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.semibold, marginTop: 2 },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="verification" options={{ title: "Verifikasi", tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} /> }} />
      <Tabs.Screen name="users" options={{ title: "Pengguna", tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
