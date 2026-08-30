import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";

import { useApp } from "@/context/app-context";

const WALL_GRADIENTS = {
  dark: ["#171717", "#0A0A0A"],
  light: ["#FAFAF9", "#E5E5E3"],
} as const;

export function WallBackground() {
  const { resolvedTheme } = useApp();

  return (
    <LinearGradient
      colors={WALL_GRADIENTS[resolvedTheme]}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}
