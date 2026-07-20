import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/lib/api";

export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.brand,
      tabBarInactiveTintColor: COLORS.textDim,
      tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, borderTopWidth: 1, height: 72, paddingBottom: 12, paddingTop: 10 },
      tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.semibold, marginTop: 2 },
    }}>
      <Tabs.Screen name="home" options={{ title: "Cari", tabBarIcon: ({ color, size }) => <Ionicons name="location" color={color} size={size} /> }} />
      <Tabs.Screen name="ai-scan" options={{ title: "AI Scan", tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Pesanan", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
      <Tabs.Screen name="shop/[id]" options={{ href: null }} />
    </Tabs>
  );
}
