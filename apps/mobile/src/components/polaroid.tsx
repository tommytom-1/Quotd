import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import type { ComponentRef, Ref } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type {
  GestureResponderEvent,
  HostInstance,
  TextLayoutEvent,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import {
  captionCaretRange,
  captionTopPadding,
  caretIndexAt,
  expandedHeight,
  mix,
  polaroidMetrics,
  quoteTypography,
  readCaption,
  speakerTypography,
  writeCaption,
} from "@/lib/polaroid";
import type { CaptionField } from "@/lib/polaroid";
import { gradientForId } from "@/lib/quote-utils";
import type { QuoteRecord } from "@/lib/types";

type TextLines = TextLayoutEvent["nativeEvent"]["lines"];

export interface PolaroidEditing {
  /** False while the polaroid is moving or being exported. */
  enabled: boolean;
  onActiveChange: (active: boolean) => void;
  onCommit: (updates: Pick<QuoteRecord, CaptionField>) => void;
}

export interface PolaroidFocus {
  /** 0 on the wall, 1 once the polaroid is focused. */
  progress: SharedValue<number>;
  /** Reports the focused height once the full quote has been measured. */
  onMeasured?: (height: number) => void;
  /** Lets a tap on the quote or its speaker edit it in place. */
  editing?: PolaroidEditing;
}

interface PolaroidProps {
  quote: QuoteRecord;
  width: number;
  /** Grows the caption to hold the full quote and its speaker. */
  focus?: PolaroidFocus;
  onImageSettled?: (ready: boolean) => void;
  paperRef?: Ref<HostInstance>;
  /** Leaves the shadow to the caller. */
  flat?: boolean;
}

export function Polaroid({
  quote,
  width,
  focus,
  onImageSettled,
  paperRef,
  flat = false,
}: PolaroidProps) {
  const {
    beginEditing,
    canEdit,
    captions,
    draft,
    finishEditing,
    inputProps,
    lines,
  } = useCaptionEditing(quote, focus?.editing);
  const metrics = polaroidMetrics(width);
  const typography = quoteTypography(readCaption("text", captions.text), width);
  const speaker = speakerTypography(width);
  const [quoteHeight, setQuoteHeight] = useState<number | null>(null);
  const lineCount = quoteHeight
    ? Math.round(quoteHeight / typography.lineHeight)
    : 1;
  const fullHeight = quoteHeight
    ? expandedHeight(metrics, typography, quoteHeight)
    : metrics.height;
  const progress = focus?.progress;
  const onMeasured = focus?.onMeasured;
  const hasImage = Boolean(quote.imageUri);

  useEffect(() => {
    if (quoteHeight) {
      onMeasured?.(fullHeight);
    }
  }, [fullHeight, onMeasured, quoteHeight]);

  useEffect(() => {
    if (!hasImage) {
      onImageSettled?.(true);
    }
  }, [hasImage, onImageSettled]);

  const paperStyle = useAnimatedStyle(() =>
    progress ? { height: mix(metrics.height, fullHeight, progress.value) } : {}
  );

  const quoteText = captions.text;
  const speakerText = captions.speaker;
  const quoteStyle = [
    styles.quote,
    { fontSize: typography.fontSize, lineHeight: typography.lineHeight },
  ];

  return (
    <View
      style={[!flat && styles.shadow, { borderRadius: metrics.radius, width }]}
    >
      <Animated.View
        ref={paperRef}
        collapsable={false}
        style={[
          styles.paper,
          { borderRadius: metrics.radius, height: metrics.height, width },
          paperStyle,
        ]}
      >
        <View
          style={[
            styles.photo,
            {
              borderRadius: metrics.photoRadius,
              height: metrics.photoHeight,
              left: metrics.padding,
              top: metrics.padding,
              width: metrics.photoWidth,
            },
          ]}
        >
          <LinearGradient
            colors={gradientForId(quote.id)}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {quote.imageUri ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              onDisplay={() => onImageSettled?.(true)}
              onError={() => onImageSettled?.(false)}
              recyclingKey={quote.imageUri}
              source={quote.imageUri}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          ) : null}
        </View>

        {focus ? (
          <View
            style={[
              styles.caption,
              {
                left: metrics.captionInset,
                paddingTop: captionTopPadding(metrics, typography, lineCount),
                right: metrics.captionInset,
                top: metrics.captionTop,
              },
            ]}
          >
            {/* The written caption stays put while it is edited: a see-through
                input laid over it only adds the caret and the selection. */}
            <View>
              <Text
                accessibilityHint={canEdit ? "Edits the quote" : undefined}
                allowFontScaling={false}
                onLayout={(event) =>
                  setQuoteHeight(event.nativeEvent.layout.height)
                }
                onPress={
                  canEdit ? (event) => beginEditing("text", event) : undefined
                }
                onTextLayout={(event) => {
                  lines.current.text = event.nativeEvent.lines;
                }}
                style={quoteStyle}
                suppressHighlighting
              >
                {quoteText}
              </Text>
              {draft?.field === "text" ? (
                <TextInput
                  {...inputProps}
                  accessibilityLabel="Quote"
                  maxLength={502}
                  multiline
                  onBlur={() => finishEditing("text")}
                  // A text view that cannot scroll drops the last line when
                  // its frame is a hair too short, so this one can and gets
                  // slack below instead.
                  style={[
                    quoteStyle,
                    styles.input,
                    {
                      bottom: -typography.lineHeight / 4,
                      marginBottom: 0,
                      paddingBottom: 0,
                    },
                  ]}
                >
                  {quoteText}
                </TextInput>
              ) : null}
            </View>
            <View>
              <Animated.Text
                accessibilityHint={canEdit ? "Edits the person" : undefined}
                adjustsFontSizeToFit
                allowFontScaling={false}
                numberOfLines={1}
                onPress={
                  canEdit
                    ? (event) => beginEditing("speaker", event)
                    : undefined
                }
                onTextLayout={(event) => {
                  lines.current.speaker = event.nativeEvent.lines;
                }}
                style={[styles.speaker, speaker]}
                suppressHighlighting
              >
                {speakerText}
              </Animated.Text>
              {draft?.field === "speaker" ? (
                <TextInput
                  {...inputProps}
                  accessibilityLabel="Person"
                  autoCapitalize="words"
                  maxLength={102}
                  onBlur={() => finishEditing("speaker")}
                  style={[styles.speaker, speaker, styles.input]}
                >
                  {speakerText}
                </TextInput>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.caption,
              styles.wallCaption,
              {
                height: metrics.captionHeight,
                left: metrics.captionInset,
                right: metrics.captionInset,
                top: metrics.captionTop,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={typography.maxLines}
              style={quoteStyle}
            >
              {quoteText}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.speaker, speaker]}
            >
              {speakerText}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

/** Holds the draft of the caption being edited, marks included. */
function useCaptionEditing(quote: QuoteRecord, editing?: PolaroidEditing) {
  const [draft, setDraft] = useState<{
    field: CaptionField;
    value: string;
    caret: number;
  } | null>(null);
  const activeField = useRef<CaptionField | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const lines = useRef<Record<CaptionField, TextLines>>({
    speaker: [],
    text: [],
  });
  const captions = {
    speaker:
      draft?.field === "speaker"
        ? draft.value
        : writeCaption("speaker", quote.speaker),
    text:
      draft?.field === "text" ? draft.value : writeCaption("text", quote.text),
  };

  const finishEditing = (field: CaptionField) => {
    // An input replaced by the other field can still report its blur.
    if (!draft || activeField.current !== field) {
      return;
    }
    activeField.current = null;
    setDraft(null);
    editing?.onActiveChange(false);
    const value = readCaption(field, draft.value);
    if (value && value !== quote[field]) {
      editing?.onCommit({
        speaker: field === "speaker" ? value : quote.speaker,
        text: field === "text" ? value : quote.text,
      });
    }
  };

  const beginEditing = (field: CaptionField, event: GestureResponderEvent) => {
    if (draft) {
      finishEditing(draft.field);
    }
    const caption = captions[field];
    const [first, last] = captionCaretRange(field, caption);
    const tapped = caretIndexAt(caption, lines.current[field], {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    });
    activeField.current = field;
    setDraft({
      caret: Math.min(last, Math.max(first, tapped)),
      field,
      value: caption,
    });
    editing?.onActiveChange(true);
  };

  const inputProps = {
    allowFontScaling: false,
    autoFocus: true,
    onChangeText: (value: string) =>
      setDraft((current) => current && { ...current, value }),
    onFocus: () =>
      draft && inputRef.current?.setSelection(draft.caret, draft.caret),
    ref: inputRef,
    returnKeyType: "done",
    selectionColor: INK,
    submitBehavior: "blurAndSubmit",
    underlineColorAndroid: "transparent",
  } as const;
  const canEdit = Boolean(editing?.enabled);

  return {
    beginEditing,
    canEdit,
    captions,
    draft,
    finishEditing,
    inputProps,
    lines,
  };
}

const INK = "#161616";
const PAPER = "#FFFFFF";

const styles = StyleSheet.create({
  caption: {
    position: "absolute",
  },
  input: {
    bottom: 0,
    color: "transparent",
    left: 0,
    padding: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  paper: {
    backgroundColor: PAPER,
    borderColor: "rgba(0,0,0,0.05)",
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  photo: {
    borderCurve: "continuous",
    overflow: "hidden",
    position: "absolute",
  },
  quote: {
    color: INK,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "left",
  },
  shadow: {
    backgroundColor: PAPER,
    borderCurve: "continuous",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  speaker: {
    color: "#8E8E8A",
    fontWeight: "500",
    textAlign: "left",
  },
  wallCaption: {
    justifyContent: "center",
  },
});
