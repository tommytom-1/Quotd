import { Image } from "expo-image";
import { memo, useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ListRenderItem } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import { Polaroid } from "@/components/polaroid";
import type { WallPolaroidOrigin } from "@/components/wall-polaroid";
import { useApp } from "@/context/app-context";
import {
  columnMetrics,
  pilePose,
  polaroidMetrics,
  polaroidPlacement,
} from "@/lib/polaroid";
import { formatDate } from "@/lib/quote-utils";
import type { QuoteRecord, SpeakerProfile } from "@/lib/types";

export const PERSON_HEADER_HEIGHT = 98;
/** Room above the pile for tilted corners and shadows. */
const PILE_TOP = 12;
const AVATAR_SIZE = 54;
const SHADOW_OPACITY = 0.13;
// More friction than a plain list (0.998 on iOS, 0.985 on Android), so a flick
// deals a few polaroids onto the pile instead of gliding through the column.
const COLUMN_DECELERATION = Platform.OS === "ios" ? 0.994 : 0.97;

interface PersonColumnProps {
  person: SpeakerProfile;
  /** Newest first. */
  quotes: QuoteRecord[];
  width: number;
  /** Height left for the polaroids beneath the person's header. */
  listHeight: number;
  polaroidWidth: number;
  /** ID of the quote shown in the focus view, whose column copy stays hidden. */
  hiddenId: SharedValue<string | null>;
  onOpen: (quote: QuoteRecord, origin: WallPolaroidOrigin) => void;
}

export const PersonColumn = memo(
  ({
    person,
    quotes,
    width,
    listHeight,
    polaroidWidth,
    hiddenId,
    onOpen,
  }: PersonColumnProps) => {
    const { palette } = useApp();
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((event) => {
      scrollY.value = event.contentOffset.y;
    });
    const { step } = columnMetrics(polaroidWidth);

    const renderPolaroid = useCallback<ListRenderItem<QuoteRecord>>(
      ({ item, index }) => (
        <ColumnPolaroid
          hiddenId={hiddenId}
          index={index}
          onOpen={onOpen}
          quote={item}
          scrollY={scrollY}
          width={polaroidWidth}
        />
      ),
      [hiddenId, onOpen, polaroidWidth, scrollY]
    );

    return (
      <View style={{ width }}>
        <View style={styles.header}>
          <PersonAvatar
            key={`${person.id}-${person.avatarUri}`}
            person={person}
          />
          <Text
            numberOfLines={1}
            style={[styles.name, { color: palette.textMuted }]}
          >
            {person.name}
          </Text>
        </View>
        <Animated.FlatList<QuoteRecord>
          contentContainerStyle={{
            // Room to scroll every polaroid onto the pile.
            paddingBottom: Math.max(0, listHeight - PILE_TOP - step),
            paddingTop: PILE_TOP,
          }}
          contentInsetAdjustmentBehavior="never"
          data={quotes}
          decelerationRate={COLUMN_DECELERATION}
          getItemLayout={(_, index) => ({
            index,
            length: step,
            offset: PILE_TOP + step * index,
          })}
          initialNumToRender={4}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={4}
          onScroll={onScroll}
          // Piled polaroids are drawn far from where the list laid them out.
          removeClippedSubviews={false}
          renderItem={renderPolaroid}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          // Shadows spill past the column. Polaroids stop at the pile, so nothing
          // else ever leaves the list.
          style={{ height: listHeight, overflow: "visible" }}
          windowSize={7}
        />
      </View>
    );
  }
);
PersonColumn.displayName = "PersonColumn";

interface ColumnPolaroidProps {
  quote: QuoteRecord;
  index: number;
  width: number;
  scrollY: SharedValue<number>;
  hiddenId: SharedValue<string | null>;
  onOpen: (quote: QuoteRecord, origin: WallPolaroidOrigin) => void;
}

const ColumnPolaroid = memo(
  ({ quote, index, width, scrollY, hiddenId, onOpen }: ColumnPolaroidProps) => {
    const slotRef = useRef<View>(null);
    const metrics = polaroidMetrics(width);
    const { step, peek } = columnMetrics(width);
    const { tilt, offsetX } = polaroidPlacement(quote.id, width);
    const quoteId = quote.id;

    const cardStyle = useAnimatedStyle(() => {
      const pose = pilePose(scrollY.value, index, step, peek);
      return {
        opacity: hiddenId.value === quoteId ? 0 : pose.opacity,
        shadowOpacity: SHADOW_OPACITY * pose.shadow,
        transform: [{ translateY: pose.translateY }, { rotate: `${tilt}deg` }],
      };
    });

    const open = () => {
      slotRef.current?.measureInWindow((x, y, frameWidth, frameHeight) => {
        if (frameWidth > 0 && frameHeight > 0) {
          onOpen(quote, {
            frame: { height: frameHeight, width: frameWidth, x, y },
            pose: {
              haze: 0,
              opacity: 1,
              rotate: tilt,
              scale: 1,
              translateX: 0,
              translateY: pilePose(scrollY.get(), index, step, peek).translateY,
            },
          });
        }
      });
    };

    return (
      // Rows are shorter than a polaroid, so each one overlaps the one above.
      <View style={[styles.row, { height: step }]}>
        <View
          ref={slotRef}
          collapsable={false}
          style={{ height: metrics.height, left: offsetX, width }}
        >
          <Animated.View
            style={[styles.card, { height: metrics.height }, cardStyle]}
          >
            <Pressable
              accessibilityLabel={`"${quote.text}", by ${quote.speaker}, ${formatDate(quote.createdAt)}`}
              accessibilityRole="button"
              onPress={open}
            >
              <Polaroid flat quote={quote} width={width} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }
);
ColumnPolaroid.displayName = "ColumnPolaroid";

function PersonAvatar({ person }: { person: SpeakerProfile }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={[styles.avatar, { backgroundColor: person.color }]}>
      <Text style={styles.initial}>
        {[...person.name.trim()][0]?.toLocaleUpperCase() || "?"}
      </Text>
      {person.avatarUri && !imageFailed ? (
        <Image
          contentFit="cover"
          onError={() => setImageFailed(true)}
          source={person.avatarUri}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: "center",
    overflow: "hidden",
    width: AVATAR_SIZE,
  },
  card: {
    backgroundColor: "#FAFAF8",
    shadowColor: "#000",
    shadowOffset: { height: 5, width: 0 },
    shadowRadius: 12,
  },
  header: {
    alignItems: "center",
    height: PERSON_HEADER_HEIGHT,
    paddingHorizontal: 12,
  },
  initial: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "600",
  },
  name: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 120,
    textAlign: "center",
  },
  row: {
    alignItems: "center",
  },
});
