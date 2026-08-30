import MaskedView from "@react-native-masked-view/masked-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ImageStyle, StyleProp, ViewStyle } from "react-native";
import Animated, {
  createAnimatedComponent,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import type { QuoteArtworkVariant } from "@/lib/quote-grid";
import { QUOTE_RADII } from "@/lib/quote-style";
import {
  coverSize,
  coverTransform,
  fitTextScale,
  transitionOpacity,
  transitionSize,
} from "@/lib/quote-transition";
import type { ArtworkSize } from "@/lib/quote-transition";
import { formatDate, gradientForId, quoteFontSize } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

export interface ArtworkTransition {
  fromVariant: Exclude<QuoteArtworkVariant, "detail">;
  source: ArtworkSize;
  target: ArtworkSize;
  imageSize?: ArtworkSize;
  progress: SharedValue<number>;
}

interface QuoteArtworkProps {
  quote: QuoteRecord;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  onImageLoad?: (size: ArtworkSize) => void;
  onImageSettled?: (ready: boolean) => void;
  showMetadata?: boolean;
  variant?: QuoteArtworkVariant;
  transition?: ArtworkTransition;
}

interface ArtworkMetrics {
  bottom: number;
  fontSize: number;
  horizontal: number;
  lineHeight: number;
}

function previewFontSize(text: string, variant: QuoteArtworkVariant) {
  if (variant === "detail") {
    return quoteFontSize(text);
  }

  let base = 17;
  switch (variant) {
    case "hero": {
      base = 27;
      break;
    }
    case "wide": {
      base = 19;
      break;
    }
    case "tall": {
      base = 20;
      break;
    }
    default: {
      break;
    }
  }

  let multiplier = 1;
  if (text.length > 320) {
    multiplier = 0.58;
  } else if (text.length > 220) {
    multiplier = 0.67;
  } else if (text.length > 140) {
    multiplier = 0.76;
  } else if (text.length > 80) {
    multiplier = 0.88;
  }

  return Math.max(12.5, base * multiplier);
}

function metricsFor(
  text: string,
  variant: QuoteArtworkVariant
): ArtworkMetrics {
  const fontSize = previewFontSize(text, variant);
  let horizontal = 19;
  let bottom = 20;

  switch (variant) {
    case "detail": {
      horizontal = 24;
      bottom = 27;
      break;
    }
    case "hero": {
      horizontal = 25;
      bottom = 25;
      break;
    }
    case "square": {
      horizontal = 15;
      bottom = 15;
      break;
    }
    default: {
      break;
    }
  }

  return {
    bottom,
    fontSize,
    horizontal,
    lineHeight: fontSize * 1.23,
  };
}

function maxLinesFor(variant: QuoteArtworkVariant) {
  switch (variant) {
    case "square": {
      return 7;
    }
    case "wide": {
      return 5;
    }
    case "hero": {
      return 10;
    }
    case "tall": {
      return 14;
    }
    default: {
      return 999;
    }
  }
}

function StaticQuoteText({
  text,
  variant,
}: {
  text: string;
  variant: QuoteArtworkVariant;
}) {
  const metrics = metricsFor(text, variant);

  const textStyles = [
    styles.quote,
    variant !== "detail" && styles.previewQuote,
    { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight },
  ];
  const quoteText = (
    <Text
      allowFontScaling={false}
      numberOfLines={maxLinesFor(variant)}
      style={textStyles}
    >
      “{text}”
    </Text>
  );

  return (
    <View
      style={[
        styles.content,
        {
          bottom: metrics.bottom,
          left: metrics.horizontal,
          right: metrics.horizontal,
        },
      ]}
    >
      {quoteText}
    </View>
  );
}

function MetadataContent({ quote }: { quote: QuoteRecord }) {
  return (
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
  );
}

function TransitionTopShade({ progress }: { progress: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.72, 1], [0, 0, 1]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.topShade, animatedStyle]}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function TransitionMetadata({
  progress,
  quote,
}: {
  progress: SharedValue<number>;
  quote: QuoteRecord;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.72, 1], [0, 0, 1]),
    transform: [
      { translateY: (1 - transitionOpacity(progress.value, 0.72, 1)) * 8 },
    ],
  }));

  return (
    <Animated.View style={[styles.metadata, animatedStyle]}>
      <MetadataContent quote={quote} />
    </Animated.View>
  );
}

