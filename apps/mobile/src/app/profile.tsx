import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  CloudOff,
  HardDrive,
  Palette,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.surface },
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeft color={palette.textSecondary} size={17} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Profile
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <Pressable
            accessibilityLabel="Change profile photo"
            disabled={isSaving}
            onPress={pickAvatar}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <ProfileAvatar size={88} uri={profile.avatarUri} />
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: palette.inverseSurface },
              ]}
            >
              <Camera color={palette.inverseText} size={13} strokeWidth={2} />
            </View>
          </Pressable>
          <Pressable disabled={isSaving} onPress={pickAvatar}>
            <Text style={[styles.avatarHint, { color: palette.textMuted }]}>
              {isSaving ? "Saving photo…" : "Tap to change photo"}
            </Text>
          </Pressable>
          {profile.avatarUri ? (
            <Pressable hitSlop={8} onPress={handleRemoveAvatar}>
              <Text style={[styles.removePhoto, { color: palette.danger }]}>
                Remove
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Section label="Local profile">
          {editingName ? (
            <View style={styles.inlineEdit}>
              <TextInput
                autoFocus
                editable={!isSaving}
                keyboardAppearance={resolvedTheme}
                onChangeText={setName}
                onSubmitEditing={saveName}
                placeholder="Your name"
                placeholderTextColor={palette.textMuted}
                returnKeyType="done"
                selectionColor={palette.text}
                style={[
                  styles.nameInput,
                  { color: palette.text, borderColor: palette.border },
                ]}
                value={name}
              />
              <Pressable
                accessibilityLabel="Cancel"
                disabled={isSaving}
                onPress={() => {
                  setName(profile.displayName);
                  setEditingName(false);
                }}
                style={[
                  styles.inlineButton,
                  { backgroundColor: palette.surfaceMuted },
                ]}
              >
                <X color={palette.textSecondary} size={13} strokeWidth={2.2} />
              </Pressable>
              <Pressable
                accessibilityLabel="Save name"
                disabled={!name.trim() || isSaving}
                onPress={saveName}
                style={[
                  styles.inlineButton,
                  { backgroundColor: palette.inverseSurface },
                  (!name.trim() || isSaving) && styles.disabled,
                ]}
              >
                <Check
                  color={palette.inverseText}
                  size={13}
                  strokeWidth={2.5}
                />
              </Pressable>
            </View>
          ) : (
            <SettingsRow
              icon={
                <UserRound
                  color={palette.textSecondary}
                  size={16}
                  strokeWidth={1.7}
                />
              }
              label="Name"
              onPress={() => setEditingName(true)}
              value={profile.displayName || "Not set"}
            />
          )}
        </Section>

        <Section label="Appearance">
          <View style={styles.appearanceRow}>
            <View
              style={[
                styles.rowIcon,
                {
                  backgroundColor: palette.surfaceElevated,
                  borderColor: palette.border,
                },
              ]}
            >
              <Palette
                color={palette.textSecondary}
                size={16}
                strokeWidth={1.7}
              />
            </View>
            <View style={styles.appearanceContent}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>
                Theme
              </Text>
              <View style={styles.themeOptions}>
                {THEME_OPTIONS.map((option) => {
                  const selected = themePreference === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => changeTheme(option.value)}
                      style={[
                        styles.themeChip,
                        {
                          backgroundColor: selected
                            ? palette.inverseSurface
                            : palette.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.themeChipText,
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
          </View>
        </Section>

        <Section label="Storage">
          <InfoRow
            icon={
              <HardDrive
                color={palette.textSecondary}
                size={16}
                strokeWidth={1.7}
              />
            }
            label="On this device"
            value={`${quotes.length} ${quotes.length === 1 ? "quote" : "quotes"}`}
          />
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <Pressable
            onPress={resetApp}
            style={({ pressed }) => [
              styles.resetRow,
              pressed && styles.rowPressed,
            ]}
          >
            <View
              style={[
                styles.rowIcon,
                { backgroundColor: palette.dangerSurface },
              ]}
            >
              <RotateCcw color={palette.danger} size={16} strokeWidth={1.8} />
            </View>
            <Text style={[styles.resetLabel, { color: palette.danger }]}>
              Reset local app
            </Text>
          </Pressable>
        </Section>

        <View
          style={[
            styles.prototypeCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.prototypeHeader}>
            <ShieldCheck
              color={palette.textSecondary}
              size={18}
              strokeWidth={1.7}
            />
            <Text style={[styles.prototypeTitle, { color: palette.text }]}>
              Local prototype
            </Text>
          </View>
          <Text style={[styles.prototypeCopy, { color: palette.textMuted }]}>
            Your quotes and photos stay on this device for now. Accounts,
            backup, and sync will arrive in a later version.
          </Text>
          <View style={styles.offlineRow}>
            <CloudOff color={palette.textMuted} size={13} strokeWidth={1.7} />
            <Text style={[styles.offlineText, { color: palette.textMuted }]}>
              No account required
            </Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: palette.textMuted }]}>
          Quotd · {new Date().getFullYear()}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const { palette } = useApp();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <View style={[styles.sectionCard, { backgroundColor: palette.surface }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { palette } = useApp();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.border,
          },
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.rowValue, { color: palette.textMuted }]}
      >
        {value}
      </Text>
      <ChevronRight color={palette.textMuted} size={14} strokeWidth={1.8} />
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const { palette } = useApp();
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.border,
          },
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: palette.textMuted }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  appearanceContent: {
    flex: 1,
  },
  appearanceRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  avatarHint: {
    fontSize: 13,
    marginTop: 13,
  },
  avatarSection: {
    alignItems: "center",
    paddingBottom: 31,
    paddingTop: 15,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cameraBadge: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 15,
    borderWidth: 2,
    bottom: 0,
    height: 29,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 29,
  },
  disabled: {
    opacity: 0.35,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  footer: {
    fontSize: 11,
    marginBottom: 10,
    marginTop: 8,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  inlineButton: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  inlineEdit: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  nameInput: {
    borderBottomWidth: 1,
    flex: 1,
    fontSize: 15,
    minHeight: 36,
    paddingHorizontal: 2,
  },
  offlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 13,
  },
  offlineText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  prototypeCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 23,
    marginHorizontal: 20,
    padding: 17,
  },
  prototypeCopy: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  prototypeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  prototypeTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  removePhoto: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 7,
  },
  resetLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  resetRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 61,
    paddingHorizontal: 14,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  rowPressed: {
    opacity: 0.62,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 13,
    maxWidth: 145,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.15,
    marginBottom: 8,
  },
  themeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  themeChipText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  themeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
});
