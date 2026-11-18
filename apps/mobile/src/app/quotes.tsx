import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, Plus } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { FlatList, ListRenderItem } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BottomNavigation,
  BOTTOM_NAVIGATION_HEIGHT,
  hasNativeIosToolbar,
} from "@/components/bottom-navigation";
import { LaunchIntro } from "@/components/launch-intro";
import { LoadingScreen } from "@/components/loading-screen";
import { PeoplePicker } from "@/components/people-picker";
import { QuoteFocus } from "@/components/quote-focus";
import { WallBackground } from "@/components/wall-background";
import { WallPolaroid } from "@/components/wall-polaroid";
import type { WallPolaroidOrigin } from "@/components/wall-polaroid";
import { useApp } from "@/context/app-context";
import { playSelectionHaptic } from "@/lib/haptics";
import {
  setPeoplePickerOpen,
  setWallPerson,
  useArrivingQuote,
  usePeoplePickerOpen,
  useWallPerson,
} from "@/lib/home-view";
import { polaroidMetrics } from "@/lib/polaroid";
import { sortNewest } from "@/lib/quote-utils";
import { groupQuotesByPerson } from "@/lib/speaker-utils";
import type { QuoteRecord } from "@/lib/types";

const WALL_HEADER_HEIGHT = 74;
const ALL_QUOTES = "All Quotes";
/** Polaroids that drop in one by one when a wall opens; the rest are offscreen. */
const ARRIVING = 5;
/** How long the old wall takes to clear, and the new one to fade up. */
const WALL_OUT_MS = 150;
const WALL_IN_MS = 220;
/** Switching walls: each polaroid drops in a little after the one above. */
const DROP_STAGGER_MS = 70;
const DROP_MS = 340;
const DROP_TOTAL_MS = (ARRIVING - 1) * DROP_STAGGER_MS + DROP_MS;
/**
 * A new wall's first polaroids each load a photo and snapshot themselves,
 * which stalls drawing; the reveal waits until they have, or this long at most.
 */
const DROP_WAIT_MAX_MS = 700;
/** Launch: when the first polaroid is dealt, then each after the one before. */
const DEAL_START_MS = 140;
const DEAL_STAGGER_MS = 90;
const DEAL_MS = 460;

/** The whole deal, from the logo lifting to the last polaroid landing. */
const DEAL_TOTAL_MS =
  DEAL_START_MS + (ARRIVING - 1) * DEAL_STAGGER_MS + DEAL_MS;

/**
 * How a new wall's first polaroids arrive, on one shared clock running 0 to 1.
 * A clock rather than an entering animation, so the wall can be built out of
 * sight (behind the splash, or under the people picker) and only set moving
 * once it is ready; building it stalls a frame or two that would eat the motion.
 */
interface WallArrival {
  clock: SharedValue<number>;
  /** Dealt up from below at launch; dropped in when switching walls. */
  mode: "deal" | "drop";
}

/** Launch deals the first wall in on the parent's clock; a wall switched to
 * runs its own drop, once its polaroids are actually built. */
type WallEntrance =
  | { mode: "deal"; clock: SharedValue<number> }
  | { mode: "drop"; onStart: () => void };

