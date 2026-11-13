import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { Check } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/app-context";

/**
 * One step of writing a quote: the photo fills the top of the screen and a
 * card above the keyboard holds a single field and the button that confirms it.
 */
export function CaptionStep({
  busy = false,
  imageUri,
  label,
  leading,
  multiline = false,
  onChangeText,
  onLeading,
  onSubmit,
  placeholder,
  suggestions = [],
  submitLabel,
  value,
}: {
  busy?: boolean;
  imageUri: string | null;
  label: string;
  /** The button on the photo, and what it is for. */
  leading: { icon: LucideIcon; label: string };
  multiline?: boolean;
  onChangeText: (value: string) => void;
  onLeading: () => void;
  onSubmit: () => void;
  placeholder: string;
  /** Values that fill the field in one tap. */
  suggestions?: string[];
  submitLabel: string;
  value: string;
}) {
  const insets = useSafeAreaInsets();
  const { palette, resolvedTheme } = useApp();
  const keyboardShown = useKeyboardShown();
  const canSubmit = Boolean(value.trim()) && !busy;
  const LeadingIcon = leading.icon;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.screen,
        {
          backgroundColor: palette.background,
          paddingBottom: keyboardShown ? 8 : insets.bottom + 12,
          paddingTop: insets.top + 4,
        },
      ]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <View style={[styles.photo, { backgroundColor: palette.surfaceMuted }]}>
        {imageUri ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="cover"
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Pressable
          accessibilityLabel={leading.label}
          accessibilityRole="button"
          disabled={busy}
          hitSlop={12}
          onPress={onLeading}
          style={({ pressed }) => [styles.leading, pressed && styles.pressed]}
        >
          <LeadingIcon color="#FFFFFF" size={28} strokeWidth={1.8} />
        </Pressable>
      </View>

      {suggestions.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.suggestions}
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsRow}
        >
          {suggestions.map((suggestion) => {
            const selected = value === suggestion;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={busy}
                key={suggestion}
                onPress={() => onChangeText(suggestion)}
                style={({ pressed }) => [
                  styles.suggestion,
                  {
                    backgroundColor: selected
                      ? palette.inverseSurface
                      : palette.surface,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    { color: selected ? palette.inverseText : palette.text },
                  ]}
                >
                  {suggestion}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <View style={styles.field}>
          <Text
            numberOfLines={1}
            style={[styles.label, { color: palette.textMuted }]}
          >
            {label}
          </Text>
          <TextInput
            accessibilityLabel={label}
            autoCapitalize={multiline ? "sentences" : "words"}
            autoComplete={multiline ? "off" : "name"}
            autoCorrect={multiline}
            autoFocus
            editable={!busy}
            keyboardAppearance={resolvedTheme}
            maxLength={multiline ? 500 : 100}
            multiline={multiline}
            onChangeText={(text) =>
              // A return pressed to leave the previous step can land here.
              onChangeText(multiline ? text.replace(/^\s+/u, "") : text)
            }
            onSubmitEditing={canSubmit ? onSubmit : undefined}
            placeholder={placeholder}
            placeholderTextColor={palette.textMuted}
            returnKeyType={multiline ? "default" : "go"}
            selectionColor={palette.text}
            style={[styles.input, { color: palette.text }]}
            value={value}
          />
        </View>
        <Pressable
          accessibilityLabel={submitLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: canSubmit
                ? palette.inverseSurface
                : palette.surfaceMuted,
            },
            pressed && styles.pressed,
          ]}
        >
          <Check
            color={canSubmit ? palette.inverseText : palette.textMuted}
            size={22}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function useKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setShown(true));
    const hide = Keyboard.addListener("keyboardWillHide", () =>
      setShown(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 26,
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 10,
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: 14,
  },
  field: {
    flex: 1,
    gap: 3,
  },
  input: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
    maxHeight: 120,
    padding: 0,
  },
  label: {
    fontSize: 14,
  },
  leading: {
    left: 20,
    position: "absolute",
    top: 20,
  },
  photo: {
    borderCurve: "continuous",
    borderRadius: 34,
    flex: 1,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.6,
  },
  screen: {
    flex: 1,
  },
  submit: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  suggestion: {
    borderCurve: "continuous",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  suggestions: {
    gap: 8,
    paddingHorizontal: 12,
  },
  suggestionsRow: {
    flexGrow: 0,
    marginTop: 10,
  },
});
