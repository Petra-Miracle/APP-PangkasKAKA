import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FloatingTabBar from "@/src/components/FloatingTabBar";

export default function SuperAdminLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Beranda", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="verification" options={{ title: "Verifikasi", tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} /> }} />
      <Tabs.Screen name="users" options={{ title: "Pengguna", tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="admins" options={{ title: "Kelola Admin", tabBarIcon: ({ color, size }) => <Ionicons name="shield" color={color} size={size} /> }} />
      <Tabs.Screen name="catalog" options={{ title: "Katalog", tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
