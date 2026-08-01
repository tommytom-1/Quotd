import { X } from "lucide-react-native";
import { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/app-context";

interface EditQuoteSheetProps {
  initialText: string;
  initialSpeaker: string;
  onSave: (text: string, speaker: string) => Promise<unknown>;
  onClose: () => void;
}

export function EditQuoteSheet({
  initialText,
  initialSpeaker,
  onSave,
  onClose,
}: EditQuoteSheetProps) {
  const { palette, resolvedTheme } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const [speaker, setSpeaker] = useState(initialSpeaker);
  const [isSaving, setIsSaving] = useState(false);

  const trimmedText = text.trim();
  const trimmedSpeaker = speaker.trim();
  const canSave =
    Boolean(trimmedText && trimmedSpeaker) &&
    (trimmedText !== initialText || trimmedSpeaker !== initialSpeaker);

  const handleSave = async () => {
    if (!canSave || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(trimmedText, trimmedSpeaker);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        accessibilityLabel="Close quote editor"
        onPress={onClose}
        style={[styles.backdrop, { backgroundColor: palette.overlay }]}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
        style={styles.keyboardView}
      >
        <View
          style={[styles.panel, { backgroundColor: palette.surfaceElevated }]}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 20),
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[styles.handle, { backgroundColor: palette.surfaceMuted }]}
            />
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]}>
                Edit quote
              </Text>
              <Pressable
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={onClose}
                style={[
                  styles.closeButton,
                  { backgroundColor: palette.surfaceMuted },
                ]}
              >
                <X color={palette.textSecondary} size={15} strokeWidth={2} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: palette.textMuted }]}>
              QUOTE
            </Text>
            <TextInput
              editable={!isSaving}
              keyboardAppearance={resolvedTheme}
              maxLength={500}
              multiline
              onChangeText={setText}
              placeholder="Quote text…"
              placeholderTextColor={palette.textMuted}
              selectionColor={palette.text}
              style={[
                styles.quoteInput,
                {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              textAlignVertical="top"
              value={text}
            />

            <Text style={[styles.label, { color: palette.textMuted }]}>
              PERSON
            </Text>
            <TextInput
              editable={!isSaving}
              keyboardAppearance={resolvedTheme}
              maxLength={100}
              onChangeText={setSpeaker}
              onSubmitEditing={handleSave}
              placeholder="Person's name…"
              placeholderTextColor={palette.textMuted}
              returnKeyType="done"
              selectionColor={palette.text}
              style={[
                styles.personInput,
                {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              value={speaker}
            />

            <Pressable
              disabled={!canSave || isSaving}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: palette.inverseSurface },
                (!canSave || isSaving) && styles.disabled,
                pressed && canSave && styles.pressed,
              ]}
            >
              <Text style={[styles.saveText, { color: palette.inverseText }]}>
                {isSaving ? "Saving…" : "Save changes"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  disabled: {
    opacity: 0.34,
  },
  handle: {
    alignSelf: "center",
    borderRadius: 999,
    height: 4,
    marginBottom: 20,
    width: 40,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 30,
  },
  panel: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "94%",
    paddingHorizontal: 20,
    paddingTop: 13,
  },
  personInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  quoteInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    minHeight: 112,
    padding: 15,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 52,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
