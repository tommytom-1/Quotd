export type ThemePreference = "system" | "light" | "dark";

export interface QuoteRecord {
  id: string;
  text: string;
  speaker: string;
  imageUri: string | null;
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
}
