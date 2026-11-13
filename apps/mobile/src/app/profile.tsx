import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Camera, Check, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BottomNavigation,
  BOTTOM_NAVIGATION_HEIGHT,
  hasNativeIosToolbar,
} from "@/components/bottom-navigation";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSelectionHaptic, playSuccessHaptic } from "@/lib/haptics";
import type { ThemePreference } from "@/lib/types";

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const {
    clearAllData,
    isLoading,
    palette,
    profile,
    quotes,
    removeAvatar,
    resolvedTheme,
    setAvatarFromUri,
    setDisplayName,
    setThemePreference,
    speakers,
    themePreference,
  } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(profile.displayName);
  }, [profile.displayName]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.82,
        shape: "oval",
      });
      if (result.canceled) {
        return;
      }

      setIsSaving(true);
      await setAvatarFromUri(result.assets[0].uri);
      await playSuccessHaptic();
      showToast("Profile photo updated");
    } catch (error) {
      console.warn("[quotd-avatar]", error);
      showToast("Could not update your photo", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAvatar = () => {
    Alert.alert("Remove profile photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeAvatar();
          showToast("Profile photo removed", "info");
        },
      },
    ]);
  };

  const saveName = async () => {
    if (!name.trim() || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await setDisplayName(name);
      setEditingName(false);
      showToast("Name updated");
    } catch (error) {
      console.warn("[quotd-name]", error);
      showToast("Could not save your name", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const changeTheme = async (theme: ThemePreference) => {
    setThemePreference(theme);
    await playSelectionHaptic();
  };

  const resetApp = () => {
    Alert.alert(
      "Reset local app?",
      "This permanently removes every quote, photo, and profile setting stored by Quotd on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllData();
              showToast("Local data cleared", "info");
              router.dismissTo("/");
            } catch (error) {
              console.warn("[quotd-reset]", error);
              showToast("Could not clear local data", "error");
            }
          },
        },
      ]
    );
  };

  const card = [styles.card, { backgroundColor: palette.surface }];
  const canSaveName = Boolean(name.trim()) && !isSaving;

  return (
    <View
      collapsable={false}
      style={[styles.screen, { backgroundColor: palette.background }]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          !hasNativeIosToolbar && {
            paddingBottom:
              BOTTOM_NAVIGATION_HEIGHT + Math.max(insets.bottom, 12) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Pressable
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={pickAvatar}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ProfileAvatar size={104} uri={profile.avatarUri} />
            <View
              style={[
                styles.cameraBadge,
                {
                  backgroundColor: palette.inverseSurface,
                  borderColor: palette.background,
                },
              ]}
            >
              <Camera color={palette.inverseText} size={15} strokeWidth={2} />
            </View>
          </Pressable>
          {editingName ? null : (
            <Pressable
              accessibilityHint="Edits your name"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setEditingName(true)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.name,
                  {
                    color: profile.displayName
                      ? palette.text
                      : palette.textMuted,
                  },
                ]}
              >
                {profile.displayName || "Add your name"}
              </Text>
            </Pressable>
          )}
          {profile.avatarUri ? (
            <Pressable hitSlop={8} onPress={handleRemoveAvatar}>
              <Text style={[styles.link, { color: palette.textMuted }]}>
                {isSaving ? "Saving photo…" : "Remove photo"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {editingName ? (
          <View style={[card, styles.fieldCard]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.textMuted }]}>
                Your name
              </Text>
              <TextInput
                accessibilityLabel="Your name"
                autoCapitalize="words"
                autoComplete="name"
                autoFocus
                editable={!isSaving}
                keyboardAppearance={resolvedTheme}
                onChangeText={setName}
                onSubmitEditing={saveName}
                placeholder="e.g. Alex"
                placeholderTextColor={palette.textMuted}
                returnKeyType="done"
                selectionColor={palette.text}
                style={[styles.input, { color: palette.text }]}
                value={name}
              />
            </View>
            <Pressable
              accessibilityLabel="Cancel"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => {
                setName(profile.displayName);
                setEditingName(false);
              }}
              style={({ pressed }) => [
                styles.roundButton,
                { backgroundColor: palette.surfaceMuted },
                pressed && styles.pressed,
              ]}
            >
              <X color={palette.textSecondary} size={20} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              accessibilityLabel="Save name"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSaveName }}
              disabled={!canSaveName}
              onPress={saveName}
              style={({ pressed }) => [
                styles.roundButton,
                {
                  backgroundColor: canSaveName
                    ? palette.inverseSurface
                    : palette.surfaceMuted,
                },
                pressed && styles.pressed,
              ]}
            >
              <Check
                color={canSaveName ? palette.inverseText : palette.textMuted}
                size={20}
                strokeWidth={2.4}
              />
            </Pressable>
          </View>
        ) : null}

        <View style={[card, styles.stats]}>
          <Stat label={quotes.length === 1 ? "quote" : "quotes"}>
            {quotes.length}
          </Stat>
          <View
            style={[styles.statDivider, { backgroundColor: palette.border }]}
          />
          <Stat label={speakers.length === 1 ? "person" : "people"}>
            {speakers.length}
          </Stat>
        </View>

        <View style={card}>
          <Text style={[styles.label, { color: palette.textMuted }]}>
            Appearance
          </Text>
          <View
            style={[styles.segments, { backgroundColor: palette.surfaceMuted }]}
          >
            {THEME_OPTIONS.map((option) => {
              const selected = themePreference === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => changeTheme(option.value)}
                  style={[
                    styles.segment,
                    selected && { backgroundColor: palette.inverseSurface },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: selected
                          ? palette.inverseText
                          : palette.textSecondary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={resetApp}
          style={({ pressed }) => [...card, pressed && styles.pressed]}
        >
          <Text style={[styles.resetTitle, { color: palette.danger }]}>
            Reset app
          </Text>
          <Text style={[styles.resetCopy, { color: palette.textMuted }]}>
            Removes every quote, photo and setting on this device.
          </Text>
        </Pressable>

        <Text style={[styles.footer, { color: palette.textMuted }]}>
          Your quotes stay on this device. No account needed.
          {"\n"}Quotd · {new Date().getFullYear()}
        </Text>
      </ScrollView>
      <BottomNavigation
        onSwitchView={() => router.dismissTo("/quotes")}
        onAdd={() => {
          void playSelectionHaptic();
          router.push("/capture");
        }}
      />
    </View>
  );
}

function Stat({ children, label }: { children: number; label: string }) {
  const { palette } = useApp();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: palette.text }]}>
        {children}
      </Text>
      <Text style={[styles.statLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraBadge: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 3,
    bottom: -2,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 36,
  },
  card: {
    borderCurve: "continuous",
    borderRadius: 26,
    marginBottom: 12,
    marginHorizontal: 16,
    padding: 20,
  },
  content: {
    paddingBottom: 12,
  },
  field: {
    flex: 1,
    gap: 3,
  },
  fieldCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingRight: 14,
  },
  footer: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
    marginTop: 12,
    textAlign: "center",
  },
  hero: {
    alignItems: "center",
    gap: 6,
    paddingBottom: 24,
    paddingTop: 12,
  },
  input: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
    padding: 0,
  },
  label: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
  },
  name: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.8,
    marginTop: 12,
    maxWidth: 320,
  },
  pressed: {
    opacity: 0.6,
  },
  resetCopy: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  resetTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  roundButton: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  screen: {
    flex: 1,
  },
  segment: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "500",
  },
  segments: {
    borderRadius: 999,
    flexDirection: "row",
    marginTop: 12,
    padding: 4,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statDivider: {
    alignSelf: "stretch",
    marginHorizontal: 20,
    width: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 40,
    fontWeight: "600",
    letterSpacing: -1.5,
  },
  stats: {
    flexDirection: "row",
  },
});
