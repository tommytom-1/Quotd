import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { Camera, Images, RotateCcw, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { viewfinderLayout } from "@/lib/polaroid";

interface CameraStepProps {
  onCaptured: (uri: string) => void;
  onClose: () => void;
}

export function CameraStep({ onCaptured, onClose }: CameraStepProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { palette, resolvedTheme } = useApp();
  const showToast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [viewfinder, setViewfinder] = useState<{
    height: number;
    width: number;
  } | null>(null);

  const choosePhoto = async () => {
    if (isPickingPhoto) {
      return;
    }
    setIsPickingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 0.82,
      });
      if (!result.canceled) {
        onCaptured(result.assets[0].uri);
      }
    } catch (error) {
      console.warn("[quotd-pick-photo]", error);
      showToast("Could not open your photo library", "error");
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraReady || !cameraRef.current || isTakingPhoto) {
      return;
    }
    setIsTakingPhoto(true);
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.84,
      });
      if (result?.uri) {
        onCaptured(result.uri);
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
          console.warn("[quotd-haptics]", error);
        }
      }
    } catch (error) {
      console.warn("[quotd-camera]", error);
      showToast("The camera could not take that photo", "error");
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const askForCamera = async () => {
    if (permission && !permission.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await requestPermission();
  };

  const statusBar = (
    <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
  );

  if (!permission || !permission.granted) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: palette.background,
            paddingBottom: insets.bottom + 16,
            paddingTop: insets.top + 4,
          },
        ]}
      >
        {statusBar}
        <View
          style={[
            styles.viewfinder,
            styles.permission,
            { backgroundColor: palette.surface },
          ]}
        >
          <Pressable
            accessibilityLabel="Close camera"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <X color={palette.text} size={28} strokeWidth={1.8} />
          </Pressable>
          {permission ? (
            <Camera color={palette.textMuted} size={30} strokeWidth={1.5} />
          ) : (
            <ActivityIndicator color={palette.textMuted} />
          )}
          <Text style={[styles.permissionTitle, { color: palette.text }]}>
            Frame the moment
          </Text>
          <Text style={[styles.permissionCopy, { color: palette.textMuted }]}>
            Use your camera, or choose a photo you already have.
          </Text>
          <View style={styles.permissionActions}>
            <Pressable
              accessibilityRole="button"
              disabled={!permission}
              onPress={askForCamera}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: palette.inverseSurface },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pillText, { color: palette.inverseText }]}>
                {permission?.canAskAgain === false
                  ? "Open camera settings"
                  : "Enable camera"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isPickingPhoto}
              onPress={choosePhoto}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: palette.surfaceMuted },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pillText, { color: palette.text }]}>
                Choose a photo
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const layout = viewfinder ? viewfinderLayout(viewfinder) : null;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: palette.background,
          paddingBottom: insets.bottom + BELOW_VIEWFINDER,
          paddingTop: insets.top + 4,
        },
      ]}
    >
      {statusBar}
      <View style={styles.frame}>
        <View
          onLayout={(event) => setViewfinder(event.nativeEvent.layout)}
          style={[styles.viewfinder, { backgroundColor: "#111111" }]}
        >
          {/* Sized to the photo itself, so nothing outside it is cropped
              away unseen; the guide inside marks what the polaroid keeps. */}
          {layout ? (
            <View
              style={{
                height: layout.preview.height,
                left: layout.preview.x,
                position: "absolute",
                top: layout.preview.y,
                width: layout.preview.width,
              }}
            >
              <CameraView
                ref={cameraRef}
                active
                facing={facing}
                mirror={facing === "front"}
                mode="picture"
                onCameraReady={() => setCameraReady(true)}
                onMountError={(event) => {
                  setCameraReady(false);
                  console.warn("[quotd-camera-mount]", event.message);
                  showToast("The camera could not start", "error");
                }}
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.guide,
                  {
                    height: layout.guide.height,
                    left: layout.guide.x,
                    top: layout.guide.y,
                    width: layout.guide.width,
                  },
                ]}
              />
            </View>
          ) : null}
          <Pressable
            accessibilityLabel="Close camera"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <X color="#FFFFFF" size={28} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            accessibilityLabel="Switch camera"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              setCameraReady(false);
              setFacing((current) => (current === "back" ? "front" : "back"));
            }}
            style={({ pressed }) => [styles.flip, pressed && styles.pressed]}
          >
            <RotateCcw color="#FFFFFF" size={24} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            accessibilityLabel="Choose from photo library"
            accessibilityRole="button"
            disabled={isPickingPhoto}
            hitSlop={8}
            onPress={choosePhoto}
            style={({ pressed }) => [styles.library, pressed && styles.pressed]}
          >
            <Images color="#FFFFFF" size={24} strokeWidth={1.8} />
          </Pressable>
        </View>
        {/* The shutter sits in a bite taken out of the viewfinder's edge. */}
        <View
          pointerEvents="none"
          style={[styles.notch, { backgroundColor: palette.background }]}
        />
        <Pressable
          accessibilityLabel="Take photo"
          accessibilityRole="button"
          disabled={!cameraReady || isTakingPhoto}
          onPress={takePhoto}
          style={({ pressed }) => [
            styles.shutter,
            { backgroundColor: palette.background },
            (!cameraReady || isTakingPhoto) && styles.disabled,
            pressed && styles.shutterPressed,
          ]}
        />
      </View>
    </View>
  );
}

const SHUTTER_SIZE = 76;
/** The bite around the shutter, wider than it by the gap between them. */
const NOTCH_SIZE = SHUTTER_SIZE + 16;
const BELOW_VIEWFINDER = SHUTTER_SIZE / 2 + 34;

const styles = StyleSheet.create({
  close: {
    left: 20,
    position: "absolute",
    top: 20,
  },
  disabled: {
    opacity: 0.4,
  },
  flip: {
    position: "absolute",
    right: 20,
    top: 22,
  },
  frame: {
    flex: 1,
    marginHorizontal: 12,
  },
  // Marks the part of the photo that the polaroid keeps.
  guide: {
    borderColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    position: "absolute",
  },
  library: {
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.35)",
    borderRadius: 26,
    bottom: 18,
    height: 52,
    justifyContent: "center",
    left: 18,
    position: "absolute",
    width: 52,
  },
  notch: {
    alignSelf: "center",
    borderRadius: NOTCH_SIZE / 2,
    bottom: -NOTCH_SIZE / 2,
    height: NOTCH_SIZE,
    position: "absolute",
    width: NOTCH_SIZE,
  },
  permission: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  permissionActions: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 28,
  },
  permissionCopy: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: -0.6,
    marginTop: 18,
  },
  pill: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 54,
  },
  pillText: {
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
  screen: {
    flex: 1,
  },
  shutter: {
    alignSelf: "center",
    borderColor: "#C2AFA4",
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 3,
    bottom: -SHUTTER_SIZE / 2,
    height: SHUTTER_SIZE,
    position: "absolute",
    width: SHUTTER_SIZE,
  },
  shutterPressed: {
    transform: [{ scale: 0.92 }],
  },
  viewfinder: {
    borderCurve: "continuous",
    borderRadius: 34,
    flex: 1,
    overflow: "hidden",
  },
});
