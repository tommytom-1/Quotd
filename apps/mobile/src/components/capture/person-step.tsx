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

export function PersonStep({
  name,
  suggestions,
  isSaving,
  onChangeName,
  onBack,
  onSave,
}: {
  name: string;
  suggestions: string[];
  isSaving: boolean;
  onChangeName: (name: string) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const { palette, resolvedTheme } = useApp();
  const canSave = Boolean(name.trim()) && !isSaving;

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
            disabled={isSaving}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: palette.surface },
              isSaving && styles.disabled,
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
            Who said it?
          </Text>
          <TextInput
            autoCapitalize="words"
            autoComplete="name"
            autoCorrect={false}
            autoFocus
            editable={!isSaving}
            keyboardAppearance={resolvedTheme}
            maxLength={100}
            onChangeText={onChangeName}
            onSubmitEditing={onSave}
            placeholder="e.g. Fergus Inns"
            placeholderTextColor={palette.textMuted}
            returnKeyType="done"
            selectionColor={palette.text}
            style={[
              styles.input,
              { backgroundColor: palette.surfaceMuted, color: palette.text },
            ]}
            value={name}
          />

          {suggestions.length > 0 ? (
            <View style={styles.suggestionsBlock}>
              <Text
                style={[styles.suggestionsLabel, { color: palette.textMuted }]}
              >
                RECENT PEOPLE
              </Text>
              <ScrollView
                contentContainerStyle={styles.suggestions}
                horizontal
                keyboardShouldPersistTaps="always"
                showsHorizontalScrollIndicator={false}
              >
                {suggestions.map((suggestion) => {
                  const selected = name === suggestion;
                  return (
                    <Pressable
                      key={suggestion}
                      disabled={isSaving}
                      onPress={() => onChangeName(suggestion)}
                      style={({ pressed }) => [
                        styles.suggestion,
                        {
                          backgroundColor: selected
                            ? palette.inverseSurface
                            : palette.surface,
                          borderColor: selected
                            ? palette.inverseSurface
                            : palette.border,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.suggestionText,
                          {
                            color: selected
                              ? palette.inverseText
                              : palette.textSecondary,
                          },
                        ]}
                      >
                        {suggestion}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <Text style={[styles.noSuggestions, { color: palette.textMuted }]}>
              People you quote often will appear here.
            </Text>
          )}

          <Pressable
            disabled={!canSave}
            onPress={onSave}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: canSave
                  ? palette.inverseSurface
                  : palette.surfaceMuted,
              },
              pressed && canSave && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.saveText,
                { color: canSave ? palette.inverseText : palette.textMuted },
              ]}
            >
              {isSaving ? "Saving…" : "Save quote"}
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
  disabled: {
    opacity: 0.42,
  },
  input: {
    borderRadius: 19,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  noSuggestions: {
    fontSize: 11.5,
    marginTop: 15,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  safeArea: {
    flex: 1,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 54,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
  },
  screen: {
    flex: 1,
  },
  suggestion: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  suggestions: {
    gap: 8,
  },
  suggestionsBlock: {
    marginTop: 18,
  },
  suggestionsLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 33,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 24,
  },
});
