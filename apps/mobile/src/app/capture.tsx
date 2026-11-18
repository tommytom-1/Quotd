import { useNavigation, useRouter } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Keyboard, StyleSheet } from "react-native";
import type { HostInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { CameraStep } from "@/components/capture/camera-step";
import { CaptionStep } from "@/components/capture/caption-step";
import {
  DevelopingPolaroid,
  PRINT_TILT,
} from "@/components/capture/developing-polaroid";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { setArrivingQuote } from "@/lib/home-view";
import { DEFAULT_ALIGN, DEFAULT_FONT } from "@/lib/polaroid";
import type { Frame } from "@/lib/polaroid";
import { rankSpeakers } from "@/lib/quote-utils";
import type { QuoteAlign, QuoteFont } from "@/lib/types";

type CaptureStage = "camera" | "person" | "quote";

/** Closing the camera: it settles back a little as the wall fades in. */
const CLOSE_MS = 300;
const CLOSE_SCALE = 0.94;

export default function CaptureScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const showToast = useToast();
  const { addQuote, quotes } = useApp();
  const [stage, setStage] = useState<CaptureStage>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [font, setFont] = useState<QuoteFont>(DEFAULT_FONT);
  const [align, setAlign] = useState<QuoteAlign>(DEFAULT_ALIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Set the moment the tick is tapped: the print lifts off and is shaken
  // while the quote is saved, rather than after.
  const [lifted, setLifted] = useState<{ from: Frame | null } | null>(null);
  const draftRef = useRef<HostInstance>(null);
  const suggestions = useMemo(() => rankSpeakers(quotes), [quotes]);
  const leaving = useSharedValue(0);
  const leavingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - CLOSE_SCALE) * leaving.value }],
  }));

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isSaving) {
          return true;
        }
        if (stage === "quote") {
          setStage("person");
          return true;
        }
        if (stage === "person") {
          setStage("camera");
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [isSaving, stage]);

  // The developed print is handed to the wall, which flies it into its place,
  // so this screen goes at once rather than sliding away with it.
  const showWall = useCallback(
    (print: Frame | null) => {
      if (savedId && print) {
        setArrivingQuote({ from: print, id: savedId, rotate: PRINT_TILT });
        navigation.setOptions({ animation: "none" });
      }
      router.dismissTo("/quotes");
    },
    [navigation, router, savedId]
  );

  // Fades back to the wall rather than sliding off as one heavy black slab.
  const close = () => {
    if (router.canGoBack()) {
      navigation.setOptions({ animation: "fade" });
      leaving.set(
        withTiming(1, { duration: CLOSE_MS, easing: Easing.out(Easing.quad) })
      );
      router.back();
    } else {
      router.replace("/");
    }
  };

  const retake = () => {
    setImageUri(null);
    setStage("camera");
  };

  const save = async () => {
    if (!quoteText.trim() || !speaker.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    Keyboard.dismiss();
    const draft = draftRef.current;
    if (draft) {
      draft.measureInWindow((x, y, frameWidth, frameHeight) =>
        setLifted({
          from:
            frameWidth > 0
              ? { height: frameHeight, width: frameWidth, x, y }
              : null,
        })
      );
    } else {
      setLifted({ from: null });
    }
    try {
      const saved = await addQuote({
        align,
        font,
        imageUri,
        speaker,
        text: quoteText,
      });
      setSavedId(saved.id);
    } catch (error) {
      console.warn("[quotd-save-quote]", error);
      // The print goes back down onto the page, to be saved again.
      setLifted(null);
      showToast("Could not save your quote", "error");
      setIsSaving(false);
    }
  };

  if (stage === "person") {
    return (
      <CaptionStep
        imageUri={imageUri}
        label="Quote from"
        leading={{ icon: X, label: "Retake photo" }}
        onChangeText={setSpeaker}
        onLeading={retake}
        onSubmit={() => setStage("quote")}
        placeholder="Their name"
        submitLabel="Next"
        suggestions={suggestions}
        value={speaker}
      />
    );
  }

  if (stage === "quote") {
    return (
      <>
        <CaptionStep
          busy={isSaving}
          imageUri={imageUri}
          label={`${speaker.trim()} said`}
          leading={{ icon: ChevronLeft, label: "Back to who said it" }}
          multiline
          onChangeText={setQuoteText}
          onLeading={() => setStage("person")}
          onSubmit={save}
          placeholder="What they said"
          polaroid={{
            align,
            font,
            frameRef: draftRef,
            hidden: lifted !== null,
            onAlign: setAlign,
            onFont: setFont,
            speaker,
          }}
          submitLabel="Save quote"
          value={quoteText}
        />
        {lifted ? (
          <DevelopingPolaroid
            align={align}
            font={font}
            from={lifted.from}
            imageUri={imageUri}
            onDone={showWall}
            saved={savedId !== null}
            speaker={speaker}
            text={quoteText}
          />
        ) : null}
      </>
    );
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, leavingStyle]}>
      <CameraStep
        onCaptured={(uri) => {
          setImageUri(uri);
          setStage("person");
        }}
        onClose={close}
      />
    </Animated.View>
  );
}
