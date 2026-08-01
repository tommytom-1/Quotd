import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler } from "react-native";

import { CameraStep } from "@/components/capture/camera-step";
import { PersonStep } from "@/components/capture/person-step";
import { QuoteTextStep } from "@/components/capture/quote-text-step";
import { useApp } from "@/context/app-context";
import { useToast } from "@/context/toast-context";
import { playSuccessHaptic } from "@/lib/haptics";
import { rankSpeakers } from "@/lib/quote-utils";

type CaptureStage = "camera" | "quote" | "person";

export default function CaptureScreen() {
  const router = useRouter();
  const showToast = useToast();
  const { addQuote, quotes } = useApp();
  const [stage, setStage] = useState<CaptureStage>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const suggestions = useMemo(() => rankSpeakers(quotes), [quotes]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isSaving) {
          return true;
        }
        if (stage === "person") {
          setStage("quote");
          return true;
        }
        if (stage === "quote") {
          setStage("camera");
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [isSaving, stage]);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
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
      await playSuccessHaptic();
      showToast("Quote saved");
      router.dismissTo("/quotes");
    } catch (error) {
      console.warn("[quotd-save-quote]", error);
      showToast("Could not save your quote", "error");
      setIsSaving(false);
    }
  };

  if (stage === "quote") {
    return (
      <QuoteTextStep
        onBack={() => setStage("camera")}
        onChangeText={setQuoteText}
        onContinue={() => setStage("person")}
        text={quoteText}
      />
    );
  }

  if (stage === "person") {
    return (
      <PersonStep
        isSaving={isSaving}
        name={speaker}
        onBack={() => setStage("quote")}
        onChangeName={setSpeaker}
        onSave={save}
        suggestions={suggestions}
      />
    );
  }

  return (
    <CameraStep
      capturedUri={imageUri}
      onCaptured={setImageUri}
      onClose={close}
      onContinue={() => setStage("quote")}
      onRetake={() => setImageUri(null)}
      onTextOnly={() => {
        setImageUri(null);
        setStage("quote");
      }}
    />
  );
}
