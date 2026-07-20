import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { useEffect, useState } from "react";
import { LogBox, StatusBar, Text as RNText, TextInput as RNTextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/lib/auth";
import { COLORS, FONT } from "@/src/lib/api";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Set default font family for all Text and TextInput
const setDefaultFont = () => {
  const AnyText: any = RNText;
  const AnyInput: any = RNTextInput;
  const oldTextRender = AnyText.render;
  if (!AnyText.__pkjkDefault) {
    AnyText.defaultProps = AnyText.defaultProps || {};
    AnyText.defaultProps.style = [{ fontFamily: FONT.regular, color: COLORS.text }, AnyText.defaultProps.style];
    AnyText.__pkjkDefault = true;
  }
  if (!AnyInput.__pkjkDefault) {
    AnyInput.defaultProps = AnyInput.defaultProps || {};
    AnyInput.defaultProps.style = [{ fontFamily: FONT.regular }, AnyInput.defaultProps.style];
    AnyInput.__pkjkDefault = true;
  }
};

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
          "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
          "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
          "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
          "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
        });
      } catch {}
      setDefaultFont();
      setFontsLoaded(true);
    })();
  }, []);

  useEffect(() => { if ((iconsLoaded || iconsError) && fontsLoaded) SplashScreen.hideAsync(); }, [iconsLoaded, iconsError, fontsLoaded]);
  if ((!iconsLoaded && !iconsError) || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
