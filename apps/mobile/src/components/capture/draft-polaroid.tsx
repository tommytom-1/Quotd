import { useMemo, useState } from "react";
import { useSharedValue } from "react-native-reanimated";

import { Polaroid } from "@/components/polaroid";
import type { QuoteRecord } from "@/lib/types";

/**
 * The quote being captured, drawn by the same polaroid the wall uses, so what
 * is shown while writing is exactly what will be saved. `withSpeaker` grows
 * the caption to show the whole quote and who said it.
 */
export function DraftPolaroid({
  imageUri,
  speaker,
  text,
  width,
  withSpeaker = false,
}: {
  imageUri: string | null;
  speaker: string;
  text: string;
  width: number;
  withSpeaker?: boolean;
}) {
  const [createdAt] = useState(Date.now);
  const progress = useSharedValue(1);
  const quote = useMemo<QuoteRecord>(
    () => ({ createdAt, id: "draft", imageUri, speaker, text }),
    [createdAt, imageUri, speaker, text]
  );
  return (
    <Polaroid
      focus={withSpeaker ? { progress } : undefined}
      // An animated height outlives the focus that set it, so switching the
      // speaker line on or off starts a fresh polaroid.
      key={withSpeaker ? "speaker" : "quote"}
      quote={quote}
      width={width}
    />
  );
}
