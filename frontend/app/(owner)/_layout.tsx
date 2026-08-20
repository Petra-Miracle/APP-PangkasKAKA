import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FloatingTabBar from "@/src/components/FloatingTabBar";

export default function OwnerLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Beranda", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Pesanan", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }} />
      <Tabs.Screen name="manage" options={{ title: "Kelola", tabBarIcon: ({ color, size }) => <Ionicons name="construct" color={color} size={size} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Jadwal", tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
