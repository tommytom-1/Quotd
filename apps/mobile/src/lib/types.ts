export type ThemePreference = "system" | "light" | "dark";

/** The lettering a quote's caption is set in. */
export type QuoteFont =
  | "mynerve"
  | "caveat"
  | "shadows"
  | "fraunces"
  | "instrumentSerif"
  | "dmSans"
  | "plexMono";

export type QuoteAlign = "left" | "center" | "right";

export interface QuoteRecord {
  id: string;
  text: string;
  speaker: string;
  imageUri: string | null;
  /** Quotes saved before captions could be styled have neither. */
  font?: QuoteFont;
  align?: QuoteAlign;
  createdAt: number;
  updatedAt?: number;
}

export interface LocalProfile {
  displayName: string;
  avatarUri: string | null;
}

export interface SpeakerProfile {
  id: string;
  name: string;
  avatarUri: string | null;
  color: string;
}

export interface PersistedAppState {
  version: 1;
  quotes: QuoteRecord[];
  speakers: SpeakerProfile[];
  profile: LocalProfile;
  themePreference: ThemePreference;
}

export interface NewQuoteInput {
  text: string;
  speaker: string;
  imageUri: string | null;
  font?: QuoteFont;
  align?: QuoteAlign;
}
