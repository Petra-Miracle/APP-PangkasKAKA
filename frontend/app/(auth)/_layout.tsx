import { Stack } from "expo-router";
import { COLORS } from "@/src/lib/api";
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }} />;
}
