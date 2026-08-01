import "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { AppProvider, useApp } from "@/context/app-context";
import { ToastProvider } from "@/context/toast-context";

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
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="profile"
          options={{ animation: "slide_from_right" }}
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
