import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/api";
export default function OwnerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: COLORS.brand, tabBarInactiveTintColor: COLORS.textDim,
      tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, borderTopWidth: 1, height: 64, paddingBottom: 8, paddingTop: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Pesanan", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }} />
      <Tabs.Screen name="manage" options={{ title: "Kelola", tabBarIcon: ({ color, size }) => <Ionicons name="construct" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
