import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import type { HostInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { DraftPolaroid } from "@/components/capture/draft-polaroid";
import { useApp } from "@/context/app-context";
import { playLightHaptic, playSuccessHaptic } from "@/lib/haptics";
import { polaroidMetrics } from "@/lib/polaroid";
import type { Frame } from "@/lib/polaroid";
import type { QuoteAlign, QuoteFont } from "@/lib/types";

/** The milky wash a fresh print clears from. */
const FILM = "#F4F4F2";
/** The tilt the print settles at, in degrees. */
export const PRINT_TILT = 1.5;
/** Lifting off the page into the middle of the screen. */
const LIFT_MS = 320;
/** The shakes: where each swings to, and how long each swing takes. */
const SHAKES = [
  { rotate: -7, ms: 95 },
  { rotate: 7, ms: 120 },
  { rotate: -5, ms: 115 },
  { rotate: 3.5, ms: 105 },
] as const;
const SETTLE_MS = 260;
/** How milky the photo turns as it lifts, and how much each shake clears. */
const FILM_START = 0.5;
/** A beat to look at the finished print before it goes to the wall. */
const HOLD_MS = 380;

const SHAKE_MS = SHAKES.reduce((total, shake) => total + shake.ms, 0);
const DONE_MS = LIFT_MS + SHAKE_MS + SETTLE_MS + HOLD_MS;

function clearAll(timers: ReturnType<typeof setTimeout>[]) {
  for (const timer of timers) {
    clearTimeout(timer);
  }
}

/**
 * The payoff for saving. The polaroid just written lifts off the page as it
 * is, picks up a faint milky film, and is given a few quick shakes, like a
 * real instant print, the photo clearing a little with each one. It then
 * settles, and once the quote is saved hands its place on screen to the wall.
 */
export function DevelopingPolaroid({
  align,
  font,
  from,
  imageUri,
  onDone,
  saved,
  speaker,
  text,
}: {
  align?: QuoteAlign;
  font?: QuoteFont;
  /** Where the polaroid being written was, to lift it from there. */
  from: Frame | null;
  imageUri: string | null;
  /** Shaken and saved: where the print is on screen, for the wall. */
  onDone: (print: Frame | null) => void;
  /** The quote has been kept; until then the print waits, settled. */
  saved: boolean;
  speaker: string;
  text: string;
}) {
  const { height, width } = useWindowDimensions();
  const { palette, resolvedTheme } = useApp();
  const reduceMotion = useReducedMotion();
  const polaroidWidth = Math.min(width - 96, 300);
  const metrics = polaroidMetrics(polaroidWidth);
  const printRef = useRef<HostInstance>(null);
  const [shaken, setShaken] = useState(false);

  // Where the print starts, relative to where it ends up in the middle.
  const start = from
    ? {
        scale: from.width / polaroidWidth,
        x: from.x + from.width / 2 - width / 2,
        y: from.y + from.height / 2 - height / 2,
      }
    : { scale: 0.9, x: 0, y: 24 };
  const backdrop = useSharedValue(0);
  const lift = useSharedValue(0);
  const rotate = useSharedValue(0);
  const film = useSharedValue(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, run: () => void) =>
      timers.push(setTimeout(run, ms));
    const ease = Easing.inOut(Easing.cubic);
    backdrop.set(withTiming(1, { duration: 220, easing: ease }));
    lift.set(withTiming(1, { duration: LIFT_MS, easing: ease }));

    if (reduceMotion) {
      rotate.set(withTiming(PRINT_TILT, { duration: LIFT_MS }));
      later(LIFT_MS, () => {
        void playSuccessHaptic();
        setShaken(true);
      });
      return () => clearAll(timers);
    }

    // Each swing ends a shake; the film thins as it lands.
    const swings = SHAKES.map((shake) =>
      withTiming(shake.rotate, {
        duration: shake.ms,
        easing: Easing.inOut(Easing.quad),
      })
    );
    rotate.set(
      withDelay(
        LIFT_MS,
        withSequence(
          ...swings,
          withTiming(PRINT_TILT, {
            duration: SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          })
        )
      )
    );
    const clears = SHAKES.map((shake, index) =>
      withTiming(FILM_START * (1 - (index + 1) / (SHAKES.length + 1)), {
        duration: shake.ms,
      })
    );
    film.set(
      withSequence(
        withTiming(FILM_START, { duration: LIFT_MS, easing: ease }),
        ...clears,
        withTiming(0, { duration: SETTLE_MS + 120 })
      )
    );

    let at = LIFT_MS;
    for (const shake of SHAKES) {
      at += shake.ms;
      later(at - 20, () => {
        void playLightHaptic();
      });
    }
    later(LIFT_MS + SHAKE_MS + SETTLE_MS * 0.6, () => {
      void playSuccessHaptic();
    });
    later(DONE_MS, () => setShaken(true));
    return () => clearAll(timers);
  }, [backdrop, film, lift, reduceMotion, rotate]);

  // Hands over once shaken and saved, whichever comes last.
  useEffect(() => {
    if (!(shaken && saved)) {
      return;
    }
    const print = printRef.current;
    if (!print) {
      onDone(null);
      return;
    }
    print.measureInWindow((x, y, frameWidth, frameHeight) =>
      onDone(
        frameWidth > 0 ? { height: frameHeight, width: frameWidth, x, y } : null
      )
    );
  }, [onDone, saved, shaken]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const printStyle = useAnimatedStyle(() => {
    const away = 1 - lift.value;
    // Swinging from its top edge, where fingers would hold it.
    const sway = rotate.value - PRINT_TILT;
    return {
      opacity: from ? 1 : lift.value,
      transform: [
        { translateX: start.x * away + sway * 1.4 },
        { translateY: start.y * away - 10 * Math.sin(lift.value * Math.PI) },
        { scale: start.scale + (1 - start.scale) * lift.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });
  const filmStyle = useAnimatedStyle(() => ({ opacity: film.value }));

  return (
    <View
      accessibilityLabel="Quote saved"
      accessibilityLiveRegion="polite"
      accessible
      style={styles.screen}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.background },
          backdropStyle,
        ]}
      />
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      {/* Untilted and unmoved, so it measures the print's resting frame. */}
      <View collapsable={false} ref={printRef}>
        <Animated.View style={printStyle}>
          <DraftPolaroid
            align={align}
            font={font}
            imageUri={imageUri}
            speaker={speaker}
            text={text}
            width={polaroidWidth}
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
      </View>
    </View>
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
