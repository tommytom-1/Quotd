import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { Camera, Images, RefreshCw, RotateCcw, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";

interface CameraStepProps {
  capturedUri: string | null;
  onCaptured: (uri: string) => void;
  onClose: () => void;
  onContinue: () => void;
  onRetake: () => void;
}

export function CameraStep({
  capturedUri,
  onCaptured,
  onClose,
  onContinue,
  onRetake,
}: CameraStepProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { palette, resolvedTheme } = useApp();
  const showToast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

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

  if (capturedUri) {
    const previewHeight = Math.min(height * 0.69, 650);
    return (
      <View
        style={[styles.confirmScreen, { backgroundColor: palette.background }]}
      >
        <StatusBar style="light" />
        <View style={[styles.preview, { height: previewHeight }]}>
          <Image source={{ uri: capturedUri }} style={styles.fill} />
          <Pressable
            accessibilityLabel="Close capture"
            onPress={onClose}
            style={({ pressed }) => [
              styles.frostedButton,
              { left: 18, position: "absolute", top: insets.top + 12 },
              pressed && styles.controlPressed,
            ]}
          >
            <X color="#FFFFFF" size={17} strokeWidth={2.1} />
          </Pressable>
        </View>
        <View style={styles.confirmActions}>
          <Pressable
            onPress={onContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.inverseSurface },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.primaryText, { color: palette.inverseText }]}>
              Quote it
            </Text>
          </Pressable>
          <Pressable
            onPress={onRetake}
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: palette.surfaceMuted },
              pressed && styles.buttonPressed,
            ]}
          >
            <RefreshCw
              color={palette.textSecondary}
              size={15}
              strokeWidth={1.8}
            />
            <Text
              style={[styles.secondaryText, { color: palette.textSecondary }]}
            >
              Retake it
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!permission || !permission.granted) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[
          styles.permissionScreen,
          { backgroundColor: palette.background },
        ]}
      >
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
        <Pressable
          accessibilityLabel="Close capture"
          onPress={onClose}
          style={[styles.permissionClose, { backgroundColor: palette.surface }]}
        >
          <X color={palette.textSecondary} size={17} strokeWidth={2} />
        </Pressable>

        <View style={styles.permissionContent}>
          <View
            style={[
              styles.cameraIcon,
              { backgroundColor: palette.surfaceMuted },
            ]}
          >
            {permission ? (
              <Camera color={palette.textMuted} size={27} strokeWidth={1.45} />
            ) : (
              <ActivityIndicator color={palette.textMuted} />
            )}
          </View>
          <Text style={[styles.permissionTitle, { color: palette.text }]}>
            Frame the moment.
          </Text>
          <Text style={[styles.permissionCopy, { color: palette.textMuted }]}>
            Use your camera or choose an existing photo.
          </Text>

          <View style={styles.permissionActions}>
            <Pressable
              disabled={!permission}
              onPress={askForCamera}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: palette.inverseSurface },
                !permission && styles.disabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Camera color={palette.inverseText} size={16} strokeWidth={1.9} />
              <Text
                style={[styles.primaryText, { color: palette.inverseText }]}
              >
                {permission?.canAskAgain === false
                  ? "Open camera settings"
                  : "Enable camera"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isPickingPhoto}
              onPress={choosePhoto}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: palette.surface },
                pressed && styles.buttonPressed,
              ]}
            >
              <Images
                color={palette.textSecondary}
                size={16}
                strokeWidth={1.8}
              />
              <Text
                style={[styles.secondaryText, { color: palette.textSecondary }]}
              >
                Choose a photo
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const stageWidth = width - STAGE_INSET * 2;

  return (
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <View style={[styles.cameraHeader, { marginTop: insets.top - 5 }]}>
        <Text accessibilityRole="header" style={styles.cameraTitle}>
          Camera
        </Text>
        <Pressable
          accessibilityLabel="Switch camera"
          onPress={() => {
            setCameraReady(false);
            setFacing((current) => (current === "back" ? "front" : "back"));
          }}
          style={({ pressed }) => [
            styles.flipButton,
            pressed && styles.controlPressed,
          ]}
        >
          <RotateCcw color="#C9C9C4" size={20} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.cameraBody}>
        <View
          style={[
            styles.cameraStage,
            { height: stageWidth * PHOTO_RATIO, width: stageWidth },
          ]}
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
            style={styles.fill}
          />
        </View>
      </View>

      <View
        style={[styles.cameraControls, { marginBottom: insets.bottom + 28 }]}
      >
        <Pressable
          accessibilityLabel="Close camera"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Take photo"
          disabled={!cameraReady || isTakingPhoto}
          onPress={takePhoto}
          style={({ pressed }) => [
            styles.shutterOuter,
            (!cameraReady || isTakingPhoto) && styles.disabled,
            pressed && styles.shutterPressed,
          ]}
        >
          <SpectrumRing />
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable
          accessibilityLabel="Choose from photo library"
          accessibilityRole="button"
          hitSlop={8}
          onPress={choosePhoto}
          style={({ pressed }) => [
            styles.libraryButton,
            pressed && styles.controlPressed,
          ]}
        >
          <View style={styles.libraryPolaroid}>
            <View style={styles.libraryPhoto}>
              <Images color="#FAFAF8" size={20} strokeWidth={1.8} />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** The five-colour stripe of instant film, drawn as a ring. */
