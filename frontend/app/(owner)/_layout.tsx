import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";

export default function OwnerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#FFFFFF",
      tabBarInactiveTintColor: COLORS.sidebarTextDim,
      tabBarStyle: { backgroundColor: COLORS.sidebar, borderTopColor: COLORS.sidebarSurface, borderTopWidth: 1, height: 72, paddingBottom: 12, paddingTop: 10 },
      tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.semibold, marginTop: 2 },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Pesanan", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }} />
      <Tabs.Screen name="manage" options={{ title: "Kelola", tabBarIcon: ({ color, size }) => <Ionicons name="construct" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
