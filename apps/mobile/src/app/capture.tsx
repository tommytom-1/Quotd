import { useRouter } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Keyboard } from "react-native";

import { CameraStep } from "@/components/capture/camera-step";
import { CaptionStep } from "@/components/capture/caption-step";
import { DevelopingPolaroid } from "@/components/capture/developing-polaroid";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSuccessHaptic } from "@/lib/haptics";
import { rankSpeakers } from "@/lib/quote-utils";

type CaptureStage = "camera" | "person" | "quote";

export default function CaptureScreen() {
  const router = useRouter();
  const showToast = useToast();
  const { addQuote, quotes } = useApp();
  const [stage, setStage] = useState<CaptureStage>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const suggestions = useMemo(() => rankSpeakers(quotes), [quotes]);

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

  const showWall = useCallback(() => router.dismissTo("/quotes"), [router]);

  const close = () => {
    if (router.canGoBack()) {
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
    try {
      await addQuote({
        imageUri,
        speaker,
        text: quoteText,
      });
      Keyboard.dismiss();
      setIsSaved(true);
      await playSuccessHaptic();
    } catch (error) {
      console.warn("[quotd-save-quote]", error);
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
          submitLabel="Save quote"
          value={quoteText}
        />
        {isSaved ? (
          <DevelopingPolaroid
            imageUri={imageUri}
            onDone={showWall}
            speaker={speaker}
            text={quoteText}
          />
        ) : null}
      </>
    );
  }

  return (
    <CameraStep
      onCaptured={(uri) => {
        setImageUri(uri);
        setStage("person");
      }}
      onClose={close}
    />
  );
}
