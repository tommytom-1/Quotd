import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType, FlashMode } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import {
  Camera,
  Image as ImageIcon,
  RotateCcw,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
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

import { SmoothEdges } from "@/components/smooth-edges";
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
  const [flash, setFlash] = useState<Flash>("off");
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
                    flash={flash}
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
                accessibilityLabel={`Flash ${FLASH_LABELS[flash]}`}
                accessibilityHint="Changes the flash"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setFlash(FLASH_NEXT[flash])}
                style={({ pressed }) => [
                  styles.flash,
                  pressed && styles.pressed,
                ]}
              >
                {flash === "off" ? (
                  <ZapOff color="#FFFFFF" size={22} strokeWidth={1.8} />
                ) : (
                  <Zap
                    color={FLASH_ON}
                    fill={FLASH_ON}
                    size={22}
                    strokeWidth={1.8}
                  />
                )}
                {flash === "auto" ? (
                  <Text style={styles.flashAuto}>A</Text>
                ) : null}
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
                // The ring takes the text colour, so it stays clear in dark mode.
                {
                  backgroundColor: palette.background,
                  borderColor: palette.text,
                },
                (!cameraReady || isTakingPhoto) && styles.disabled,
                pressed && styles.shutterPressed,
              ]}
            />
            {/* Either side of the shutter, below the viewfinder. */}
            <Pressable
              accessibilityLabel="Close camera"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={({ pressed }) => [
                styles.belowButton,
                styles.close,
                { backgroundColor: palette.surfaceMuted },
                pressed && styles.pressed,
              ]}
            >
              <X color={palette.text} size={28} strokeWidth={2} />
            </Pressable>
            <Pressable
              accessibilityLabel="Choose from photo library"
              accessibilityRole="button"
              disabled={isPickingPhoto}
              hitSlop={10}
              onPress={choosePhoto}
              style={({ pressed }) => [
                styles.belowButton,
                styles.library,
                pressed && styles.pressed,
              ]}
            >
              <BlankPolaroid />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type Lens = "wide" | "ultraWide";
type Flash = Extract<FlashMode, "off" | "auto" | "on">;

/** Each tap moves the flash on, as the system camera does. */
const FLASH_NEXT: Record<Flash, Flash> = { auto: "on", off: "auto", on: "off" };
const FLASH_LABELS: Record<Flash, string> = {
  auto: "automatic",
  off: "off",
  on: "on",
};
const FLASH_ON = "#FFD60A";

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
/** The close and library buttons, either side of the shutter's lower half. */
const BELOW_BUTTON_SIZE = 56;
const BELOW_BUTTON_GAP = 20;
/** How far in from the viewfinder's sides they sit, as a pair. */
const BELOW_BUTTON_INSET = 30;
const BELOW_VIEWFINDER = BELOW_BUTTON_GAP + BELOW_BUTTON_SIZE + 10;
/** The lens switch sits this far above the bite, clear of the shutter. */
const LENSES_ABOVE_NOTCH = 10;

const styles = StyleSheet.create({
  belowButton: {
    alignItems: "center",
    height: BELOW_BUTTON_SIZE,
    justifyContent: "center",
    marginTop: BELOW_BUTTON_GAP,
    position: "absolute",
    top: "100%",
    width: BELOW_BUTTON_SIZE,
  },
  close: {
    borderRadius: BELOW_BUTTON_SIZE / 2,
    left: BELOW_BUTTON_INSET,
  },
  closePlain: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    left: 18,
    position: "absolute",
    top: 18,
    width: 44,
  },
  disabled: {
    opacity: 0.4,
  },
  flash: {
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
  // The small "A" beside the bolt when the flash fires only when it is dark.
  flashAuto: {
    bottom: 7,
    color: FLASH_ON,
    fontSize: 10,
    fontWeight: "700",
    position: "absolute",
    right: 8,
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
    // Measured from the photo, which stops short of the viewfinder's edge.
    bottom: NOTCH_SIZE / 2 - PREVIEW_INSET + LENSES_ABOVE_NOTCH,
    flexDirection: "row",
    gap: 4,
    padding: 4,
    position: "absolute",
  },
  library: {
    right: BELOW_BUTTON_INSET,
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

/** An empty polaroid with a picture in it: a photo from the library. */
function BlankPolaroid() {
  return (
    // Set down a little askew, as a real one would be.
    <View style={polaroidStyles.tilt}>
      <SmoothEdges margin={6}>
        <View style={polaroidStyles.paper}>
          <View style={polaroidStyles.photo}>
            <ImageIcon color="#6F6C66" size={20} strokeWidth={2} />
          </View>
        </View>
      </SmoothEdges>
    </View>
  );
}

const polaroidStyles = StyleSheet.create({
  paper: {
    backgroundColor: "#F3F2EE",
    borderColor: "rgba(0,0,0,0.14)",
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    height: 56,
    paddingHorizontal: 4,
    paddingTop: 4,
    shadowColor: "#000",
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 2.5,
    width: 46,
  },
  photo: {
    alignItems: "center",
    aspectRatio: 1 / 1.03,
    backgroundColor: "#DCD9D2",
    justifyContent: "center",
  },
  tilt: {
    transform: [{ rotate: "6deg" }],
  },
});