/** Dealt: up from below, turning straight. Dropped: down a little, fading in. */
function ArriveIn({
  arrival,
  children,
  index,
}: {
  arrival: WallArrival;
  children: ReactNode;
  index: number;
}) {
  const { clock, mode } = arrival;
  const turn = index % 2 === 0 ? -8 : 7;
  const style = useAnimatedStyle(() => {
    const dealt = mode === "deal";
    const elapsed = clock.value * (dealt ? DEAL_TOTAL_MS : DROP_TOTAL_MS);
    const start = dealt
      ? DEAL_START_MS + index * DEAL_STAGGER_MS
      : index * DROP_STAGGER_MS;
    const linear = Math.min(
      Math.max((elapsed - start) / (dealt ? DEAL_MS : DROP_MS), 0),
      1
    );
    const eased = 1 - (1 - linear) ** 3;
    if (!dealt) {
      return {
        opacity: eased,
        transform: [{ translateY: -28 * (1 - eased) }],
      };
    }
    return {
      opacity: Math.min(linear / 0.3, 1),
      transform: [
        { translateY: 360 * (1 - eased) },
        { rotate: `${turn * (1 - eased)}deg` },
        { scale: 0.75 + 0.25 * eased },
      ],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Whether something shown while `open` is still on screen: it stays after
 * closing until `hide` reports it has finished fading away.
 */
function useLingering(open: boolean) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) {
    setMounted(true);
  }
  const hide = useCallback(() => setMounted(false), []);
  return [mounted, hide] as const;
}

interface QuoteSelection {
  origin: WallPolaroidOrigin;
  quote: QuoteRecord;
}

export default function QuotesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoading, palette, quotes, resolvedTheme, speakers } = useApp();
  const personId = useWallPerson();
  const pickerOpen = usePeoplePickerOpen();
  const [pickerMounted, hidePicker] = useLingering(pickerOpen);
  const [selection, setSelection] = useState<QuoteSelection | null>(null);
  // The first wall is dealt in at launch; walls switched to afterwards drop in.
  const [hasSwitched, setHasSwitched] = useState(false);
  // The splash's stand-in, until it has cleared off the first wall.
  const [launching, setLaunching] = useState(true);
  // The first wall is built under the splash, then dealt in as the logo lifts.
  const [wallLaidOut, setWallLaidOut] = useState(false);
  const deal = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const startDeal = useCallback(() => {
    deal.value = reduceMotion
      ? 1
      : withTiming(1, { duration: DEAL_TOTAL_MS, easing: Easing.linear });
  }, [deal, reduceMotion]);
  const finishLaunch = useCallback(() => setLaunching(false), []);
  const dealEntrance = useMemo<WallEntrance>(
    () => ({ clock: deal, mode: "deal" }),
    [deal]
  );
  // A wall switched to drops in once its polaroids are built, under the
  // picker if that is open, which then lifts off it.
  const dropEntrance = useMemo<WallEntrance>(
    () => ({ mode: "drop", onStart: () => setPeoplePickerOpen(false) }),
    []
  );
  const hiddenId = useSharedValue<string | null>(null);
  const focusedIndex = useSharedValue(-1);
  const uncover = useSharedValue(0);

  const people = useMemo(
    () => groupQuotesByPerson(speakers, quotes),
    [quotes, speakers]
  );
  const current = people.find((entry) => entry.person.id === personId);
  const allQuotes = useMemo(() => sortNewest(quotes), [quotes]);
  const displayedQuotes = current ? current.quotes : allQuotes;
  const title = current ? current.person.name : ALL_QUOTES;
  const polaroidWidth = Math.min(width * 0.67, 330);

  // A quote just saved lands on the wall it belongs to: this one if it is
  // theirs, otherwise everyone's.
  const arriving = useArrivingQuote();
  const arrivingId = arriving?.id ?? null;
  useEffect(() => {
    if (!arrivingId) {
      return;
    }
    setPeoplePickerOpen(false);
    if (current && !current.quotes.some((quote) => quote.id === arrivingId)) {
      setWallPerson(null);
    }
  }, [arrivingId, current]);

  // A person whose last quote was deleted no longer has a wall.
  useEffect(() => {
    if (personId && !isLoading && !current) {
      setWallPerson(null);
    }
  }, [current, isLoading, personId]);

  const openQuote = useCallback(
    (quote: QuoteRecord, origin: WallPolaroidOrigin) =>
      setSelection({ origin, quote }),
    []
  );

  const showWall = (id: string | null) => {
    if (id === personId) {
      setPeoplePickerOpen(false);
      return;
    }
    void playSelectionHaptic();
    setHasSwitched(true);
    setWallPerson(id);
  };

  const openCapture = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn("[quotd-haptics]", error);
    }
    setPeoplePickerOpen(false);
    router.push("/capture");
  };

  return (
    <View
      collapsable={false}
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <WallBackground />
      {isLoading ? <LoadingScreen /> : null}
      {isLoading ? null : (
        // Each wall is its own list, starting from the top. The old wall is
        // gone before the next arrives, so the two never show through each other.
        <Animated.View
          entering={hasSwitched ? FadeIn.duration(WALL_IN_MS) : undefined}
          exiting={FadeOut.duration(WALL_OUT_MS)}
          key={personId ?? "all"}
          onLayout={() => setWallLaidOut(true)}
          style={StyleSheet.absoluteFill}
        >
          <WallList
            entrance={hasSwitched ? dropEntrance : dealEntrance}
            focusedIndex={focusedIndex}
            hiddenId={hiddenId}
            onAdd={openCapture}
            onBack={current ? () => showWall(null) : undefined}
            onOpen={openQuote}
            polaroidWidth={polaroidWidth}
            quotes={displayedQuotes}
            title={title}
            uncover={uncover}
          />
        </Animated.View>
      )}

      {pickerMounted && !isLoading ? (
        <PeoplePicker
          onClose={() => setPeoplePickerOpen(false)}
          onHidden={hidePicker}
          open={pickerOpen}
          onSelect={showWall}
          people={people}
          quoteCount={quotes.length}
          selectedId={current ? current.person.id : null}
        />
      ) : null}

      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      {/* iOS draws this bar natively, above everything, so it waits for the wall. */}
      {isLoading ? null : <BottomNavigation onAdd={openCapture} />}

      {selection ? (
        <QuoteFocus
          hiddenId={hiddenId}
          onClose={() => setSelection(null)}
          onQuoteUpdated={(quote) =>
            setSelection((previous) =>
              previous ? { ...previous, quote } : previous
            )
          }
          backLabel={`Back to ${current ? current.person.name : "all quotes"}`}
          origin={selection.origin}
          uncover={uncover}
          quote={selection.quote}
          title={title}
        />
      ) : null}

      {launching ? (
        <LaunchIntro
          onDone={finishLaunch}
          onReveal={startDeal}
          ready={wallLaidOut}
        />
      ) : null}
    </View>
  );
}

