import { useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import type { StyleProp, View, ViewStyle } from "react-native";

import { QuoteArtwork } from "@/components/quote-artwork";
import type { QuoteArtworkVariant } from "@/lib/quote-grid";
import { QUOTE_RADII } from "@/lib/quote-style";
import type { ArtworkSize } from "@/lib/quote-transition";
import { formatDate } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

export interface QuoteCardFrame {
  height: number;
  width: number;
  x: number;
  y: number;
  imageSize?: ArtworkSize;
}

interface QuoteCardProps {
  onPress: (frame: QuoteCardFrame) => void;
  quote: QuoteRecord;
  style?: StyleProp<ViewStyle>;
  variant: Exclude<QuoteArtworkVariant, "detail">;
}

export function QuoteCard({ quote, onPress, style, variant }: QuoteCardProps) {
  const cardRef = useRef<View>(null);
  const imageSize = useRef<ArtworkSize | null>(null);
  const borderRadius = QUOTE_RADII[variant];

  const open = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onPress({
          height,
          width,
          x,
          y,
          imageSize: imageSize.current ?? undefined,
        });
      }
    });
  };

  return (
    <Pressable
      ref={cardRef}
      accessibilityLabel={`“${quote.text}”, by ${quote.speaker}, ${formatDate(quote.createdAt)}`}
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        { borderCurve: "continuous", borderRadius },
        style,
        pressed && styles.pressed,
      ]}
    >
      <QuoteArtwork
        borderRadius={borderRadius}
        onImageLoad={(size) => {
          imageSize.current = size;
        }}
        quote={quote}
        showMetadata={false}
        style={StyleSheet.absoluteFill}
        variant={variant}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.9,
  },
});
