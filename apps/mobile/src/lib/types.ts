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

export interface PersistedAppState {
  version: 1;
  quotes: QuoteRecord[];
  profile: LocalProfile;
  themePreference: ThemePreference;
}

export interface NewQuoteInput {
  text: string;
  speaker: string;
  imageUri: string | null;
}
