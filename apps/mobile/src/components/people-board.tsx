import { useCallback, useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ListRenderItem } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PERSON_HEADER_HEIGHT, PersonColumn } from "@/components/person-column";
import type { WallPolaroidOrigin } from "@/components/wall-polaroid";
import { useApp } from "@/context/app-context";
import { playSelectionHaptic } from "@/lib/haptics";
import { groupQuotesByPerson } from "@/lib/speaker-utils";
import type { PersonQuotes } from "@/lib/speaker-utils";
import type { QuoteRecord } from "@/lib/types";

const PEOPLE_HEADER_HEIGHT = 68;

interface PeopleBoardProps {
  /** ID of the quote shown in the focus view, whose board copy stays hidden. */
  hiddenId: SharedValue<string | null>;
  onOpen: (quote: QuoteRecord, origin: WallPolaroidOrigin) => void;
}

/** Everyone's quotes side by side, one column per person. */
export function PeopleBoard({ hiddenId, onOpen }: PeopleBoardProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { palette, quotes, speakers } = useApp();
  const centeredColumn = useSharedValue(0);

  const columns = useMemo(
    () => groupQuotesByPerson(speakers, quotes),
    [quotes, speakers]
  );
  const polaroidWidth = Math.min(width * 0.38, 220);
  // Whole points, so every snap offset lands on a column exactly.
  const columnWidth = Math.round(polaroidWidth * 1.4);
  const listHeight =
    height - insets.top - PEOPLE_HEADER_HEIGHT - PERSON_HEADER_HEIGHT;
  const lastColumn = columns.length - 1;

  const onScroll = useAnimatedScrollHandler((event) => {
    centeredColumn.value = Math.min(
      Math.max(Math.round(event.contentOffset.x / columnWidth), 0),
      Math.max(lastColumn, 0)
    );
  });
  // A tick each time another column takes the middle of the screen.
  useAnimatedReaction(
    () => centeredColumn.value,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(playSelectionHaptic)();
      }
    }
  );

  const renderColumn = useCallback<ListRenderItem<PersonQuotes>>(
    ({ item }) => (
      <PersonColumn
        hiddenId={hiddenId}
        listHeight={listHeight}
        onOpen={onOpen}
        person={item.person}
        polaroidWidth={polaroidWidth}
        quotes={item.quotes}
        width={columnWidth}
      />
    ),
    [columnWidth, hiddenId, listHeight, onOpen, polaroidWidth]
  );

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: palette.text }]}
        >
          People
        </Text>
      </View>
      {columns.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            No people yet
          </Text>
          <Text style={[styles.emptyCopy, { color: palette.textMuted }]}>
            Everyone you quote gets a column here.
          </Text>
        </View>
      ) : (
        <Animated.FlatList<PersonQuotes>
          contentContainerStyle={{
            // Lets the first and last columns reach the middle of the screen.
            paddingHorizontal: (width - columnWidth) / 2,
          }}
          contentInsetAdjustmentBehavior="never"
          data={columns}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            index,
            length: columnWidth,
            offset: columnWidth * index,
          })}
          horizontal
          initialNumToRender={3}
          keyExtractor={(item) => item.person.id}
          maxToRenderPerBatch={2}
          onScroll={onScroll}
          renderItem={renderColumn}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          // The magnet: the board always settles with a column in the middle.
          snapToInterval={columnWidth}
          style={styles.board}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 230,
    textAlign: "center",
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
    height: PEOPLE_HEADER_HEIGHT,
    paddingTop: 6,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
});
