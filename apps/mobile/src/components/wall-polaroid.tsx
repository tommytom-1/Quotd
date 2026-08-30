import { Image } from "expo-image";
import { memo, useEffect, useRef, useState } from "react";
import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  createAnimatedComponent,
  useAnimatedProps,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { captureRef, releaseCapture } from "react-native-view-shot";

import { Polaroid } from "@/components/polaroid";
import {
  exitPose,
  exitProgress,
  polaroidMetrics,
  polaroidPlacement,
  progressBetween,
} from "@/lib/polaroid";
import type { PolaroidPose } from "@/lib/polaroid";
import { formatDate } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

const AnimatedImage = createAnimatedComponent(Image);

// The blurred copies are tiny: a blur hides the missing detail.
const SNAPSHOT_PIXELS = 330;
const SOFT_BLUR = 7;
const HEAVY_BLUR = 22;

/** Where a wall polaroid was on screen when it was opened. */
export interface WallPolaroidOrigin {
  /** Whether other polaroids lie over this one and must clear out first. */
  covered?: boolean;
  frame: { x: number; y: number; width: number; height: number };
  pose: PolaroidPose;
}

interface WallPolaroidProps {
  quote: QuoteRecord;
  index: number;
  /** The last polaroid has nothing beneath it to reveal, so it never leaves. */
  isLast: boolean;
  width: number;
  scrollY: SharedValue<number>;
  /** ID of the quote shown in the focus view, whose wall copy stays hidden. */
  hiddenId: SharedValue<string | null>;
  /** Index of the polaroid being focused, or -1. */
  focusedIndex: SharedValue<number>;
  /** 0–1: how far the polaroids lying over the focused one have faded away. */
  uncover: SharedValue<number>;
  onOpen: (quote: QuoteRecord, origin: WallPolaroidOrigin) => void;
}

