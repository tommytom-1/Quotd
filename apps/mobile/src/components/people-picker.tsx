import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAVIGATION_HEIGHT } from "@/components/bottom-navigation";
import { SmoothEdges } from "@/components/smooth-edges";
import { useApp } from "@/context/app-context";
import { polaroidMetrics, polaroidPlacement } from "@/lib/polaroid";
import type { PersonQuotes } from "@/lib/speaker-utils";

const GUTTER = 18;
/**
 * Where the cards under someone's top polaroid sit: nudged by a share of the
 * card's width, and turned a few degrees further than it. Nearest first.
 */
const PILE = [
  { turn: -6, x: -0.03, y: -0.02 },
  { turn: 5, x: 0.04, y: 0.015 },
];
const GAP = 14;
/** How much lower the right-hand column sits, so the pile looks scattered. */
const STAGGER = 34;
/** Room around each card for its shadow; see SmoothEdges. */
const CARD_EDGE_MARGIN = 26;

/**
 * Whose quotes the wall shows, picked from a scatter of small polaroids over
 * the blurred wall: one per person, showing their latest photo.
 */
export function PeoplePicker({
  people,
  quoteCount,
  selectedId,
  onClose,
  onSelect,
}: {
  people: PersonQuotes[];
  quoteCount: number;
  /** The person whose wall is showing, null for all quotes. */
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { palette, resolvedTheme } = useApp();
  const cardWidth = Math.min((width - GUTTER * 2 - GAP) / 2, 172);
  const footerBottom = BOTTOM_NAVIGATION_HEIGHT + Math.max(insets.bottom, 12);
  const columns = [
    people.filter((_, index) => index % 2 === 0),
    people.filter((_, index) => index % 2 === 1),
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={StyleSheet.absoluteFill}
    >
      <BlurView
        intensity={40}
        tint={
          resolvedTheme === "dark"
            ? "systemThinMaterialDark"
            : "systemThinMaterialLight"
        }
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        accessibilityLabel="Close people"
        onPress={onClose}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.background, opacity: 0.45 },
        ]}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: footerBottom + 84,
          paddingTop: insets.top + 10,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: palette.text }]}
        >
          Whose quotes?
        </Text>
        {people.length === 0 ? (
          <Text style={[styles.empty, { color: palette.textMuted }]}>
            Everyone you quote will appear here.
          </Text>
        ) : (
          <View style={styles.columns}>
            {columns.map((column, side) => (
              <View
                // oxlint-disable-next-line react/no-array-index-key -- Always two columns.
                key={side}
                style={[styles.column, side === 1 && { marginTop: STAGGER }]}
              >
                {column.map((entry, row) => (
                  <PersonCard
                    entry={entry}
                    // Cards land in reading order, left then right, row by row.
                    order={row * 2 + side}
                    key={entry.person.id}
                    onPress={() => onSelect(entry.person.id)}
                    selected={entry.person.id === selectedId}
                    width={cardWidth}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <Animated.View
        entering={FadeInDown.delay(120).duration(260)}
        pointerEvents="box-none"
        style={[styles.footer, { bottom: footerBottom + 16 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedId === null }}
          onPress={() => onSelect(null)}
          style={({ pressed }) => [
            styles.allButton,
            { backgroundColor: palette.inverseSurface },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.allText, { color: palette.inverseText }]}>
            All quotes
          </Text>
          <Text style={[styles.allCount, { color: palette.inverseText }]}>
            {quoteCount}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function PersonCard({
  entry,
  onPress,
  order,
  selected,
  width,
}: {
  entry: PersonQuotes;
  onPress: () => void;
  /** Position in the pile, which sets when the card lands. */
  order: number;
  selected: boolean;
  width: number;
}) {
  const { palette } = useApp();
  const { person, quotes } = entry;
  const metrics = polaroidMetrics(width);
  const photoHeight = metrics.photoWidth * 0.9;
  const { tilt } = polaroidPlacement(person.id, width);
  const front = quotes.find((quote) => quote.imageUri) ?? quotes[0];
  const photo = front.imageUri;
  // Their other quotes peek out from under the top one, fanned a little.
  const pile = quotes
    .filter((quote) => quote.id !== front.id)
    .slice(0, PILE.length);

  return (
    <Animated.View
      entering={FadeInDown.delay(60 + Math.min(order, 8) * 45)
        .duration(320)
        .easing(Easing.out(Easing.cubic))}
    >
      {/* Drawn deepest first, so each card lies on the one below it. */}
      {pile.map((_, index) => {
        const depth = pile.length - 1 - index;
        const quote = pile[depth];
        return (
          <View
            key={quote.id}
            pointerEvents="none"
            style={[
              styles.pileSlot,
              {
                transform: [
                  { translateX: PILE[depth].x * width },
                  { translateY: PILE[depth].y * width },
                  { rotate: `${tilt + PILE[depth].turn}deg` },
                ],
              },
            ]}
          >
            <SmoothEdges margin={CARD_EDGE_MARGIN} style={styles.fill}>
              <View
                style={[
                  styles.card,
                  styles.pileCard,
                  {
                    borderRadius: metrics.radius,
                    padding: metrics.padding,
                  },
                ]}
              >
                <View
                  style={[
                    styles.photo,
                    {
                      backgroundColor: person.color,
                      borderRadius: metrics.photoRadius,
                      height: photoHeight,
                    },
                  ]}
                >
                  {quote.imageUri ? (
                    <Image
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      recyclingKey={quote.imageUri}
                      source={quote.imageUri}
                      style={StyleSheet.absoluteFill}
                      transition={0}
                    />
                  ) : null}
                </View>
              </View>
            </SmoothEdges>
          </View>
        );
      })}
      <Pressable
        accessibilityLabel={`${person.name}, ${quotes.length} ${quotes.length === 1 ? "quote" : "quotes"}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          {
            transform: [
              { rotate: `${tilt}deg` },
              { scale: pressed ? 0.96 : 1 },
            ],
            width,
          },
        ]}
      >
        <SmoothEdges margin={CARD_EDGE_MARGIN}>
          <View
            style={[
              styles.card,
              {
                borderColor: selected ? "#161616" : "transparent",
                borderRadius: metrics.radius,
                padding: metrics.padding,
              },
            ]}
          >
            <View
              style={[
                styles.photo,
                {
                  backgroundColor: person.color,
                  borderRadius: metrics.photoRadius,
                  height: photoHeight,
                },
              ]}
            >
              {photo ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  recyclingKey={photo}
                  source={photo}
                  style={StyleSheet.absoluteFill}
                  transition={0}
                />
              ) : (
                <Text style={[styles.initial, { fontSize: width * 0.28 }]}>
                  {person.name.trim().charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <Text numberOfLines={1} style={styles.name}>
              {person.name}
            </Text>
            <Text style={[styles.count, { color: palette.textMuted }]}>
              {quotes.length} {quotes.length === 1 ? "quote" : "quotes"}
            </Text>
          </View>
        </SmoothEdges>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  allButton: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  allCount: {
    fontSize: 15,
    opacity: 0.55,
  },
  allText: {
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderCurve: "continuous",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  column: {
    flex: 1,
    gap: GAP + 6,
  },
  columns: {
    flexDirection: "row",
    gap: GAP,
    paddingHorizontal: GUTTER,
  },
  count: {
    fontSize: 13,
    marginTop: 1,
  },
  fill: {
    flex: 1,
  },
  empty: {
    fontSize: 15,
    marginTop: 40,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  initial: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  name: {
    color: "#161616",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginTop: 8,
  },
  pileCard: {
    borderColor: "transparent",
    flex: 1,
    shadowOpacity: 0.08,
  },
  pileSlot: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  photo: {
    alignItems: "center",
    borderCurve: "continuous",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.8,
    marginBottom: 22,
    marginTop: 18,
    paddingHorizontal: GUTTER + 4,
  },
});
