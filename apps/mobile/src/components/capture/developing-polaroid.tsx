import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { DraftPolaroid } from "@/components/capture/draft-polaroid";
import { useApp } from "@/context/app-context";
import { polaroidMetrics } from "@/lib/polaroid";
import type { QuoteAlign, QuoteFont } from "@/lib/types";

/** How long the print takes to develop before handing back to the wall. */
const DURATION = 2000;
/** The milky wash a fresh print starts under. */
const FILM = "#F4F4F2";

/**
 * The payoff for saving: the finished polaroid settles into place and its
 * photo develops, from a milky wash to full colour, like an instant print.
 */
export function DevelopingPolaroid({
  align,
  font,
  imageUri,
  onDone,
  speaker,
  text,
}: {
  align?: QuoteAlign;
  font?: QuoteFont;
  imageUri: string | null;
  onDone: () => void;
  speaker: string;
  text: string;
}) {
  const { width } = useWindowDimensions();
  const { palette, resolvedTheme } = useApp();
  const polaroidWidth = Math.min(width - 96, 300);
  const metrics = polaroidMetrics(polaroidWidth);
  const backdrop = useSharedValue(0);
  const settle = useSharedValue(0);
  const film = useSharedValue(1);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    backdrop.value = withTiming(1, { duration: 180, easing: ease });
    settle.value = withDelay(
      60,
      withTiming(1, { duration: 520, easing: ease })
    );
    film.value = withDelay(
      420,
      withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) })
    );
    const timer = setTimeout(onDone, DURATION);
    return () => clearTimeout(timer);
  }, [backdrop, film, onDone, settle]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const printStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [
      { translateY: (1 - settle.value) * 28 },
      { rotate: `${1.5 + (1 - settle.value) * 4}deg` },
    ],
  }));
  const filmStyle = useAnimatedStyle(() => ({ opacity: film.value * 0.94 }));

  return (
    <Animated.View
      accessibilityLabel="Quote saved"
      accessibilityLiveRegion="polite"
      accessible
      style={[
        styles.screen,
        { backgroundColor: palette.background },
        backdropStyle,
      ]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <Animated.View style={printStyle}>
        <DraftPolaroid
          align={align}
          font={font}
          imageUri={imageUri}
          speaker={speaker}
          text={text}
          width={polaroidWidth}
          withSpeaker
        />
        <Animated.View
          style={[
            styles.film,
            {
              borderRadius: metrics.photoRadius,
              height: metrics.photoHeight,
              left: metrics.padding,
              top: metrics.padding,
              width: metrics.photoWidth,
            },
            filmStyle,
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  film: {
    backgroundColor: FILM,
    position: "absolute",
  },
  screen: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
