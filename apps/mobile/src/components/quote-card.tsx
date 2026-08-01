import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/context/app-context";
import { formatDate, gradientForId } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

export function QuoteCard({
  quote,
  onPress,
}: {
  quote: QuoteRecord;
  onPress: () => void;
}) {
  const { palette } = useApp();
  const gradient = gradientForId(quote.id);

  return (
    <Pressable
      accessibilityLabel={`“${quote.text}”, by ${quote.speaker}, ${formatDate(quote.createdAt)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.surface },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.thumbnail}>
        {quote.imageUri ? (
          <Image source={{ uri: quote.imageUri }} style={styles.image} />
        ) : (
          <LinearGradient
            colors={gradient}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.image}
          />
        )}
      </View>

      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.quote, { color: palette.text }]}>
          “{quote.text}”
        </Text>
        <View style={styles.pillRow}>
          <View
            style={[styles.pill, { backgroundColor: palette.surfaceMuted }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.pillText, { color: palette.textSecondary }]}
            >
              {quote.speaker}
            </Text>
          </View>
          <View
            style={[styles.pill, { backgroundColor: palette.surfaceMuted }]}
          >
            <Text style={[styles.pillText, { color: palette.textMuted }]}>
              {formatDate(quote.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 25,
    flexDirection: "row",
    gap: 15,
    minHeight: 104,
    padding: 15,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  image: {
    height: "100%",
    width: "100%",
  },
  pill: {
    borderRadius: 999,
    maxWidth: 145,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  quote: {
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.25,
    lineHeight: 22,
    marginBottom: 10,
  },
  thumbnail: {
    borderRadius: 17,
    height: 74,
    overflow: "hidden",
    width: 74,
  },
});
