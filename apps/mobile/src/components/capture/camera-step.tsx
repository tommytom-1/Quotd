import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import {
  Camera,
  Images,
  RefreshCw,
  RotateCcw,
  Type,
  X,
} from "lucide-react-native";
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

import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";

interface CameraStepProps {
  capturedUri: string | null;
  onCaptured: (uri: string) => void;
  onClose: () => void;
  onContinue: () => void;
  onRetake: () => void;
  onTextOnly: () => void;
}

export function CameraStep({
  capturedUri,
  onCaptured,
  onClose,
  onContinue,
  onRetake,
  onTextOnly,
}: CameraStepProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
            Use your camera, choose an existing photo, or keep the quote
            beautifully text-only.
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
            <Pressable
              onPress={onTextOnly}
              style={({ pressed }) => [
                styles.textOnlyButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Type color={palette.textMuted} size={15} strokeWidth={1.8} />
              <Text style={[styles.textOnlyText, { color: palette.textMuted }]}>
                Continue without a photo
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <View style={styles.cameraViewport}>
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
        <View style={styles.cameraShade} />

        <Pressable
          accessibilityLabel="Continue without a photo"
          onPress={onTextOnly}
          style={({ pressed }) => [
            styles.cameraTextButton,
            { left: 18, top: insets.top + 12 },
            pressed && styles.controlPressed,
          ]}
        >
          <Type color="#FFFFFF" size={14} strokeWidth={1.9} />
          <Text style={styles.cameraTextLabel}>Text only</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Switch camera"
          onPress={() => {
            setCameraReady(false);
            setFacing((current) => (current === "back" ? "front" : "back"));
          }}
          style={({ pressed }) => [
            styles.frostedButton,
            { position: "absolute", right: 18, top: insets.top + 12 },
            pressed && styles.controlPressed,
          ]}
        >
          <RotateCcw color="#FFFFFF" size={16} strokeWidth={1.9} />
        </Pressable>

        <View style={[styles.cameraControls, { bottom: insets.bottom + 27 }]}>
          <FrostedButton
            icon={<X color="#FFFFFF" size={17} strokeWidth={2} />}
            label="Close camera"
            onPress={onClose}
          />
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
            <View style={styles.shutterInner} />
          </Pressable>
          <FrostedButton
            icon={<Images color="#FFFFFF" size={16} strokeWidth={1.8} />}
            label="Choose from photo library"
            onPress={choosePhoto}
          />
        </View>
      </View>
    </View>
  );
}

function FrostedButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frostedButton,
        pressed && styles.controlPressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.985 }],
  },
  cameraControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 25,
    position: "absolute",
    right: 25,
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
    backgroundColor: "#000000",
    flex: 1,
    padding: 6,
  },
  cameraShade: {
    backgroundColor: "rgba(0,0,0,0.05)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  cameraTextButton: {
    alignItems: "center",
    backgroundColor: "rgba(25,25,25,0.4)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
    position: "absolute",
  },
  cameraTextLabel: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  cameraViewport: {
    borderRadius: 38,
    flex: 1,
    overflow: "hidden",
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
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.9,
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
    fontWeight: "700",
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
    fontWeight: "700",
  },
  shutterInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 31,
    height: 59,
    width: 59,
  },
  shutterOuter: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 40,
    borderWidth: 3,
    height: 78,
    justifyContent: "center",
    width: 78,
  },
  shutterPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  textOnlyButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
  },
  textOnlyText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
