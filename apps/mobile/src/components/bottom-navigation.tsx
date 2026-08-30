import { Stack, useRouter } from "expo-router";
import { GalleryVerticalEnd, Plus, UsersRound } from "lucide-react-native";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileAvatar } from "@/components/profile-avatar";
import { useApp } from "@/context/app-context";
import { setHomeView, useHomeView } from "@/lib/home-view";

// The SDK 56 bottom UIToolbar host requires iOS 18. Keep the same controls on
// older iOS and web, where Stack.Toolbar does not render a bottom bar.
export const hasNativeIosToolbar =
  Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 18;
export const BOTTOM_NAVIGATION_HEIGHT = 64;

export function BottomNavigation({
  onAdd,
  onSwitchView,
}: {
  onAdd: () => void;
  /** Called once the left button has switched the home screen's view. */
  onSwitchView?: () => void;
}) {
  const homeView = useHomeView();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isLoading, palette, profile } = useApp();

  // The bar is the same on every screen: its left button leads to whichever
  // home view is not showing.
  const SwitchIcon = homeView === "people" ? GalleryVerticalEnd : UsersRound;
  const switchView = () => {
    setHomeView(homeView === "people" ? "wall" : "people");
    onSwitchView?.();
  };
  const switchButton = (
    <Pressable
      accessibilityLabel={homeView === "people" ? "Wall" : "People"}
      accessibilityRole="button"
      accessibilityState={{ disabled: isLoading }}
      disabled={isLoading}
      onPress={switchView}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.pressed,
      ]}
    >
      <SwitchIcon color={palette.text} size={22} strokeWidth={2} />
    </Pressable>
  );
  const profileButton = (
    <Pressable
      accessibilityLabel="Profile settings"
      accessibilityRole="button"
      accessibilityState={{ disabled: isLoading }}
      disabled={isLoading}
      onPress={() => router.navigate("/profile")}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.pressed,
      ]}
    >
      <ProfileAvatar size={34} uri={profile.avatarUri} />
    </Pressable>
  );

  const controls = (
    <View
      accessibilityRole="toolbar"
      style={[
        styles.row,
        { width: Math.min(width - 80, 232) },
        hasNativeIosToolbar && styles.iosRow,
      ]}
    >
      {switchButton}
      <Pressable
        accessibilityLabel="Add a new quote"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading }}
        disabled={isLoading}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: palette.inverseSurface },
          hasNativeIosToolbar && styles.iosAddButton,
          pressed && styles.pressed,
        ]}
      >
        <Plus color={palette.inverseText} size={28} strokeWidth={2} />
      </Pressable>
      {profileButton}
    </View>
  );

  if (hasNativeIosToolbar) {
    return (
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Spacer />
        {/* One native toolbar item gives all three actions a single glass capsule. */}
        <Stack.Toolbar.View>{controls}</Stack.Toolbar.View>
        <Stack.Toolbar.Spacer />
      </Stack.Toolbar>
    );
  }

  if (Platform.OS === "android") {
    return (
      <Stack.Toolbar placement="bottom" backgroundColor={palette.surface}>
        <Stack.Toolbar.View>{controls}</Stack.Toolbar.View>
      </Stack.Toolbar>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.fallbackPosition, { bottom: Math.max(insets.bottom, 12) }]}
    >
      <View
        style={[
          styles.fallbackBar,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        {controls}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  fallbackBar: {
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  fallbackPosition: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  iosAddButton: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  iosRow: { height: 52, paddingHorizontal: 8 },
  pressed: { opacity: 0.65 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 24,
    height: BOTTOM_NAVIGATION_HEIGHT,
    justifyContent: "center",
  },
  secondaryButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
