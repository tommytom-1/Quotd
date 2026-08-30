import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { RefObject } from "react";
import { StyleSheet } from "react-native";
import type { View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/app-context";

export function ScrollEdgeBlur({
  scrollOffset,
  targetRef,
}: {
  scrollOffset: SharedValue<number>;
  targetRef: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useApp();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, 36],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.edge, { height: insets.top + 24 }, animatedStyle]}
    >
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={["#000", "#000", "transparent"]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={targetRef}
          intensity={45}
          tint={
            resolvedTheme === "dark"
              ? "systemThinMaterialDark"
              : "systemThinMaterialLight"
          }
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  edge: { left: 0, position: "absolute", right: 0, top: 0 },
});
