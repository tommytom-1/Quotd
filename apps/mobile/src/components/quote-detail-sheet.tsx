import { LinearGradient } from "expo-linear-gradient";
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
  Animated,
  Modal,
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef, releaseCapture } from "react-native-view-shot";

import { EditQuoteSheet } from "@/components/edit-quote-sheet";
import { QuoteArtwork } from "@/components/quote-artwork";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSuccessHaptic } from "@/lib/haptics";
import type { QuoteRecord } from "@/lib/types";

type WorkingAction = "share" | "save" | null;

interface QuoteDetailSheetProps {
  quote: QuoteRecord;
  onClose: () => void;
  onQuoteUpdated: (quote: QuoteRecord) => void;
}

export function QuoteDetailSheet({
  quote,
  onClose,
  onQuoteUpdated,
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
  const artworkRef = useRef<View>(null);
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [artworkReady, setArtworkReady] = useState(!quote.imageUri);
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null);
  const [shareComplete, setShareComplete] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    },
    []
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        duration: 420,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        duration: 260,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, translateY]);

  const dismiss = useCallback(() => {
    if (isClosing.current) {
      return;
    }
    isClosing.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        duration: 330,
        toValue: sheetHeight,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [backdropOpacity, onClose, sheetHeight, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1.1) {
            dismiss();
            return;
          }
          Animated.spring(translateY, {
            damping: 22,
            mass: 0.9,
            stiffness: 210,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            damping: 22,
            stiffness: 210,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismiss, translateY]
  );

  const captureArtwork = () => {
    if (!artworkRef.current || !artworkReady) {
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
      setTimeout(() => setShareComplete(false), 1800);
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
        onPress: async () => {
          try {
            await deleteQuote(quote.id);
            showToast("Quote deleted", "info");
            dismiss();
          } catch (error) {
            console.warn("[quotd-delete-quote]", error);
            showModalFeedback("Could not delete this quote", "error");
          }
        },
      },
    ]);
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={() => (isEditing ? setIsEditing(false) : dismiss())}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: palette.overlay,
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Close quote details"
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.background,
              height: sheetHeight,
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Close quote details"
            accessibilityHint="Swipe down or double tap to close"
            accessibilityRole="button"
            onPress={dismiss}
            style={styles.handleArea}
            {...panResponder.panHandlers}
          >
            <View
              style={[styles.handle, { backgroundColor: palette.textMuted }]}
            />
          </Pressable>

          <View
            style={[
              styles.artworkFrame,
              { height: cardHeight, width: cardWidth },
            ]}
          >
            <QuoteArtwork
              ref={artworkRef}
              borderRadius={34}
              onImageReady={() => setArtworkReady(true)}
              quote={quote}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.28)", "transparent"]}
              pointerEvents="none"
              style={styles.topShade}
            />
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
          </View>

          <View style={styles.actions}>
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
          </View>
        </Animated.View>

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
      </View>
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
    borderRadius: 999,
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
  artworkFrame: {
    alignSelf: "center",
    borderRadius: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 8,
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
  sheet: {
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    overflow: "hidden",
  },
  topShade: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    height: 90,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
