import "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { AppProvider, useApp } from "@/context/app-context";
import { ToastProvider } from "@/context/toast-context";
import { MARKER_FONT } from "@/lib/polaroid";

export default function RootLayout() {
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
  const [fontsLoaded, fontError] = useFonts({
    [MARKER_FONT]: require("@/assets/fonts/Colastine.otf"),
  });
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

  // Polaroid captions are measured, so wait for the marker font. A failed load
  // falls back to the system font instead of blocking the app.
  if (!fontsLoaded && !fontError) {
    return null;
  }

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
          options={{ animation: "slide_from_right", title: "Wall" }}
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