function SpectrumRing() {
  const radius = (SHUTTER_SIZE - RING_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const segment = circumference / SPECTRUM.length;
  return (
    <Svg
      height={SHUTTER_SIZE}
      style={StyleSheet.absoluteFill}
      width={SHUTTER_SIZE}
    >
      {SPECTRUM.map((color, index) => (
        <Circle
          cx={SHUTTER_SIZE / 2}
          cy={SHUTTER_SIZE / 2}
          fill="none"
          key={color}
          origin={`${SHUTTER_SIZE / 2}, ${SHUTTER_SIZE / 2}`}
          r={radius}
          rotation={-90 + (360 / SPECTRUM.length) * index}
          stroke={color}
          strokeDasharray={[segment, circumference - segment]}
          strokeWidth={RING_WIDTH}
        />
      ))}
    </Svg>
  );
}

const SPECTRUM = ["#E5482F", "#F29A2E", "#F4D03F", "#4FA560", "#3B7DD8"];
const SHUTTER_SIZE = 88;
const RING_WIDTH = 5;

/** Matches the polaroid's photo area, so the stage shows what it keeps. */
const PHOTO_RATIO = 1.03;
const STAGE_INSET = 10;
const SIDE_WIDTH = 72;

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.985 }],
  },
  cameraBody: {
    alignItems: "center",
    alignSelf: "stretch",
    flex: 1,
    justifyContent: "center",
    // Lifts the frame above true centre, towards the heading.
    paddingBottom: 56,
  },
  cameraControls: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
  },
  cameraIcon: {
    alignItems: "center",
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    marginBottom: 22,
    width: 68,
  },
  cameraScreen: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
  },
  cameraHeader: {
    alignItems: "center",
    alignSelf: "stretch",
    height: 44,
    justifyContent: "center",
  },
  cameraStage: {
    backgroundColor: "#111111",
    borderColor: "rgba(255,255,255,0.7)",
    borderCurve: "continuous",
    borderRadius: 30,
    borderWidth: 2.5,
    overflow: "hidden",
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
  confirmActions: {
    flex: 1,
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  confirmScreen: {
    flex: 1,
    padding: 6,
  },
  controlPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.91 }],
  },
  disabled: {
    opacity: 0.42,
  },
  fill: {
    height: "100%",
    width: "100%",
  },
  flipButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 14,
    width: 44,
  },
  frostedButton: {
    alignItems: "center",
    backgroundColor: "rgba(25,25,25,0.4)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  permissionActions: {
    gap: 10,
    marginTop: 30,
    maxWidth: 390,
    width: "100%",
  },
  permissionClose: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    marginLeft: 20,
    marginTop: 8,
    width: 40,
  },
  permissionContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 50,
    paddingHorizontal: 24,
  },
  permissionCopy: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 320,
    textAlign: "center",
  },
  permissionScreen: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.9,
    lineHeight: 32,
  },
  preview: {
    borderRadius: 38,
    overflow: "hidden",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 20,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 20,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "500",
  },
  cancelButton: {
    justifyContent: "center",
    minHeight: 44,
    width: SIDE_WIDTH,
  },
  cancelText: {
    color: "#E4E4DF",
    fontSize: 17,
  },
  libraryButton: {
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 60,
    width: SIDE_WIDTH,
  },
  libraryPhoto: {
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  libraryPolaroid: {
    backgroundColor: "#FAFAF8",
    paddingBottom: 13,
    paddingHorizontal: 4,
    paddingTop: 4,
    transform: [{ rotate: "6deg" }],
  },
  shutterInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 33,
    height: 66,
    width: 66,
  },
  shutterOuter: {
    alignItems: "center",
    height: SHUTTER_SIZE,
    justifyContent: "center",
    width: SHUTTER_SIZE,
  },
  shutterPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
});
