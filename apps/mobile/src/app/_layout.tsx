import "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { AppProvider, useApp } from "@/context/app-context";
import { ToastProvider } from "@/context/toast-context";

/** Caption lettering, under the names `HANDS` gives each. */
const CAPTION_FONTS = {
  Caveat: require("../../assets/fonts/Caveat.ttf"),
  DMSans: require("../../assets/fonts/DMSans.ttf"),
  Fraunces: require("../../assets/fonts/Fraunces.ttf"),
  IBMPlexMono: require("../../assets/fonts/IBMPlexMono.ttf"),
  InstrumentSerif: require("../../assets/fonts/InstrumentSerif.ttf"),
  Mynerve: require("../../assets/fonts/Mynerve.ttf"),
  ShadowsIntoLight: require("../../assets/fonts/ShadowsIntoLight.ttf"),
};

// The splash stays up while fonts and quotes load; the wall's launch intro
// takes over from it in the same place and hides it.
SplashScreen.preventAutoHideAsync();
// Never stranded on the splash if the intro does not get to run.
setTimeout(SplashScreen.hide, 6000);

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts(CAPTION_FONTS);
  // Captions are measured as they are laid out, so nothing is drawn in a
  // stand-in font first. Lettering that fails to load falls back to the system's.
  if (!fontsLoaded && !fontsError) {
    return null;
  }
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { palette, resolvedTheme } = useApp();
  const baseTheme = resolvedTheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: palette.background,
      card: palette.background,
      border: palette.border,
      text: palette.text,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          animation: "fade",
          contentStyle: { backgroundColor: palette.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="quotes"
          // The first screen: it does not slide in over the splash at launch.
          options={{ animation: "none", title: "All Quotes" }}
        />
        <Stack.Screen
          name="profile"
          options={{
            animation: "slide_from_right",
            headerShown: true,
            title: "Settings",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: palette.background },
            headerTintColor: palette.text,
            headerTitleStyle: { fontSize: 17, fontWeight: "500" },
          }}
        />
        <Stack.Screen
          name="capture"
          options={{
            animation: "slide_from_bottom",
            gestureEnabled: false,
            presentation: "fullScreenModal",
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
