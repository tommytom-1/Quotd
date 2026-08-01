import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { formatDate, gradientForId, quoteFontSize } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

interface QuoteArtworkProps {
  quote: QuoteRecord;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  onImageReady?: () => void;
}

export const QuoteArtwork = forwardRef<View, QuoteArtworkProps>(
  ({ quote, style, borderRadius = 34, onImageReady }, ref) => {
    const gradient = gradientForId(quote.id);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.container, { borderRadius }, style]}
      >
        {quote.imageUri ? (
          <Image
            onLoadEnd={onImageReady}
            source={{ uri: quote.imageUri }}
            style={styles.background}
          />
        ) : (
          <LinearGradient
            colors={gradient}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.background}
          />
        )}

        <LinearGradient
          colors={
            quote.imageUri
              ? ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.84)"]
              : ["rgba(0,0,0,0.16)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.56)"]
          }
          locations={[0, 0.42, 1]}
          style={styles.background}
        />

        <View style={styles.content}>
          <Text
            allowFontScaling={false}
            style={[
              styles.quote,
              {
                fontSize: quoteFontSize(quote.text),
                lineHeight: quoteFontSize(quote.text) * 1.23,
              },
            ]}
          >
            “{quote.text}”
          </Text>

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={styles.pillText}
              >
                {quote.speaker}
              </Text>
            </View>
            <View style={styles.pill}>
              <Text allowFontScaling={false} style={styles.pillText}>
                {formatDate(quote.createdAt)}
              </Text>
            </View>
            {quote.updatedAt ? (
              <Text allowFontScaling={false} style={styles.edited}>
                edited
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }
);
QuoteArtwork.displayName = "QuoteArtwork";

const styles = StyleSheet.create({
  background: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  container: {
    backgroundColor: "#777",
    overflow: "hidden",
  },
  content: {
    bottom: 27,
    left: 24,
    position: "absolute",
    right: 24,
  },
  edited: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 10,
    fontWeight: "600",
  },
  pill: {
    backgroundColor: "rgba(24,24,24,0.58)",
    borderColor: "rgba(255,255,255,0.13)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 170,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  pillRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  pillText: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: "600",
  },
  quote: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: -0.65,
    marginBottom: 17,
    textShadowColor: "rgba(0,0,0,0.28)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
});