export const WallPolaroid = memo(
  ({
    quote,
    index,
    isLast,
    width,
    scrollY,
    hiddenId,
    focusedIndex,
    uncover,
    onOpen,
  }: WallPolaroidProps) => {
    const slotRef = useRef<View>(null);
    const snapshotRef = useRef<View>(null);
    const [imageSettled, setImageSettled] = useState(false);
    const [snapshot, setSnapshot] = useState<string | null>(null);
    const metrics = polaroidMetrics(width);
    const { tilt, offsetX } = polaroidPlacement(quote.id, width);
    const quoteId = quote.id;
    // Parked far down the list, the last polaroid's exit never begins.
    const exitIndex = isLast ? Number.MAX_SAFE_INTEGER : index;
    // Transparent room around the snapshot for the blur to spill into, so the
    // paper's edge goes soft along with everything printed on it.
    const bleed = width * 0.14;
    const snapshotWidth = width + bleed * 2;
    const snapshotHeight = metrics.height + bleed * 2;

    useEffect(() => {
      if (!imageSettled) {
        return;
      }
      let cancelled = false;
      let uri: string | null = null;
      // Wait a frame so the photo that just settled is on screen to capture.
      const frame = requestAnimationFrame(async () => {
        if (!snapshotRef.current) {
          return;
        }
        try {
          const outputWidth =
            Platform.OS === "ios"
              ? SNAPSHOT_PIXELS / PixelRatio.get()
              : SNAPSHOT_PIXELS;
          uri = await captureRef(snapshotRef.current, {
            format: "png",
            height: outputWidth * (snapshotHeight / snapshotWidth),
            result: "tmpfile",
            width: outputWidth,
          });
          if (cancelled) {
            releaseCapture(uri);
          } else {
            setSnapshot(uri);
          }
        } catch (error) {
          // Without a snapshot the polaroid still lifts off and fades.
          console.warn("[quotd-polaroid-snapshot]", error);
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        if (uri) {
          releaseCapture(uri);
        }
        setSnapshot(null);
      };
    }, [
      imageSettled,
      quote.imageUri,
      quote.speaker,
      quote.text,
      snapshotHeight,
      snapshotWidth,
    ]);

    const hasSnapshot = snapshot !== null;
    const cardStyle = useAnimatedStyle(() => {
      const pose = exitPose(
        exitProgress(scrollY.value, exitIndex, metrics.step),
        tilt,
        metrics
      );
      // Polaroids stacked over the focused one clear out of its way.
      const stacked = index < focusedIndex.value ? 1 - uncover.value : 1;
      return {
        opacity: hiddenId.value === quoteId ? 0 : pose.opacity * stacked,
        transform: [
          { translateX: pose.translateX },
          { translateY: pose.translateY },
          { scale: pose.scale },
          { rotate: `${pose.rotate}deg` },
        ],
      };
    });
    // A polaroid on its way out floats over the next one and must not steal its taps.
    const cardProps = useAnimatedProps(() => ({
      pointerEvents:
        exitProgress(scrollY.value, exitIndex, metrics.step) > 0.45
          ? ("none" as const)
          : ("auto" as const),
    }));
    // Going out of focus: the sharp polaroid hands over to a softly blurred
    // copy, which in turn hands over to a heavily blurred one.
    const sharpStyle = useAnimatedStyle(() => {
      const progress = exitProgress(scrollY.value, exitIndex, metrics.step);
      return {
        opacity: hasSnapshot ? 1 - progressBetween(progress, 0.5, 0.62) : 1,
      };
    });
    const softStyle = useAnimatedStyle(() => {
      const progress = exitProgress(scrollY.value, exitIndex, metrics.step);
      return {
        opacity:
          progressBetween(progress, 0.32, 0.52) -
          progressBetween(progress, 0.84, 0.96),
      };
    });
    const heavyStyle = useAnimatedStyle(() => ({
      opacity: progressBetween(
        exitProgress(scrollY.value, exitIndex, metrics.step),
        0.6,
        0.86
      ),
    }));

    const open = () => {
      slotRef.current?.measureInWindow((x, y, frameWidth, frameHeight) => {
        if (frameWidth > 0 && frameHeight > 0) {
          focusedIndex.set(index);
          onOpen(quote, {
            covered: index > 0,
            frame: { height: frameHeight, width: frameWidth, x, y },
            pose: exitPose(
              exitProgress(scrollY.get(), exitIndex, metrics.step),
              tilt,
              metrics
            ),
          });
        }
      });
    };

    const snapshotFrame = {
      height: snapshotHeight,
      left: -bleed,
      top: -bleed,
      width: snapshotWidth,
    };

    return (
      <View style={[styles.row, { height: metrics.step }]}>
        <View
          ref={slotRef}
          collapsable={false}
          style={{ height: metrics.height, left: offsetX, width }}
        >
          <Animated.View animatedProps={cardProps} style={cardStyle}>
            <Animated.View style={sharpStyle}>
              <View
                ref={snapshotRef}
                collapsable={false}
                pointerEvents="box-none"
                style={{ margin: -bleed, padding: bleed }}
              >
                <Pressable
                  accessibilityLabel={`"${quote.text}", by ${quote.speaker}, ${formatDate(quote.createdAt)}`}
                  accessibilityRole="button"
                  onPress={open}
                >
                  <Polaroid
                    onImageSettled={() => setImageSettled(true)}
                    quote={quote}
                    width={width}
                  />
                </Pressable>
              </View>
            </Animated.View>
            {snapshot ? (
              <>
                <AnimatedImage
                  blurRadius={SOFT_BLUR}
                  contentFit="fill"
                  pointerEvents="none"
                  source={snapshot}
                  style={[styles.snapshot, snapshotFrame, softStyle]}
                />
                <AnimatedImage
                  blurRadius={HEAVY_BLUR}
                  contentFit="fill"
                  pointerEvents="none"
                  source={snapshot}
                  style={[styles.snapshot, snapshotFrame, heavyStyle]}
                />
              </>
            ) : null}
          </Animated.View>
        </View>
      </View>
    );
  }
);
WallPolaroid.displayName = "WallPolaroid";

const styles = StyleSheet.create({
  // Rows are shorter than a polaroid, so each one tucks under the one above.
  row: {
    alignItems: "center",
  },
  snapshot: {
    position: "absolute",
  },
});
