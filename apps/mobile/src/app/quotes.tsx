import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { ListRenderItem } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
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
/** How long the old wall takes to clear, and the new one to fade up after it. */
const WALL_OUT_MS = 150;
const WALL_IN_MS = 220;

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
  const [selection, setSelection] = useState<QuoteSelection | null>(null);
  // The first wall is simply there; walls switched to afterwards arrive.
  const [hasSwitched, setHasSwitched] = useState(false);
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
    setPeoplePickerOpen(false);
    if (id !== personId) {
      void playSelectionHaptic();
      setHasSwitched(true);
      setWallPerson(id);
    }
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
      {isLoading ? (
        <LoadingScreen />
      ) : (
        // Each wall is its own list, starting from the top. The old wall is
        // gone before the next arrives, so the two never show through each other.
        <Animated.View
          entering={
            hasSwitched
              ? FadeIn.delay(WALL_OUT_MS).duration(WALL_IN_MS)
              : undefined
          }
          exiting={FadeOut.duration(WALL_OUT_MS)}
          key={personId ?? "all"}
          style={StyleSheet.absoluteFill}
        >
          <WallList
            animateIn={hasSwitched}
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

      {pickerOpen && !isLoading ? (
        <PeoplePicker
          onClose={() => setPeoplePickerOpen(false)}
          onSelect={showWall}
          people={people}
          quoteCount={quotes.length}
          selectedId={current ? current.person.id : null}
        />
      ) : null}

      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <BottomNavigation onAdd={openCapture} />

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
    </View>
  );
}

function WallList({
  animateIn,
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
  /** Drops the first polaroids in one after another as the wall opens. */
  animateIn: boolean;
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
        />
      );
      return animateIn && index < ARRIVING ? (
        <Animated.View
          entering={FadeInDown.delay(WALL_OUT_MS + 40 + index * 70)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          {polaroid}
        </Animated.View>
      ) : (
        polaroid
      );
    },
    [
      animateIn,
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
