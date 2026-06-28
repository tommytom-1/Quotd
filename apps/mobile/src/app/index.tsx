import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

interface CapturedPhoto {
  uri: string;
}

const starterQuote = "The light you find is the light you keep.";

export default function HomeScreen() {
  const cameraRef = useRef<CameraView>(null);
  const photoFrameRef = useRef<View>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [quote, setQuote] = useState(starterQuote);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const takePhoto = async () => {
    if (!cameraRef.current || isTakingPhoto) {
      return;
    }

    setIsTakingPhoto(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (result?.uri) {
        setPhoto({ uri: result.uri });
      }
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const savePhoto = async () => {
    if (!photoFrameRef.current || isSavingPhoto) {
      return;
    }

    setIsSavingPhoto(true);
    try {
      const { status } = await requestPermissionsAsync(false, ["photo"]);
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to save your quote photo."
        );
        return;
      }

      const uri = await captureRef(photoFrameRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Asset.create(uri);
      Alert.alert("Saved", "Your quote photo was saved to your library.");
    } catch (error) {
      console.warn("[quotd-save-photo]", error);
      Alert.alert(
        "Save failed",
        error instanceof Error
          ? error.message
          : "We couldn't save this quote photo. Try again."
      );
    } finally {
      setIsSavingPhoto(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator color="#f8f4ec" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar style="light" />
        <Text style={styles.permissionEyebrow}>quotd prototype</Text>
        <Text style={styles.permissionTitle}>
          Camera access makes the canvas.
        </Text>
        <Text style={styles.permissionCopy}>
          Take a photo, write a quote, and preview it with a soft dark gradient
          at the bottom.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Allow camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (photo) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.previewScreen}
      >
        <StatusBar style="light" />
        <View ref={photoFrameRef} collapsable={false} style={styles.photoFrame}>
          <Image source={{ uri: photo.uri }} style={styles.photo} />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.38)", "rgba(0,0,0,0.86)"]}
            locations={[0, 0.32, 1]}
            style={styles.quoteGradient}
          />
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>
              “{quote.trim() || starterQuote}”
            </Text>
          </View>
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.composerPanel}>
          <Text style={styles.inputLabel}>Quote</Text>
          <TextInput
            multiline
            onChangeText={setQuote}
            placeholder="Write the quote to place on the picture"
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={styles.quoteInput}
            value={quote}
          />
          <View style={styles.actionsRow}>
            <Pressable
              disabled={isSavingPhoto}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || isSavingPhoto) && styles.buttonPressed,
              ]}
              onPress={() => setPhoto(null)}
            >
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </Pressable>
            <Pressable
              disabled={isSavingPhoto}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || isSavingPhoto) && styles.buttonPressed,
              ]}
              onPress={() => setQuote(starterQuote)}
            >
              <Text style={styles.secondaryButtonText}>Try sample</Text>
            </Pressable>
            <Pressable
              disabled={isSavingPhoto}
              style={({ pressed }) => [
                styles.primaryButtonCompact,
                (pressed || isSavingPhoto) && styles.buttonPressed,
              ]}
              onPress={savePhoto}
            >
              <Text style={styles.primaryButtonText}>
                {isSavingPhoto ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        facing="back"
        mode="picture"
        style={styles.camera}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.58)", "transparent", "rgba(0,0,0,0.72)"]}
        locations={[0, 0.34, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.cameraOverlay}>
        <View style={styles.cameraHeader}>
          <Text style={styles.permissionEyebrow}>quotd</Text>
          <Text style={styles.cameraTitle}>Frame a moment.</Text>
        </View>
        <View style={styles.captureArea}>
          <Pressable
            accessibilityLabel="Take photo"
            disabled={isTakingPhoto}
            onPress={takePhoto}
            style={({ pressed }) => [
              styles.shutterOuter,
              (pressed || isTakingPhoto) && styles.shutterPressed,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Text style={styles.captureHint}>
            Tap to capture, then add your quote.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  buttonPressed: {
    opacity: 0.62,
    transform: [{ scale: 0.98 }],
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  cameraOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    justifyContent: "space-between",
  },
  cameraScreen: {
    backgroundColor: "#050505",
    flex: 1,
  },
  cameraTitle: {
    color: "#fffaf1",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    marginTop: 6,
  },
  captureArea: {
    alignItems: "center",
    paddingBottom: 24,
  },
  captureHint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    marginTop: 14,
  },
  centeredScreen: {
    alignItems: "center",
    backgroundColor: "#10100f",
    flex: 1,
    justifyContent: "center",
  },
  composerPanel: {
    backgroundColor: "#11100f",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  permissionCopy: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 30,
    marginTop: 14,
    maxWidth: 330,
    textAlign: "center",
  },
  permissionEyebrow: {
    color: "#d6b36a",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  permissionScreen: {
    alignItems: "center",
    backgroundColor: "#11100f",
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  permissionTitle: {
    color: "#fffaf1",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.1,
    lineHeight: 42,
    marginTop: 10,
    maxWidth: 350,
    textAlign: "center",
  },
  photo: {
    height: "100%",
    width: "100%",
  },
  photoFrame: {
    backgroundColor: "#050505",
    flex: 1,
    overflow: "hidden",
  },
  previewScreen: {
    backgroundColor: "#11100f",
    flex: 1,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#f8f4ec",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 24,
  },
  primaryButtonCompact: {
    alignItems: "center",
    backgroundColor: "#f8f4ec",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#14110f",
    fontSize: 16,
    fontWeight: "800",
  },
  quoteBlock: {
    bottom: 36,
    left: 24,
    maxWidth: "84%",
    position: "absolute",
  },
  quoteGradient: {
    bottom: 0,
    height: "42%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  quoteInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.11)",
    borderRadius: 18,
    borderWidth: 1,
    color: "#fffaf1",
    fontSize: 17,
    lineHeight: 24,
    minHeight: 96,
    padding: 16,
    textAlignVertical: "top",
  },
  quoteText: {
    color: "#fffaf1",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.9,
    lineHeight: 38,
    textAlign: "left",
    textShadowColor: "rgba(0,0,0,0.42)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 12,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#fffaf1",
    fontSize: 16,
    fontWeight: "800",
  },
  shutterInner: {
    backgroundColor: "#fffaf1",
    borderRadius: 999,
    height: 58,
    width: 58,
  },
  shutterOuter: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 999,
    borderWidth: 4,
    height: 78,
    justifyContent: "center",
    width: 78,
  },
  shutterPressed: {
    opacity: 0.62,
    transform: [{ scale: 0.96 }],
  },
});
