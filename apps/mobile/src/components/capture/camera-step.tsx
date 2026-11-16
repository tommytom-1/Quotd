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
  const [lens, setLens] = useState<Lens>("wide");
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const lensType = lens === "ultraWide" ? ULTRA_WIDE : WIDE;
  const [cameraReady, setCameraReady] = useState(false);
  // expo-camera reports ready once, when its session starts, and not again
  // after the camera is switched; this marks a switch that is still under way.
  const isSwitchingCamera = useRef(false);
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
            style={({ pressed }) => [
              styles.close,
              styles.closePlain,
              pressed && styles.pressed,
            ]}
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

  const layout = viewfinder
    ? viewfinderLayout(viewfinder, PREVIEW_INSET)
    : null;

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
      <View
        onLayout={(event) => setViewfinder(event.nativeEvent.layout)}
        style={styles.area}
      >
        {layout ? (
          <View style={[styles.frame, layout.card]}>
            <View style={[styles.viewfinder, { backgroundColor: "#111111" }]}>
              {/* Sized to the photo itself, so nothing outside it is cropped
              away unseen; the guide inside marks what the polaroid keeps. */}
              {layout ? (
                <View
                  style={[
                    styles.preview,
                    {
                      height: layout.preview.height,
                      left: layout.preview.x,
                      top: layout.preview.y,
                      width: layout.preview.width,
                    },
                  ]}
                >
                  <CameraView
                    ref={cameraRef}
                    active
                    facing={facing}
                    mirror={facing === "front"}
                    mode="picture"
                    pictureSize="3840x2160"
                    onAvailableLensesChanged={({ lenses }) => {
                      setHasUltraWide(
                        lenses.some((entry) => entry.deviceType === ULTRA_WIDE)
                      );
                      // Sent each time the session takes a new camera, which
                      // is when the switched camera can take a photo.
                      if (isSwitchingCamera.current) {
                        isSwitchingCamera.current = false;
                        setCameraReady(true);
                      }
                    }}
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={(event) => {
                      setCameraReady(false);
                      console.warn("[quotd-camera-mount]", event.message);
                      showToast("The camera could not start", "error");
                    }}
                    // Named, not left to the multi-lens camera: on that one, zoom
                    // 1.0 is the ultra-wide, and switching to photo mode resets
                    // the zoom there after expo-camera has set it to 1x.
                    selectedLens={facing === "back" ? lensType : undefined}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.guide,
                      {
                        borderRadius: layout.guide.radius,
                        height: layout.guide.height,
                        left: layout.guide.x,
                        top: layout.guide.y,
                        width: layout.guide.width,
                      },
                    ]}
                  />
                  {facing === "back" && hasUltraWide ? (
                    <View style={styles.lenses}>
                      {LENSES.map((option) => {
                        const selected = lens === option.lens;
                        return (
                          <Pressable
                            accessibilityLabel={option.accessibilityLabel}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            hitSlop={6}
                            key={option.lens}
                            onPress={() => setLens(option.lens)}
                            style={[
                              styles.lens,
                              selected && styles.lensSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.lensText,
                                selected && styles.lensTextSelected,
                              ]}
                            >
                              {selected ? `${option.label}×` : option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Pressable
                accessibilityLabel="Close camera"
                accessibilityRole="button"
                hitSlop={12}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.pressed,
                ]}
              >
                <X color="#FFFFFF" size={28} strokeWidth={1.8} />
              </Pressable>
              <Pressable
                accessibilityLabel="Switch camera"
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  isSwitchingCamera.current = true;
                  setCameraReady(false);
                  setFacing((current) =>
                    current === "back" ? "front" : "back"
                  );
                }}
                style={({ pressed }) => [
                  styles.flip,
                  pressed && styles.pressed,
                ]}
              >
                <RotateCcw color="#FFFFFF" size={24} strokeWidth={1.8} />
              </Pressable>
              <Pressable
                accessibilityLabel="Choose from photo library"
                accessibilityRole="button"
                disabled={isPickingPhoto}
                hitSlop={8}
                onPress={choosePhoto}
                style={({ pressed }) => [
                  styles.library,
                  pressed && styles.pressed,
                ]}
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
        ) : null}
      </View>
    </View>
  );
}

type Lens = "wide" | "ultraWide";

const WIDE = "AVCaptureDeviceTypeBuiltInWideAngleCamera";
const ULTRA_WIDE = "AVCaptureDeviceTypeBuiltInUltraWideCamera";
const LENSES: { accessibilityLabel: string; label: string; lens: Lens }[] = [
  { accessibilityLabel: "Ultra wide lens", label: ".5", lens: "ultraWide" },
  { accessibilityLabel: "Standard lens", label: "1", lens: "wide" },
];
/** Room between the photo and the viewfinder's sides, so all of the guide shows. */
const PREVIEW_INSET = 10;
const SHUTTER_SIZE = 76;
/** The bite around the shutter, wider than it by the gap between them. */
const NOTCH_SIZE = SHUTTER_SIZE + 16;
const BELOW_VIEWFINDER = SHUTTER_SIZE / 2 + 34;

const styles = StyleSheet.create({
  close: {
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.35)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    left: 18,
    position: "absolute",
    top: 18,
    width: 44,
  },
  closePlain: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.4,
  },
  flip: {
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.35)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 18,
    width: 44,
  },
  area: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 12,
  },
  frame: {},
  // Marks the part of the photo that the polaroid keeps.
  guide: {
    borderColor: "rgba(255,255,255,0.6)",
    borderCurve: "continuous",
    borderWidth: 1.5,
    position: "absolute",
  },
  lens: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  lensSelected: {
    backgroundColor: "rgba(20,20,20,0.55)",
  },
  lensText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  lensTextSelected: {
    color: "#FFD60A",
  },
  lenses: {
    alignSelf: "center",
    backgroundColor: "rgba(20,20,20,0.3)",
    borderRadius: 20,
    bottom: 12,
    flexDirection: "row",
    gap: 4,
    padding: 4,
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
  preview: {
    borderCurve: "continuous",
    borderRadius: 22,
    overflow: "hidden",
    position: "absolute",
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
