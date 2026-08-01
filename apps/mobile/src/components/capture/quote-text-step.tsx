import { StatusBar } from "expo-status-bar";
import { ArrowLeft } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useApp } from "@/context/app-context";

export function QuoteTextStep({
  text,
  onChangeText,
  onBack,
  onContinue,
}: {
  text: string;
  onChangeText: (text: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { palette, resolvedTheme } = useApp();
  const canContinue = Boolean(text.trim());

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: palette.background }]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityLabel="Go back"
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: palette.surface },
              pressed && styles.pressed,
            ]}
          >
            <ArrowLeft
              color={palette.textSecondary}
              size={17}
              strokeWidth={2}
            />
          </Pressable>

          <Text style={[styles.title, { color: palette.text }]}>
            What was said?
          </Text>
          <TextInput
            autoFocus
            keyboardAppearance={resolvedTheme}
            maxLength={500}
            multiline
            onChangeText={onChangeText}
            placeholder="The quote goes here..."
            placeholderTextColor={palette.textMuted}
            selectionColor={palette.text}
            style={[
              styles.input,
              { backgroundColor: palette.surfaceMuted, color: palette.text },
            ]}
            textAlignVertical="top"
            value={text}
          />
          <View style={styles.inputMeta}>
            <Text style={[styles.hint, { color: palette.textMuted }]}>
              Capture the words exactly as you remember them.
            </Text>
            {text.length >= 400 ? (
              <Text style={[styles.counter, { color: palette.textMuted }]}>
                {text.length}/500
              </Text>
            ) : null}
          </View>

          <Pressable
            disabled={!canContinue}
            onPress={onContinue}
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: canContinue
                  ? palette.inverseSurface
                  : palette.surfaceMuted,
              },
              pressed && canContinue && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.continueText,
                {
                  color: canContinue ? palette.inverseText : palette.textMuted,
                },
              ]}
            >
              Continue
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    marginBottom: 23,
    width: 38,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 9,
  },
  continueButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 54,
  },
  continueText: {
    fontSize: 15,
    fontWeight: "700",
  },
  counter: {
    fontSize: 11,
  },
  hint: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  input: {
    borderRadius: 19,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 136,
    padding: 16,
  },
  inputMeta: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginTop: 9,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 33,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 24,
  },
});
