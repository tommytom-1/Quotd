import * as Sharing from "expo-sharing";
import { Check, ChevronLeft, Share, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  Share as NativeShare,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef, releaseCapture } from "react-native-view-shot";

import { Polaroid } from "@/components/polaroid";
import { WallBackground } from "@/components/wall-background";
import type { WallPolaroidOrigin } from "@/components/wall-polaroid";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSuccessHaptic } from "@/lib/haptics";
import {
  focusOrigin,
  mix,
  polaroidMetrics,
  polaroidPlacement,
  progressBetween,
} from "@/lib/polaroid";
import type { QuoteRecord } from "@/lib/types";

const CARD_TOP = 112;
const SHARE_AREA = 96;
const KEYBOARD_GAP = 16;

interface QuoteFocusProps {
  quote: QuoteRecord;
  origin: WallPolaroidOrigin;
  /** Hides the wall polaroid while this view shows the same one. */
  hiddenId: SharedValue<string | null>;
  /** 0–1: fades out the wall polaroids lying over the one being focused. */
  uncover: SharedValue<number>;
  onClose: () => void;
  onQuoteUpdated: (quote: QuoteRecord) => void;
  /** Title of the screen underneath, redrawn on the backdrop. */
  title?: string;
  backLabel?: string;
}

export function QuoteFocus({
  quote,
  origin,
  hiddenId,
  uncover,
  onClose,
  onQuoteUpdated,
  title = "Wall",
  backLabel = "Back to the wall",
}: QuoteFocusProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, updateQuote, deleteQuote } = useApp();
  const showToast = useToast();
  const bottomInset = Math.max(insets.bottom, 12);
  const cardWidth = Math.min(
    width - 22,
    440,
    (height - insets.top - bottomInset - CARD_TOP - SHARE_AREA - 40) / 1.3
  );
  const metrics = polaroidMetrics(cardWidth);
  const target = {
    height: metrics.height,
    width: cardWidth,
    x: (width - cardWidth) / 2,
    y: insets.top + CARD_TOP,
  };
  const paperRef = useRef<View>(null);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const editLift = useSharedValue(0);
  const cardVisible = useSharedValue(0);
  const closing = useSharedValue(false);
  const keepHidden = useSharedValue(false);
  const openingStarted = useRef(false);
  const isClosing = useRef(false);
  const afterDismissRef = useRef<(() => void) | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [transitionComplete, setTransitionComplete] = useState(false);
  const [modalShown, setModalShown] = useState(false);
  const covered = Boolean(origin.covered);
  const [uncovered, setUncovered] = useState(!covered);
  const [imageSettled, setImageSettled] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [shareComplete, setShareComplete] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A very long quote makes a tall polaroid. Shrink it, pinned to its top edge,
  // until the share button still fits beneath it.
  const restHeight = fullHeight ?? metrics.height;
  const availableHeight = height - target.y - bottomInset - SHARE_AREA;
  const restScale = Math.min(1, availableHeight / restHeight);
  const restTranslateY = (-(1 - restScale) * metrics.height) / 2;
  const restTilt = polaroidPlacement(quote.id, cardWidth).tilt * 0.6;
  // While the keyboard is up, the caption being edited rides just above it.
  const lift =
    keyboardTop === null
      ? 0
      : Math.max(
          0,
          target.y + restHeight * restScale + KEYBOARD_GAP - keyboardTop
        );
  const from = focusOrigin(origin.frame, origin.pose, target);
  const quoteId = quote.id;

  const showModalFeedback = (message: string, type: "success" | "error") => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    setModalFeedback({ message, type });
    feedbackTimer.current = setTimeout(() => setModalFeedback(null), 2200);
  };

  useEffect(
    () => () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
      if (shareTimer.current) {
        clearTimeout(shareTimer.current);
      }
      cancelAnimation(progress);
      cancelAnimation(dragY);
    },
    [dragY, progress]
  );

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const shown = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboardTop(event.endCoordinates.screenY)
    );
    const hidden = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardTop(null)
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    editLift.set(
      withTiming(lift, { duration: 260, easing: Easing.out(Easing.cubic) })
    );
  }, [editLift, lift]);

  const finishOpening = useCallback(() => {
    if (!isClosing.current) {
      setTransitionComplete(true);
    }
  }, []);

  const handleImageSettled = useCallback((ready: boolean) => {
    setImageReady(ready);
    // A failed photo still opens over the gradient fallback. Sharing stays
    // disabled, but the quote can be edited or dismissed.
    setImageSettled(true);
  }, []);

  // This polaroid lifts out of a stack. The ones lying over it fade away
  // first, so it never jumps through them; they return once it is back.
  useEffect(() => {
    if (covered) {
      uncover.set(
        withTiming(1, { duration: 140 }, () => {
          runOnJS(setUncovered)(true);
        })
      );
    }
  }, [covered, uncover]);

  useEffect(() => {
    if (
      !modalShown ||
      !uncovered ||
      !imageSettled ||
      fullHeight === null ||
      openingStarted.current ||
      isClosing.current
    ) {
      return;
    }
    openingStarted.current = true;
    // Swap the wall polaroid for this one in the same frame, then let it fly.
    hiddenId.set(quoteId);
    cardVisible.set(1);
    progress.set(
      withTiming(
        1,
        { duration: 460, easing: Easing.bezier(0.2, 0.82, 0.2, 1) },
        (finished) => {
          if (finished) {
            runOnJS(finishOpening)();
          }
        }
      )
    );
  }, [
    cardVisible,
    finishOpening,
    fullHeight,
    hiddenId,
    imageSettled,
    modalShown,
    progress,
    quoteId,
    uncovered,
  ]);

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: cardVisible.value,
      transform: [
        { translateX: mix(from.translateX, 0, p) },
        {
          translateY:
            mix(from.translateY, restTranslateY, p) +
            dragY.value * p -
            editLift.value,
        },
        { scale: mix(from.scale, restScale, p) },
        { rotate: `${mix(from.rotate, restTilt, p)}deg` },
      ],
    };
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progressBetween(progress.value, 0, 0.6),
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: progressBetween(progress.value, 0.6, 1),
  }));

  const finishDismiss = useCallback(() => {
    afterDismissRef.current?.();
    afterDismissRef.current = null;
    onClose();
  }, [onClose]);

  const closeFromOffset = useCallback(
    (offsetY?: number, afterDismiss?: () => void) => {
      if (isClosing.current) {
        return;
      }
      isClosing.current = true;
      afterDismissRef.current = afterDismiss ?? null;
      closing.set(true);
      cancelAnimation(dragY);
      if (offsetY !== undefined) {
        dragY.set(Math.max(0, offsetY));
      }
      setTransitionComplete(false);
      if (!openingStarted.current) {
        uncover.set(withTiming(0, { duration: 220 }));
        finishDismiss();
        return;
      }
      progress.set(
        withTiming(
          0,
          { duration: 360, easing: Easing.bezier(0.4, 0, 0.2, 1) },
          (finished) => {
            if (finished) {
              // The wall polaroid takes over before the modal unmounts.
              if (!keepHidden.value) {
                hiddenId.set(null);
              }
              uncover.set(withTiming(0, { duration: 220 }));
              runOnJS(finishDismiss)();
            }
          }
        )
      );
    },
    [closing, dragY, finishDismiss, hiddenId, keepHidden, progress, uncover]
  );

  // Leaving while a caption is being edited first puts the keyboard away.
  const dismiss = () => (isEditing ? Keyboard.dismiss() : closeFromOffset());

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(transitionComplete && !isSharing && !isEditing)
        .activeOffsetY(5)
        .failOffsetX([-20, 20])
        .onStart(() => {
          cancelAnimation(dragY);
          dragStartY.value = dragY.value;
        })
        .onUpdate((event) => {
          if (!closing.value) {
            dragY.value = Math.max(0, dragStartY.value + event.translationY);
          }
        })
        .onEnd((event) => {
          if (!closing.value && (dragY.value > 120 || event.velocityY > 1100)) {
            closing.value = true;
            runOnJS(closeFromOffset)(dragY.value);
          }
        })
        .onFinalize(() => {
          if (!closing.value) {
            dragY.value = withSpring(0, {
              damping: 22,
              mass: 0.9,
              stiffness: 210,
            });
          }
        }),
    [
      closeFromOffset,
      closing,
      dragStartY,
      dragY,
      isEditing,
      isSharing,
      transitionComplete,
    ]
  );

  const capturePolaroid = () => {
    if (
      !paperRef.current ||
      !imageReady ||
      !transitionComplete ||
      isClosing.current
    ) {
      throw new Error("The polaroid is not ready yet.");
    }

    // The paper is captured flat; its tilt lives on the wrapper around it.
    const outputWidth = Platform.OS === "ios" ? 1080 / PixelRatio.get() : 1080;
    return captureRef(paperRef.current, {
      format: "png",
      height: outputWidth * (restHeight / cardWidth),
      quality: 1,
      result: "tmpfile",
      width: outputWidth,
    });
  };

  const handleShare = async () => {
    if (isSharing) {
      return;
    }
    setIsSharing(true);
    let imageUri: string | null = null;
    try {
      imageUri = await capturePolaroid();
      const shareOperation = (await Sharing.isAvailableAsync())
        ? Sharing.shareAsync(imageUri, {
            dialogTitle: `Quote by ${quote.speaker}`,
            mimeType: "image/png",
            UTI: "public.png",
          })
        : NativeShare.share({
            message: `“${quote.text}” — ${quote.speaker}`,
            title: `Quote by ${quote.speaker}`,
          });
      await shareOperation;
      setShareComplete(true);
      if (shareTimer.current) {
        clearTimeout(shareTimer.current);
      }
      shareTimer.current = setTimeout(() => setShareComplete(false), 1800);
    } catch (error) {
      console.warn("[quotd-share]", error);
      showModalFeedback("Could not share this quote", "error");
    } finally {
      if (imageUri) {
        releaseCapture(imageUri);
      }
      setIsSharing(false);
    }
  };

  const handleEdit = async (updates: Pick<QuoteRecord, "text" | "speaker">) => {
    try {
      onQuoteUpdated(updateQuote(quote.id, updates));
      await playSuccessHaptic();
    } catch (error) {
      console.warn("[quotd-edit-quote]", error);
      showModalFeedback("Could not save your changes", "error");
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete this quote?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          // The wall polaroid stays hidden until the quote is gone.
          keepHidden.set(true);
          closeFromOffset(0, () => {
            try {
              deleteQuote(quote.id);
              showToast("Quote deleted", "info");
            } catch (error) {
              console.warn("[quotd-delete-quote]", error);
              showToast("Could not delete this quote", "error");
            }
          });
        },
      },
    ]);
  };

  const circleStyle = { backgroundColor: palette.surfaceMuted };
  const canShare = imageReady && !isSharing && !isEditing;
  const shareTop = Math.min(
    target.y + restHeight * restScale + 26,
    height - bottomInset - 60
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      onShow={() => setModalShown(true)}
      statusBarTranslucent
      transparent
      visible
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <Reanimated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <WallBackground />
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: palette.text, top: insets.top + 6 }]}
          >
            {title}
          </Text>
          <Pressable
            accessibilityLabel={backLabel}
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>

        <Reanimated.View
          pointerEvents={transitionComplete ? "box-none" : "none"}
          style={[StyleSheet.absoluteFill, chromeStyle]}
        >
          <Pressable
            accessibilityLabel={backLabel}
            accessibilityRole="button"
            hitSlop={6}
            onPress={dismiss}
            style={({ pressed }) => [
              styles.circleButton,
              circleStyle,
              { left: 22, top: insets.top + 44 },
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft color={palette.text} size={24} strokeWidth={2} />
          </Pressable>
          <Pressable
            accessibilityLabel="Delete quote"
            accessibilityRole="button"
            hitSlop={6}
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.circleButton,
              circleStyle,
              { right: 22, top: insets.top + 44 },
              pressed && styles.pressed,
            ]}
          >
            <Trash2 color={palette.danger} size={20} strokeWidth={2} />
          </Pressable>
          <Pressable
            accessibilityLabel={isSharing ? "Sharing" : "Share quote"}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canShare }}
            disabled={!canShare}
            onPress={handleShare}
            style={({ pressed }) => [
              styles.shareButton,
              { left: width / 2 - 28, top: shareTop },
              !canShare && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {shareComplete ? (
              <Check color={palette.text} size={26} strokeWidth={2} />
            ) : (
              <Share color={palette.text} size={26} strokeWidth={1.8} />
            )}
          </Pressable>
        </Reanimated.View>

        {/* One polaroid stays mounted through opening, sharing and dismissal. */}
        <GestureDetector gesture={panGesture}>
          <Reanimated.View
            pointerEvents={transitionComplete ? "auto" : "none"}
            style={[
              styles.card,
              {
                height: target.height,
                left: target.x,
                top: target.y,
                width: target.width,
              },
              cardStyle,
            ]}
          >
            <Polaroid
              focus={{
                editing: {
                  enabled: transitionComplete && !isSharing,
                  onActiveChange: setIsEditing,
                  onCommit: handleEdit,
                },
                onMeasured: setFullHeight,
                progress,
              }}
              onImageSettled={handleImageSettled}
              paperRef={paperRef}
              quote={quote}
              width={cardWidth}
            />
          </Reanimated.View>
        </GestureDetector>

        {modalFeedback ? (
          <View
            pointerEvents="none"
            style={[
              styles.modalFeedback,
              {
                backgroundColor:
                  modalFeedback.type === "error"
                    ? palette.danger
                    : palette.inverseSurface,
                top: insets.top + 10,
              },
            ]}
          >
            <Text
              style={[styles.modalFeedbackText, { color: palette.inverseText }]}
            >
              {modalFeedback.message}
            </Text>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Laid out at the wall polaroid's proportions so the default centre origin
  // matches the wall; the growing caption overflows below it.
  card: {
    position: "absolute",
  },
  circleButton: {
    alignItems: "center",
    borderRadius: 23,
    height: 46,
    justifyContent: "center",
    position: "absolute",
    width: 46,
  },
  disabled: {
    opacity: 0.4,
  },
  modalFeedback: {
    alignSelf: "center",
    borderRadius: 999,
    maxWidth: 340,
    paddingHorizontal: 16,
    paddingVertical: 11,
    position: "absolute",
    zIndex: 60,
  },
  modalFeedbackText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.96 }],
  },
  shareButton: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    position: "absolute",
    width: 56,
  },
  title: {
    fontSize: 17,
    left: 0,
    lineHeight: 22,
    position: "absolute",
    right: 0,
    textAlign: "center",
  },
});