function TransitionTextLayer({
  text,
  transition,
  preview,
}: {
  text: string;
  transition: ArtworkTransition;
  preview: boolean;
}) {
  const { source, target, fromVariant, progress } = transition;
  const from = metricsFor(text, fromVariant);
  const to = metricsFor(text, "detail");
  const metrics = preview ? from : to;
  const size = preview ? source : target;
  const textWidth = size.width - metrics.horizontal * 2;
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const frame = transitionSize(source, target, p);
    // Both text blocks retain their original widths and line breaks. Only their
    // position, scale and opacity change; the full quote is present before landing.
    const mix = transitionOpacity(p, 0.2, 0.8);
    const horizontal = interpolate(p, [0, 1], [from.horizontal, to.horizontal]);
    const fontScale =
      interpolate(p, [0, 1], [from.fontSize, to.fontSize]) / metrics.fontSize;
    return {
      opacity: preview ? 1 - mix : mix,
      transform: [
        {
          translateX: horizontal,
        },
        {
          translateY:
            frame.height -
            target.height -
            interpolate(p, [0, 1], [from.bottom, to.bottom]),
        },
        {
          scale: fitTextScale(
            fontScale,
            textWidth,
            frame.width - horizontal * 2
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={preview}
      importantForAccessibility={preview ? "no-hide-descendants" : "auto"}
      style={[
        styles.content,
        {
          bottom: 0,
          left: 0,
          width: textWidth,
          transformOrigin: "left bottom",
        },
        animatedStyle,
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={maxLinesFor(preview ? fromVariant : "detail")}
        style={[
          styles.quote,
          preview && styles.previewQuote,
          { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight },
        ]}
      >
        “{text}”
      </Text>
    </Animated.View>
  );
}

const AnimatedImage = createAnimatedComponent(Image);
type ImageStatus = "loading" | "displayed" | "error";

function ArtworkBackground({
  quote,
  transition,
  onImageLoad,
  onImageSettled,
}: Pick<
  QuoteArtworkProps,
  "quote" | "transition" | "onImageLoad" | "onImageSettled"
>) {
  const [imageSize, setImageSize] = useState(transition?.imageSize);
  const [baseStatus, setBaseStatus] = useState<ImageStatus>("loading");
  const [blurStatus, setBlurStatus] = useState<ImageStatus>("loading");
  const gradient = gradientForId(quote.id);
  const target = transition?.target;
  const image = target ? coverSize(imageSize ?? target, target) : null;

  useEffect(() => {
    if (!quote.imageUri) {
      onImageSettled?.(true);
    } else if (baseStatus !== "loading" && blurStatus !== "loading") {
      onImageSettled?.(
        baseStatus === "displayed" && blurStatus === "displayed"
      );
    }
  }, [baseStatus, blurStatus, onImageSettled, quote.imageUri]);

  const canvasStyle = useAnimatedStyle(() => {
    if (!transition) {
      return {};
    }
    const frame = transitionSize(
      transition.source,
      transition.target,
      transition.progress.value
    );
    return {
      transform: [
        { scaleX: frame.width / transition.target.width },
        { scaleY: frame.height / transition.target.height },
      ],
    };
  });
  const imageStyle = useAnimatedStyle(() => {
    if (!transition || !image) {
      return {};
    }
    const frame = transitionSize(
      transition.source,
      transition.target,
      transition.progress.value
    );
    const transform = coverTransform(image, transition.target, frame);
    return {
      transform: [
        { translateX: transform.translateX },
        { translateY: transform.translateY },
        { scaleX: transform.scaleX },
        { scaleY: transform.scaleY },
      ],
    };
  });
  const fixedImageStyle: StyleProp<ImageStyle> = image
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        ...image,
        transformOrigin: "top left",
      }
    : StyleSheet.absoluteFill;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        target
          ? {
              position: "absolute",
              top: 0,
              left: 0,
              width: target.width,
              height: target.height,
              transformOrigin: "top left",
            }
          : StyleSheet.absoluteFill,
        canvasStyle,
      ]}
    >
      <LinearGradient
        colors={gradient}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {quote.imageUri ? (
        <>
          <AnimatedImage
            cachePolicy="memory-disk"
            contentFit="cover"
            onDisplay={
              onImageSettled ? () => setBaseStatus("displayed") : undefined
            }
            onError={onImageSettled ? () => setBaseStatus("error") : undefined}
            onLoad={({ source }) => {
              const size = { width: source.width, height: source.height };
              if (size.width > 0 && size.height > 0) {
                onImageLoad?.(size);
                if (
                  transition &&
                  (imageSize?.width !== size.width ||
                    imageSize?.height !== size.height)
                ) {
                  setImageSize(size);
                }
              }
            }}
            recyclingKey={quote.imageUri}
            source={quote.imageUri}
            style={[fixedImageStyle, imageStyle]}
            transition={0}
          />
          <MaskedView
            androidRenderingMode="hardware"
            maskElement={
              <LinearGradient
                colors={[
                  "transparent",
                  "transparent",
                  "rgba(0,0,0,0.3)",
                  "#000",
                ]}
                locations={[0, 0.45, 0.72, 1]}
                style={StyleSheet.absoluteFill}
              />
            }
            style={StyleSheet.absoluteFill}
          >
            <AnimatedImage
              blurRadius={18}
              cachePolicy="memory-disk"
              contentFit="cover"
              onDisplay={
                onImageSettled ? () => setBlurStatus("displayed") : undefined
              }
              onError={
                onImageSettled ? () => setBlurStatus("error") : undefined
              }
              recyclingKey={`${quote.imageUri}-blur`}
              source={quote.imageUri}
              style={[fixedImageStyle, imageStyle]}
              transition={0}
            />
          </MaskedView>
        </>
      ) : null}
      <LinearGradient
        colors={
          quote.imageUri
            ? ["transparent", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.88)"]
            : ["transparent", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.62)"]
        }
        locations={[0, 0.38, 1]}
        style={styles.bottomShade}
      />
    </Animated.View>
  );
}

export const QuoteArtwork = forwardRef<View, QuoteArtworkProps>(
  (
    {
      quote,
      style,
      borderRadius = QUOTE_RADII.detail,
      onImageLoad,
      onImageSettled,
      showMetadata = true,
      variant = "detail",
      transition,
    },
    ref
  ) => {
    const transitionProgress = transition?.progress;
    const sourceRadius = transition
      ? QUOTE_RADII[transition.fromVariant]
      : borderRadius;
    const clipStyle = useAnimatedStyle(() => {
      if (!transition) {
        return {};
      }
      return {
        ...transitionSize(
          transition.source,
          transition.target,
          transition.progress.value
        ),
        borderRadius: interpolate(
          transition.progress.value,
          [0, 1],
          [sourceRadius, borderRadius]
        ),
      };
    });
    let metadata = null;
    let topShade = null;
    if (showMetadata) {
      metadata = transitionProgress ? (
        <TransitionMetadata progress={transitionProgress} quote={quote} />
      ) : (
        <View style={styles.metadata}>
          <MetadataContent quote={quote} />
        </View>
      );
      topShade = transitionProgress ? (
        <TransitionTopShade progress={transitionProgress} />
      ) : (
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "transparent"]}
          pointerEvents="none"
          style={styles.topShade}
        />
      );
    }

    return (
      <Animated.View
        ref={ref}
        collapsable={false}
        style={[
          styles.container,
          { borderCurve: "continuous", borderRadius },
          style,
          clipStyle,
        ]}
      >
        <ArtworkBackground
          key={quote.imageUri ?? quote.id}
          onImageLoad={onImageLoad}
          onImageSettled={onImageSettled}
          quote={quote}
          transition={transition}
        />
        <View
          pointerEvents="none"
          style={
            transition
              ? {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: transition.target.width,
                  height: transition.target.height,
                }
              : StyleSheet.absoluteFill
          }
        >
          {topShade}
          {transition ? (
            <>
              <TransitionTextLayer
                preview
                text={quote.text}
                transition={transition}
              />
              <TransitionTextLayer
                preview={false}
                text={quote.text}
                transition={transition}
              />
            </>
          ) : (
            <StaticQuoteText text={quote.text} variant={variant} />
          )}
          {metadata}
        </View>
      </Animated.View>
    );
  }
);
QuoteArtwork.displayName = "QuoteArtwork";

const styles = StyleSheet.create({
  bottomShade: {
    bottom: 0,
    height: "72%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  container: {
    backgroundColor: "#777",
    overflow: "hidden",
  },
  content: {
    position: "absolute",
  },
  edited: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 10,
    fontWeight: "600",
  },
  metadata: {
    left: 24,
    position: "absolute",
    right: 24,
    top: 65,
  },
  pill: {
    backgroundColor: "rgba(24,24,24,0.58)",
    borderColor: "rgba(255,255,255,0.13)",
    borderRadius: 8,
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
  previewQuote: {
    fontWeight: "600",
  },
  quote: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: -0.55,
    textShadowColor: "rgba(0,0,0,0.34)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  topShade: {
    height: 125,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
