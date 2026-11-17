import {
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { useApp } from "@/context/app-context";
import { HANDS } from "@/lib/polaroid";
import type { QuoteAlign, QuoteFont } from "@/lib/types";

/**
 * The row that sets a caption's lettering: its alignment, then a strip of
 * fonts, each named in its own hand. Used when writing a quote and when
 * restyling one already kept.
 */
export function CaptionStyleControls({
  align,
  disabled = false,
  font,
  onAlign,
  onFont,
  style,
}: {
  align: QuoteAlign;
  disabled?: boolean;
  font: QuoteFont;
  onAlign: (align: QuoteAlign) => void;
  onFont: (font: QuoteFont) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useApp();

  return (
    <View style={[styles.tools, style]}>
      <View style={[styles.aligns, { backgroundColor: palette.surface }]}>
        {ALIGNS.map(({ align: option, icon: AlignIcon, label }) => {
          const selected = align === option;
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={disabled}
              hitSlop={4}
              key={option}
              onPress={() => onAlign(option)}
              style={[
                styles.align,
                selected && { backgroundColor: palette.inverseSurface },
              ]}
            >
              <AlignIcon
                color={selected ? palette.inverseText : palette.text}
                size={18}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        contentContainerStyle={styles.fonts}
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
      >
        {FONTS.map((option) => {
          const hand = HANDS[option];
          const selected = font === option;
          return (
            <Pressable
              accessibilityLabel={`${hand.label} lettering`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={disabled}
              key={option}
              onPress={() => onFont(option)}
              style={({ pressed }) => [
                styles.font,
                {
                  backgroundColor: selected
                    ? palette.inverseSurface
                    : palette.surface,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.fontText,
                  {
                    color: selected ? palette.inverseText : palette.text,
                    fontFamily: hand.fontFamily,
                    fontSize: 16 * hand.scale,
                  },
                ]}
              >
                {hand.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const FONTS = Object.keys(HANDS) as QuoteFont[];
const ALIGNS = [
  { align: "left", icon: TextAlignStart, label: "Align left" },
  { align: "center", icon: TextAlignCenter, label: "Align centre" },
  { align: "right", icon: TextAlignEnd, label: "Align right" },
] as const;

const styles = StyleSheet.create({
  align: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 34,
  },
  aligns: {
    borderCurve: "continuous",
    borderRadius: 19,
    flexDirection: "row",
    gap: 2,
    padding: 4,
  },
  font: {
    borderCurve: "continuous",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  fontText: {
    lineHeight: 24,
  },
  fonts: {
    gap: 8,
    paddingRight: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  tools: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingLeft: 12,
  },
});
