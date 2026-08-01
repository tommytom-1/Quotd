import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useApp } from "@/context/app-context";

export function LoadingScreen() {
  const { palette, resolvedTheme } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <ActivityIndicator color={palette.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
