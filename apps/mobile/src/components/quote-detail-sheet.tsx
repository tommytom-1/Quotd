import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import {
  ArrowDownToLine,
  Check,
  Pencil,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  Share,
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
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef, releaseCapture } from "react-native-view-shot";

import { EditQuoteSheet } from "@/components/edit-quote-sheet";
import { QuoteArtwork } from "@/components/quote-artwork";
import type { QuoteCardFrame } from "@/components/quote-card";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSuccessHaptic } from "@/lib/haptics";
import type { QuoteArtworkVariant } from "@/lib/quote-grid";
import { QUOTE_RADII } from "@/lib/quote-style";
import { transitionOpacity, transitionSize } from "@/lib/quote-transition";
import type { QuoteRecord } from "@/lib/types";

type WorkingAction = "share" | "save" | null;

interface QuoteDetailSheetProps {
  quote: QuoteRecord;
  onClose: () => void;
  onQuoteUpdated: (quote: QuoteRecord) => void;
  sourceFrame: QuoteCardFrame;
  sourceVariant: Exclude<QuoteArtworkVariant, "detail">;
}

export function QuoteDetailSheet({
  quote,
  onClose,
  onQuoteUpdated,
  sourceFrame,
  sourceVariant,
}: QuoteDetailSheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, updateQuote, deleteQuote } = useApp();
  const showToast = useToast();
  const sheetHeight = Math.min(height * 0.92, 860);
  const maxCardWidth = Math.min(width - 28, 430);
  const maxCardHeight = sheetHeight - Math.max(insets.bottom, 12) - 116;
  const cardWidth = Math.min(maxCardWidth, maxCardHeight * 0.75);
  const cardHeight = cardWidth * (4 / 3);
  const sheetTop = height - sheetHeight;
  const targetFrame = {
    height: cardHeight,
    width: cardWidth,
    x: (width - cardWidth) / 2,
    y: sheetTop + 32,
  };
  const artworkRef = useRef<View>(null);
  const transitionProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const artworkVisible = useSharedValue(0);
  const closing = useSharedValue(false);
  const openingStarted = useRef(false);
  const isClosing = useRef(false);
  const afterDismissRef = useRef<(() => void) | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [transitionComplete, setTransitionComplete] = useState(false);
  const [modalShown, setModalShown] = useState(false);
  const [artworkSettled, setArtworkSettled] = useState(!quote.imageUri);
  const [artworkReady, setArtworkReady] = useState(!quote.imageUri);
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null);
  const [shareComplete, setShareComplete] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      cancelAnimation(transitionProgress);
      cancelAnimation(dragY);
    },
    [dragY, transitionProgress]
  );

  const finishOpening = useCallback(() => {
    if (!isClosing.current) {
      setTransitionComplete(true);
    }
  }, []);

  const handleImageSettled = useCallback((ready: boolean) => {
    setArtworkReady(ready);
    // Image errors still open the sheet with a gradient fallback. Exporting an
    // incomplete photo card stays disabled, but the user can edit or dismiss it.
    setArtworkSettled(true);
  }, []);

  useEffect(() => {
    if (
      !modalShown ||
      !artworkSettled ||
      openingStarted.current ||
      isClosing.current
    ) {
      return;
    }
    openingStarted.current = true;
    artworkVisible.value = 1;
    transitionProgress.value = withTiming(
      1,
      {
        duration: 420,
        easing: Easing.bezier(0.2, 0.82, 0.2, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishOpening)();
        }
      }
    );
  }, [
    artworkSettled,
    artworkVisible,
    finishOpening,
    modalShown,
    transitionProgress,
  ]);

  const sourceRadius = QUOTE_RADII[sourceVariant];
  const detailRadius = QUOTE_RADII.detail;
  const sharedCardStyle = useAnimatedStyle(() => ({
    ...transitionSize(sourceFrame, targetFrame, transitionProgress.value),
    opacity: artworkVisible.value,
    borderRadius: interpolate(
      transitionProgress.value,
      [0, 1],
      [sourceRadius, detailRadius]
    ),
    shadowOpacity: 0.2 * transitionProgress.value,
    transform: [
      {
        translateX:
          (sourceFrame.x - targetFrame.x) * (1 - transitionProgress.value),
      },
      {
        translateY:
          (sourceFrame.y - targetFrame.y) * (1 - transitionProgress.value) +
          dragY.value * transitionProgress.value,
      },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity(transitionProgress.value, 0, 0.65),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity(transitionProgress.value, 0, 0.8),
    transform: [{ translateY: dragY.value * transitionProgress.value }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity(transitionProgress.value, 0.65, 1),
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
      closing.value = true;
      cancelAnimation(dragY);
      if (offsetY !== undefined) {
        dragY.value = Math.max(0, offsetY);
      }
      setTransitionComplete(false);
      if (!openingStarted.current) {
        finishDismiss();
        return;
      }
      transitionProgress.value = withTiming(
        0,
        {
          duration: 340,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(finishDismiss)();
          }
        }
      );
    },
    [closing, dragY, finishDismiss, transitionProgress]
  );

  const dismiss = useCallback(() => closeFromOffset(), [closeFromOffset]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(transitionComplete && !workingAction && !isEditing)
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
      transitionComplete,
      workingAction,
    ]
  );

  const captureArtwork = () => {
    if (
      !artworkRef.current ||
      !artworkReady ||
      !transitionComplete ||
      isClosing.current
    ) {
      throw new Error("The quote artwork is not ready yet.");
    }

    const pixelRatio = PixelRatio.get();
    const outputWidth = Platform.OS === "ios" ? 1080 / pixelRatio : 1080;
    const outputHeight = Platform.OS === "ios" ? 1440 / pixelRatio : 1440;
    return captureRef(artworkRef.current, {
      format: "png",
      height: outputHeight,
      quality: 1,
      result: "tmpfile",
      width: outputWidth,
    });
  };

  const handleShare = async () => {
    if (workingAction) {
      return;
    }
    setWorkingAction("share");
    let artworkUri: string | null = null;
    try {
      artworkUri = await captureArtwork();
      const shareOperation = (await Sharing.isAvailableAsync())
        ? Sharing.shareAsync(artworkUri, {
            dialogTitle: `Quote by ${quote.speaker}`,
            mimeType: "image/png",
            UTI: "public.png",
          })
        : Share.share({
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
      if (artworkUri) {
        releaseCapture(artworkUri);
      }
      setWorkingAction(null);
    }
  };

  const handleSave = async () => {
    if (workingAction) {
      return;
    }
    setWorkingAction("save");
    let artworkUri: string | null = null;
    try {
      const permission = await requestPermissionsAsync(true, []);
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow Quotd to add finished quote cards to your photo library."
        );
        return;
      }

      artworkUri = await captureArtwork();
      await Asset.create(artworkUri);
      await playSuccessHaptic();
      showModalFeedback("Saved to your photo library", "success");
    } catch (error) {
      console.warn("[quotd-save-card]", error);
      showModalFeedback("Could not save this quote", "error");
    } finally {
      if (artworkUri) {
        releaseCapture(artworkUri);
      }
      setWorkingAction(null);
    }
  };

  const handleEditSave = async (text: string, speaker: string) => {
    const updated = await updateQuote(quote.id, { text, speaker });
    onQuoteUpdated(updated);
    setIsEditing(false);
    await playSuccessHaptic();
    showModalFeedback("Changes saved", "success");
  };

  const handleDelete = () => {
    Alert.alert("Delete this quote?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
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

  return (
    <Modal
      animationType="none"
      onRequestClose={() => (isEditing ? setIsEditing(false) : dismiss())}
      onShow={() => setModalShown(true)}
      statusBarTranslucent
      transparent
      visible
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <Reanimated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: palette.overlay,
            },
            backdropStyle,
          ]}
        >
          <Pressable
            accessibilityLabel="Close quote details"
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>

        <Reanimated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.background,
              height: sheetHeight,
              paddingBottom: Math.max(insets.bottom, 12),
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <Reanimated.View>
              <Pressable
                accessibilityLabel="Close quote details"
                accessibilityHint="Swipe down or double tap to close"
                accessibilityRole="button"
                onPress={dismiss}
                style={styles.handleArea}
              >
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: palette.textMuted },
                  ]}
                />
              </Pressable>
            </Reanimated.View>
          </GestureDetector>

          <View pointerEvents="none" style={{ height: cardHeight }} />

          <Reanimated.View
            pointerEvents={transitionComplete ? "auto" : "none"}
            style={[styles.actions, chromeStyle]}
          >
            <ActionButton
              icon={<Pencil color={palette.text} size={16} strokeWidth={1.9} />}
              label="Edit"
              onPress={() => setIsEditing(true)}
            />
            <ActionButton
              disabled={Boolean(workingAction) || !artworkReady}
              icon={
                shareComplete ? (
                  <Check color={palette.text} size={16} strokeWidth={2.2} />
                ) : (
                  <Share2 color={palette.text} size={16} strokeWidth={1.9} />
                )
              }
              label={workingAction === "share" ? "Sharing…" : "Share"}
              onPress={handleShare}
            />
            <ActionButton
              disabled={Boolean(workingAction) || !artworkReady}
              icon={
                <ArrowDownToLine
                  color={palette.text}
                  size={16}
                  strokeWidth={1.9}
                />
              }
              label={workingAction === "save" ? "Saving…" : "Save"}
              onPress={handleSave}
            />
          </Reanimated.View>
        </Reanimated.View>

        {/* This artwork stays mounted through opening, sharing and dismissal. */}
        <Reanimated.View
          pointerEvents={transitionComplete ? "auto" : "none"}
          style={[
            styles.sharedArtwork,
            { left: targetFrame.x, top: targetFrame.y },
            sharedCardStyle,
          ]}
        >
          <QuoteArtwork
            ref={artworkRef}
            borderRadius={detailRadius}
            onImageSettled={handleImageSettled}
            quote={quote}
            transition={{
              fromVariant: sourceVariant,
              source: sourceFrame,
              target: targetFrame,
              imageSize: sourceFrame.imageSize,
              progress: transitionProgress,
            }}
            variant="detail"
          />
          <Reanimated.View
            pointerEvents="box-none"
            style={[styles.artworkChrome, chromeStyle]}
          >
            <Pressable
              accessibilityLabel="Close"
              hitSlop={5}
              onPress={dismiss}
              style={({ pressed }) => [
                styles.artworkIcon,
                styles.closeArtworkIcon,
                pressed && styles.pressed,
              ]}
            >
              <X color="#FFFFFF" size={16} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              accessibilityLabel="Delete quote"
              hitSlop={5}
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.artworkIcon,
                styles.deleteArtworkIcon,
                pressed && styles.pressed,
              ]}
            >
              <Trash2 color="#FFFFFF" size={15} strokeWidth={1.9} />
            </Pressable>
          </Reanimated.View>
        </Reanimated.View>

        {isEditing ? (
          <EditQuoteSheet
            initialSpeaker={quote.speaker}
            initialText={quote.text}
            onClose={() => setIsEditing(false)}
            onSave={handleEditSave}
          />
        ) : null}

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

function ActionButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useApp();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 17,
    paddingHorizontal: 16,
  },
  artworkChrome: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  artworkIcon: {
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.48)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    top: 14,
    width: 38,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  closeArtworkIcon: {
    left: 14,
  },
  deleteArtworkIcon: {
    right: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  handle: {
    borderRadius: 999,
    height: 4,
    opacity: 0.5,
    width: 40,
  },
  handleArea: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
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
    justifyContent: "flex-end",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  sharedArtwork: {
    backgroundColor: "#777",
    borderCurve: "continuous",
    elevation: 8,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
  },
  sheet: {
    borderCurve: "continuous",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
});
