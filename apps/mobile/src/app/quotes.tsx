import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
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
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BottomNavigation,
  BOTTOM_NAVIGATION_HEIGHT,
  hasNativeIosToolbar,
} from "@/components/bottom-navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { PeopleBoard } from "@/components/people-board";
import { QuoteFocus } from "@/components/quote-focus";
import { WallBackground } from "@/components/wall-background";
import { WallPolaroid } from "@/components/wall-polaroid";
import type { WallPolaroidOrigin } from "@/components/wall-polaroid";
import { useApp } from "@/context/app-context";
import { useHomeView } from "@/lib/home-view";
import { polaroidMetrics } from "@/lib/polaroid";
import { sortNewest } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

const WALL_HEADER_HEIGHT = 74;

interface QuoteSelection {
  origin: WallPolaroidOrigin;
  quote: QuoteRecord;
}

export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isLoading, palette, quotes, resolvedTheme } = useApp();
  const showsPeople = useHomeView() === "people";
  const [selection, setSelection] = useState<QuoteSelection | null>(null);
  const scrollY = useSharedValue(0);
  const hiddenId = useSharedValue<string | null>(null);
  const focusedIndex = useSharedValue(-1);
  const uncover = useSharedValue(0);
  const scrollTopInset = Platform.OS === "ios" ? insets.top : 0;
  const onScroll = useAnimatedScrollHandler((event) => {
    // UIKit starts at a negative content offset for the automatic safe-area inset.
    scrollY.value = event.contentOffset.y + scrollTopInset;
  });

  const displayedQuotes = useMemo(() => sortNewest(quotes), [quotes]);
  const polaroidWidth = Math.min(width * 0.67, 330);
  const metrics = polaroidMetrics(polaroidWidth);

  const openQuote = useCallback(
    (quote: QuoteRecord, origin: WallPolaroidOrigin) =>
      setSelection({ origin, quote }),
    []
  );

  const renderPolaroid = useCallback<ListRenderItem<QuoteRecord>>(
    ({ item, index }) => (
      <WallPolaroid
        focusedIndex={focusedIndex}
        hiddenId={hiddenId}
        index={index}
        isLast={index === displayedQuotes.length - 1}
        onOpen={openQuote}
        quote={item}
        scrollY={scrollY}
        uncover={uncover}
        width={polaroidWidth}
      />
    ),
    [
      displayedQuotes.length,
      focusedIndex,
      hiddenId,
      openQuote,
      polaroidWidth,
      scrollY,
      uncover,
    ]
  );

  const openCapture = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn("[quotd-haptics]", error);
    }
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
        <Animated.FlatList<QuoteRecord>
          // Earlier polaroids lie on top of the ones that follow.
          CellRendererComponentStyle={({ index }) => ({
            zIndex: displayedQuotes.length - index,
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
                    : BOTTOM_NAVIGATION_HEIGHT +
                      Math.max(insets.bottom, 12) +
                      36)
              ),
            },
            displayedQuotes.length === 0 && styles.emptyListContent,
          ]}
          data={displayedQuotes}
          getItemLayout={(_, index) => ({
            index,
            length: metrics.step,
            offset: WALL_HEADER_HEIGHT + metrics.step * index,
          })}
          initialNumToRender={6}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState onAdd={openCapture} palette={palette} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: palette.text }]}
              >
                Wall
              </Text>
            </View>
          }
          maxToRenderPerBatch={4}
          onScroll={onScroll}
          renderItem={renderPolaroid}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          // The wall stays mounted behind the people board, keeping its place.
          accessibilityElementsHidden={showsPeople}
          importantForAccessibility={
            showsPeople ? "no-hide-descendants" : "auto"
          }
          pointerEvents={showsPeople ? "none" : "auto"}
          style={[styles.wall, showsPeople && styles.hidden]}
          windowSize={5}
        />
      )}
      {showsPeople && !isLoading ? (
        <PeopleBoard hiddenId={hiddenId} onOpen={openQuote} />
      ) : null}

      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <BottomNavigation onAdd={openCapture} />

      {selection ? (
        <QuoteFocus
          hiddenId={hiddenId}
          onClose={() => setSelection(null)}
          onQuoteUpdated={(quote) =>
            setSelection((current) =>
              current ? { ...current, quote } : current
            )
          }
          backLabel={showsPeople ? "Back to people" : undefined}
          origin={selection.origin}
          uncover={uncover}
          quote={selection.quote}
          title={showsPeople ? "People" : undefined}
        />
      ) : null}
    </View>
  );
}

function EmptyState({
  onAdd,
  palette,
}: {
  onAdd: () => void;
  palette: ReturnType<typeof useApp>["palette"];
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>
        No quotes yet
      </Text>
      <Text style={[styles.emptyCopy, { color: palette.textMuted }]}>
        Capture something worth remembering.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: palette.inverseSurface },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.emptyButtonText, { color: palette.inverseText }]}>
          Add your first quote
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyButton: {
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyButtonText: {
    fontSize: 13.5,
    fontWeight: "500",
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 230,
    textAlign: "center",
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: 7,
    justifyContent: "center",
    paddingBottom: 80,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    height: WALL_HEADER_HEIGHT,
    paddingTop: 6,
  },
  hidden: {
    opacity: 0,
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
