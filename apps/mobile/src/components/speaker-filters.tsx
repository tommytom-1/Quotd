import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { UsersRound } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SpeakerMenu } from "@/components/speaker-menu";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSelectionHaptic } from "@/lib/haptics";
import type { SpeakerProfile } from "@/lib/types";

interface SpeakerFiltersProps {
  people: SpeakerProfile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function SpeakerFilters({
  people,
  selectedId,
  onSelect,
}: SpeakerFiltersProps) {
  const {
    palette,
    renameSpeaker,
    setSpeakerAvatarFromUri,
    removeSpeakerAvatar,
  } = useApp();
  const showToast = useToast();
  const [editing, setEditing] = useState<SpeakerProfile | null>(null);
  const [name, setName] = useState("");
  const [nameError, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const select = (id: string | null) => {
    onSelect(id === selectedId ? null : id);
    void playSelectionHaptic();
  };

  const pickPhoto = async (person: SpeakerProfile) => {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.82,
      });
      if (!result.canceled) {
        await setSpeakerAvatarFromUri(person.id, result.assets[0].uri);
        showToast("Photo updated");
      }
    } catch (error) {
      console.warn("[quotd-speaker-photo]", error);
      showToast("Could not update this photo", "error");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (person: SpeakerProfile) => {
    try {
      removeSpeakerAvatar(person.id);
      showToast("Photo removed");
    } catch {
      showToast("Could not remove this photo", "error");
    }
  };

  const saveName = () => {
    if (!editing || !name.trim()) {
      return;
    }
    try {
      renameSpeaker(editing.id, name);
      setEditing(null);
      showToast("Name updated on their quotes");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not change this name"
      );
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        <Pressable
          accessibilityLabel="Show everybody's quotes"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedId === null }}
          onPress={() => select(null)}
          style={styles.person}
        >
          <View
            style={[
              styles.ring,
              {
                borderColor: selectedId === null ? palette.text : "transparent",
              },
            ]}
          >
            <View
              style={[styles.avatar, { backgroundColor: palette.surfaceMuted }]}
            >
              <UsersRound
                color={palette.textSecondary}
                size={25}
                strokeWidth={1.6}
              />
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              { color: selectedId === null ? palette.text : palette.textMuted },
            ]}
          >
            Everybody
          </Text>
        </Pressable>
        {people.map((person) => {
          const selected = person.id === selectedId;
          return (
            <SpeakerMenu
              key={person.id}
              name={person.name}
              selected={selected}
              disabled={busy}
              onPress={() => select(person.id)}
              onRename={() => {
                setName(person.name);
                setError("");
                setEditing(person);
              }}
              onPhoto={() => {
                void pickPhoto(person);
              }}
              onRemovePhoto={
                person.avatarUri ? () => removePhoto(person) : undefined
              }
            >
              <View style={styles.person}>
                <View
                  style={[
                    styles.ring,
                    { borderColor: selected ? person.color : "transparent" },
                  ]}
                >
                  <SpeakerAvatar
                    key={`${person.id}-${person.avatarUri}`}
                    person={person}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color: selected ? palette.text : palette.textMuted },
                    selected && styles.selectedLabel,
                  ]}
                >
                  {person.name}
                </Text>
              </View>
            </SpeakerMenu>
          );
        })}
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setEditing(null)}
        transparent
        visible={editing !== null}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityLabel="Cancel name change"
            onPress={() => setEditing(null)}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: palette.overlay },
            ]}
          />
          <View
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: palette.background }]}
          >
            <Text style={[styles.title, { color: palette.text }]}>
              Change name
            </Text>
            <Text style={[styles.copy, { color: palette.textMuted }]}>
              This updates the name on all their quotes.
            </Text>
            <TextInput
              accessibilityLabel="Person's name"
              autoCapitalize="words"
              autoFocus
              maxLength={80}
              onChangeText={(value) => {
                setName(value);
                setError("");
              }}
              onSubmitEditing={saveName}
              returnKeyType="done"
              style={[
                styles.input,
                { borderColor: palette.border, color: palette.text },
              ]}
              value={name}
            />
            {nameError ? (
              <Text accessibilityRole="alert" style={{ color: palette.danger }}>
                {nameError}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditing(null)}
                style={styles.button}
              >
                <Text style={{ color: palette.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !name.trim() }}
                disabled={!name.trim()}
                onPress={saveName}
                style={[
                  styles.button,
                  { backgroundColor: palette.inverseSurface },
                  !name.trim() && styles.pressed,
                ]}
              >
                <Text style={{ color: palette.inverseText, fontWeight: "600" }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function SpeakerAvatar({ person }: { person: SpeakerProfile }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={[styles.avatar, { backgroundColor: person.color }]}>
      <Text style={styles.initial}>
        {[...person.name.trim()][0]?.toLocaleUpperCase() || "?"}
      </Text>
      {person.avatarUri && !imageFailed ? (
        <Image
          source={person.avatarUri}
          contentFit="cover"
          onError={() => setImageFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  button: { borderRadius: 10, paddingHorizontal: 22, paddingVertical: 13 },
  copy: { fontSize: 14, lineHeight: 20 },
  dialog: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 22,
    gap: 14,
  },
  initial: { color: "#FFFFFF", fontSize: 24, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    minHeight: 48,
  },
  label: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 5 },
  modalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  person: { alignItems: "center", width: 76 },
  pressed: { opacity: 0.6 },
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    borderWidth: 2,
    width: 66,
    height: 66,
  },
  row: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    alignItems: "flex-start",
  },
  scroll: { flexGrow: 0, flexShrink: 0, marginTop: 18, marginBottom: 14 },
  selectedLabel: { fontWeight: "500" },
  title: { fontSize: 18, fontWeight: "600" },
});