function WallList({
  entrance,
  focusedIndex,
  hiddenId,
  onAdd,
  onBack,
  onOpen,
  polaroidWidth,
  quotes,
  title,
  uncover,
}: {
  /** How the first polaroids arrive as the wall opens. */
  entrance: WallEntrance;
  focusedIndex: SharedValue<number>;
  hiddenId: SharedValue<string | null>;
  onAdd: () => void;
  /** Leads back to all quotes from a person's wall. */
  onBack?: () => void;
  onOpen: (quote: QuoteRecord, origin: WallPolaroidOrigin) => void;
  polaroidWidth: number;
  quotes: QuoteRecord[];
  title: string;
  uncover: SharedValue<number>;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { palette } = useApp();
  const scrollY = useSharedValue(0);
  const metrics = polaroidMetrics(polaroidWidth);
  const scrollTopInset = Platform.OS === "ios" ? insets.top : 0;
  const listRef = useRef<FlatList<QuoteRecord>>(null);
  const reduceMotion = useReducedMotion();

  // A fresh clock per wall, so it is at the start on the wall's first frame.
  // A wall opened for a quote just saved is already in place: that quote
  // flies in on its own.
  const arriving = useArrivingQuote();
  const opensForArrival = useRef(arriving !== null).current;
  const dropClock = useSharedValue(opensForArrival ? 1 : 0);
  const dropStarted = useRef(opensForArrival);
  const arrival = useMemo<WallArrival>(
    () =>
      entrance.mode === "deal"
        ? { clock: entrance.clock, mode: "deal" }
        : { clock: dropClock, mode: "drop" },
    [dropClock, entrance]
  );
  // Building the polaroids stalls drawing, which would eat the drop: it
  // starts once the first ones have settled.
  const startDrop = () => {
    if (entrance.mode !== "drop" || dropStarted.current) {
      return;
    }
    dropStarted.current = true;
    const { onStart } = entrance;
    requestAnimationFrame(() => {
      onStart();
      dropClock.value = reduceMotion
        ? 1
        : withTiming(1, { duration: DROP_TOTAL_MS, easing: Easing.linear });
    });
  };
  const startDropRef = useRef(startDrop);
  startDropRef.current = startDrop;
  const awaiting = useRef(Math.min(quotes.length, ARRIVING));
  const settleOne = useCallback(() => {
    awaiting.current -= 1;
    if (awaiting.current === 0) {
      startDropRef.current();
    }
  }, []);
  useEffect(() => {
    if (awaiting.current <= 0) {
      startDropRef.current();
      return;
    }
    const timer = setTimeout(() => startDropRef.current(), DROP_WAIT_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  // A quote just saved lands in the top slot, so the wall goes back up to it.
  const arrivingId = arriving?.id ?? null;
  useLayoutEffect(() => {
    if (arrivingId) {
      listRef.current?.scrollToOffset({
        animated: false,
        offset: -scrollTopInset,
      });
    }
  }, [arrivingId, scrollTopInset]);
  const onScroll = useAnimatedScrollHandler((event) => {
    // UIKit starts at a negative content offset for the automatic safe-area inset.
    scrollY.value = event.contentOffset.y + scrollTopInset;
  });

  const renderPolaroid = useCallback<ListRenderItem<QuoteRecord>>(
    ({ item, index }) => {
      const polaroid = (
        <WallPolaroid
          focusedIndex={focusedIndex}
          hiddenId={hiddenId}
          index={index}
          isLast={index === quotes.length - 1}
          onOpen={onOpen}
          quote={item}
          scrollY={scrollY}
          uncover={uncover}
          width={polaroidWidth}
          // Only the arriving quote and those it pushes down are told, so the
          // rest of the wall does not redraw.
          arrival={arriving?.id === item.id ? arriving : null}
          onSettled={index < ARRIVING ? settleOne : undefined}
          makingRoom={
            arriving !== null &&
            arriving.id !== item.id &&
            index > 0 &&
            index <= ARRIVING
          }
        />
      );
      if (index >= ARRIVING) {
        return polaroid;
      }
      return (
        <ArriveIn arrival={arrival} index={index}>
          {polaroid}
        </ArriveIn>
      );
    },
    [
      arrival,
      arriving,
      focusedIndex,
      hiddenId,
      onOpen,
      polaroidWidth,
      quotes.length,
      scrollY,
      uncover,
    ]
  );

  return (
    <Animated.FlatList<QuoteRecord>
      ref={listRef}
      // The wall's top sits above zero, under the status bar's inset; without
      // this, scrolling back up to it stops short.
      scrollToOverflowEnabled
      // Earlier polaroids lie on top of the ones that follow.
      CellRendererComponentStyle={({ index }) => ({
        zIndex: quotes.length - index,
      })}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        {
          paddingTop: Platform.OS === "ios" ? 0 : insets.top,
          // Room to scroll every polaroid up to the top slot, so the last
          // one can be seen on its own. UIKit also adjusts for its toolbar;
          // Android and the web fallback overlay the list.
          paddingBottom: Math.max(
            height - insets.top - WALL_HEADER_HEIGHT - metrics.step,
            metrics.height -
              metrics.step +
              (hasNativeIosToolbar
                ? 28
                : BOTTOM_NAVIGATION_HEIGHT + Math.max(insets.bottom, 12) + 36)
          ),
        },
        quotes.length === 0 && styles.emptyListContent,
      ]}
      data={quotes}
      getItemLayout={(_, index) => ({
        index,
        length: metrics.step,
        offset: WALL_HEADER_HEIGHT + metrics.step * index,
      })}
      initialNumToRender={6}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyState onAdd={onAdd} palette={palette} />}
      ListHeaderComponent={
        // An empty wall is just its blank polaroid, without a title above it.
        quotes.length === 0 ? undefined : (
          <View style={styles.header}>
            {onBack ? (
              <Pressable
                accessibilityLabel="Back to all quotes"
                accessibilityRole="button"
                hitSlop={12}
                onPress={onBack}
                style={({ pressed }) => [
                  styles.back,
                  pressed && styles.pressed,
                ]}
              >
                <ChevronLeft color={palette.text} size={24} strokeWidth={2} />
              </Pressable>
            ) : null}
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.title, { color: palette.text }]}
            >
              {title}
            </Text>
          </View>
        )
      }
      maxToRenderPerBatch={4}
      onScroll={onScroll}
      renderItem={renderPolaroid}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={styles.wall}
      windowSize={5}
    />
  );
}

