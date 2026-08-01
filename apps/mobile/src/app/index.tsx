import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, Plus, Settings } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingScreen } from "@/components/loading-screen";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useApp } from "@/context/app-context";

export default function HomeScreen() {
  const router = useRouter();
  const { isLoading, palette, profile, quotes, resolvedTheme } = useApp();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const firstName = profile.displayName.trim().split(/\s+/u)[0] || "there";

  const openCapture = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn("[quotd-haptics]", error);
    }
    router.push("/capture");
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />

      <View style={styles.topBar}>
        <Text style={[styles.wordmark, { color: palette.text }]}>quotd</Text>
        <Pressable
          accessibilityLabel="Open profile settings"
          hitSlop={8}
          onPress={() => router.push("/profile")}
          style={({ pressed }) => [
            styles.settingsButton,
            { backgroundColor: palette.surface },
            pressed && styles.pressed,
          ]}
        >
          <Settings color={palette.textSecondary} size={17} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.greeting, { color: palette.text }]}>
          Hey, {firstName}!
        </Text>
        <Text style={[styles.prompt, { color: palette.textMuted }]}>
          Add a new quote:
        </Text>
        <Pressable
          accessibilityLabel="Add a new quote"
          onPress={openCapture}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: palette.inverseSurface,
              shadowColor: resolvedTheme === "dark" ? "#000" : palette.text,
            },
            pressed && styles.addPressed,
          ]}
        >
          <Plus color={palette.inverseText} size={43} strokeWidth={1.3} />
        </Pressable>
        <Text style={[styles.helper, { color: palette.textMuted }]}>
          Photograph it or keep it text-only
        </Text>
      </View>

      <View style={styles.bottomArea}>
        <Pressable
          accessibilityLabel="Open my quotes"
          onPress={() => router.push("/quotes")}
          style={({ pressed }) => [
            styles.libraryCard,
            { backgroundColor: palette.surface },
            pressed && styles.pressed,
          ]}
        >
          <ProfileAvatar size={44} uri={profile.avatarUri} />
          <View style={styles.libraryCopy}>
            <Text style={[styles.libraryTitle, { color: palette.text }]}>
              My Quotes
            </Text>
            <Text style={[styles.libraryCount, { color: palette.textMuted }]}>
              {quotes.length} {quotes.length === 1 ? "quote" : "quotes"} on this
              device
            </Text>
          </View>
          <ArrowRight color={palette.textMuted} size={17} strokeWidth={1.8} />
        </Pressable>
        <Text style={[styles.privateCopy, { color: palette.textMuted }]}>
          Private by default · stored locally
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    borderRadius: 62,
    elevation: 7,
    height: 116,
    justifyContent: "center",
    marginTop: 8,
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    width: 116,
  },
  addPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.95 }],
  },
  bottomArea: {
    alignItems: "center",
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.1,
  },
  helper: {
    fontSize: 12.5,
    marginTop: 17,
  },
  hero: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 20,
    paddingHorizontal: 30,
  },
  libraryCard: {
    alignItems: "center",
    borderRadius: 22,
    flexDirection: "row",
    gap: 13,
    maxWidth: 390,
    padding: 14,
    width: "100%",
  },
  libraryCopy: {
    flex: 1,
  },
  libraryCount: {
    fontSize: 12.5,
    marginTop: 3,
  },
  libraryTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  privateCopy: {
    fontSize: 11.5,
    marginTop: 15,
  },
  prompt: {
    fontSize: 16,
    marginTop: 11,
  },
  safeArea: {
    flex: 1,
  },
  settingsButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  wordmark: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
});
