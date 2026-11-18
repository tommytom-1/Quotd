import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

/** The native splash, as app.json draws it: logo 96pt wide on paper. */
const SPLASH_BACKGROUND = "#F4F1E9";
const SPLASH_LOGO_SIZE = 96;
const LOGO_OUT_MS = 380;
const BACKGROUND_OUT_MS = 320;
/** How far into the logo lifting away the paper starts to clear. */
const BACKGROUND_DELAY_MS = 120;

/**
 * Stands in for the native splash, drawn identically so the swap cannot be
 * seen, and then gets out of the way: once the wall is ready the logo lifts
 * up and away and the paper clears as the polaroids are dealt in under it.
 */
export function LaunchIntro({
  onDone,
  onReveal,
  ready,
}: {
  onDone: () => void;
  /** The logo starts lifting away: time for the wall to be dealt in. */
  onReveal: () => void;
  /** The wall has loaded and can be shown. */
  ready: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  const cover = useSharedValue(1);
  // The native splash is gone and this stand-in is what shows.
  const [shown, setShown] = useState(false);

  const takeOver = () => {
    if (shown) {
      return;
    }
    SplashScreen.hide();
    // Let the splash's removal reach the screen before anything moves.
    requestAnimationFrame(() => setShown(true));
  };

  useEffect(() => {
    if (!(shown && ready)) {
      return;
    }
    onReveal();
    // Unmounted once the paper has cleared.
    const total = reduceMotion ? 200 : BACKGROUND_DELAY_MS + BACKGROUND_OUT_MS;
    const timer = setTimeout(onDone, total);
    if (reduceMotion) {
      cover.value = withTiming(0, { duration: total });
      return () => clearTimeout(timer);
    }
    lift.value = withTiming(1, {
      duration: LOGO_OUT_MS,
      easing: Easing.in(Easing.cubic),
    });
    cover.value = withDelay(
      BACKGROUND_DELAY_MS,
      withTiming(0, {
        duration: BACKGROUND_OUT_MS,
        easing: Easing.out(Easing.quad),
      })
    );
    return () => clearTimeout(timer);
  }, [cover, lift, onDone, onReveal, ready, reduceMotion, shown]);

  const backgroundStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: 1 - lift.value,
    transform: [
      { translateY: -140 * lift.value },
      { scale: 1 - 0.3 * lift.value },
    ],
  }));

  return (
    <Animated.View
      // Drawn identically to the splash, so the splash can go once it is laid out.
      onLayout={takeOver}
      pointerEvents={ready ? "none" : "auto"}
      style={[styles.container, backgroundStyle]}
    >
      <Animated.View style={logoStyle}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={styles.logo}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: SPLASH_BACKGROUND,
    justifyContent: "center",
  },
  logo: {
    height: SPLASH_LOGO_SIZE,
    resizeMode: "contain",
    width: SPLASH_LOGO_SIZE,
  },
});