/**
 * The wall before any quotes: a blank polaroid waiting for its photo, which
 * gives a little wiggle now and then to invite the first tap.
 */
function EmptyState({
  onAdd,
  palette,
}: {
  onAdd: () => void;
  palette: ReturnType<typeof useApp>["palette"];
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  const metrics = polaroidMetrics(Math.min(width * 0.58, 250));

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const step = (degrees: number, duration: number) =>
      withTiming(degrees, { duration, easing: Easing.inOut(Easing.quad) });
    tilt.value = withRepeat(
      withSequence(
        withDelay(1800, step(-3, 90)),
        step(3, 110),
        step(-2, 100),
        step(1.5, 90),
        step(0, 80)
      ),
      -1
    );
    return () => cancelAnimation(tilt);
  }, [reduceMotion, tilt]);

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}deg` }],
  }));

  return (
    <View style={styles.emptyState}>
      <Animated.View style={wiggleStyle}>
        <Pressable
          accessibilityLabel="Add your first quote"
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [
            styles.blankPolaroid,
            {
              borderRadius: metrics.radius,
              height: metrics.height,
              padding: metrics.padding,
              width: metrics.width,
            },
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.blankPhoto,
              {
                backgroundColor: palette.surfaceMuted,
                borderRadius: metrics.photoRadius,
                height: metrics.photoHeight,
              },
            ]}
          >
            <Plus color={palette.textMuted} size={44} strokeWidth={1.6} />
          </View>
        </Pressable>
      </Animated.View>
      <Text style={[styles.emptyCopy, { color: palette.textMuted }]}>
        Capture something worth remembering.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  blankPhoto: {
    alignItems: "center",
    borderCurve: "continuous",
    justifyContent: "center",
  },
  blankPolaroid: {
    backgroundColor: "#FFFFFF",
    borderCurve: "continuous",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  emptyCopy: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 30,
    maxWidth: 260,
    textAlign: "center",
  },
  emptyListContent: {
    flexGrow: 1,
    // No room to scroll past the last polaroid when there are none.
    paddingBottom: 0,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    // Centres the polaroid in the space above the bottom bar.
    paddingBottom: BOTTOM_NAVIGATION_HEIGHT,
    paddingHorizontal: 30,
  },
  back: {
    left: 20,
    position: "absolute",
    top: 5,
  },
  header: {
    height: WALL_HEADER_HEIGHT,
    paddingHorizontal: 56,
    paddingTop: 6,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  safeArea: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
  wall: {
    flex: 1,
  },
});
