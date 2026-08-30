import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import type { ColorSchemeName } from "react-native";

import {
  ensureSpeakerProfiles,
  renameSpeakerInState,
} from "@/lib/speaker-utils";
import {
  createInitialState,
  createLocalId,
  deletePersistedImage,
  loadAppState,
  persistImage,
  resetStorage,
  saveAppState,
} from "@/lib/storage";
import { PALETTES } from "@/lib/theme";
import type { AppPalette, ResolvedTheme } from "@/lib/theme";
import type {
  LocalProfile,
  NewQuoteInput,
  PersistedAppState,
  QuoteRecord,
  SpeakerProfile,
  ThemePreference,
} from "@/lib/types";

interface AppContextValue {
  isLoading: boolean;
  quotes: QuoteRecord[];
  speakers: SpeakerProfile[];
  renameSpeaker: (id: string, name: string) => void;
  setSpeakerAvatarFromUri: (id: string, uri: string) => Promise<void>;
  removeSpeakerAvatar: (id: string) => void;
  profile: LocalProfile;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  palette: AppPalette;
  addQuote: (input: NewQuoteInput) => Promise<QuoteRecord>;
  updateQuote: (
    id: string,
    updates: Pick<QuoteRecord, "text" | "speaker">
  ) => QuoteRecord;
  deleteQuote: (id: string) => void;
  setDisplayName: (displayName: string) => void;
  setAvatarFromUri: (uri: string) => Promise<void>;
  removeAvatar: () => void;
  setThemePreference: (theme: ThemePreference) => void;
  clearAllData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function resolveTheme(
  preference: ThemePreference,
  systemTheme: ColorSchemeName
): ResolvedTheme {
  switch (preference) {
    case "dark": {
      return "dark";
    }
    case "light": {
      return "light";
    }
    default: {
      return systemTheme === "dark" ? "dark" : "light";
    }
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const systemTheme = useColorScheme();
  const [state, setState] = useState<PersistedAppState>(createInitialState);
  const [isLoading, setIsLoading] = useState(true);
  const stateRef = useRef(state);
  const generationRef = useRef(0);
  const speakerAvatarRequests = useRef(new Map<string, symbol>());
  const profileAvatarRequest = useRef<symbol | null>(null);

  const deleteUnusedImage = useCallback((uri: string | null) => {
    const { current } = stateRef;
    if (
      uri &&
      current.profile.avatarUri !== uri &&
      !current.quotes.some((quote) => quote.imageUri === uri) &&
      !current.speakers.some((speaker) => speaker.avatarUri === uri)
    ) {
      deletePersistedImage(uri);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialState = stateRef.current;
    const generation = generationRef.current;

    const hydrate = async () => {
      try {
        const loadedState = await loadAppState();
        if (
          !isMounted ||
          generation !== generationRef.current ||
          stateRef.current !== initialState
        ) {
          return;
        }
        stateRef.current = loadedState;
        setState(loadedState);
      } catch (error) {
        console.warn("[quotd-hydrate]", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
      generationRef.current += 1;
    };
  }, []);

  const commit = useCallback(
    (update: (current: PersistedAppState) => PersistedAppState) => {
      const nextState = update(stateRef.current);
      saveAppState(nextState);
      stateRef.current = nextState;
      setState(nextState);
    },
    []
  );

  const addQuote = useCallback(
    async (input: NewQuoteInput) => {
      const id = createLocalId();
      const generation = generationRef.current;
      let imageUri: string | null = null;

      try {
        imageUri = input.imageUri
          ? await persistImage(input.imageUri, "quote", id)
          : null;
        if (generation !== generationRef.current) {
          throw new Error("Quote creation cancelled");
        }
        const quote: QuoteRecord = {
          id,
          text: input.text.trim(),
          speaker: input.speaker.trim(),
          imageUri,
          createdAt: Date.now(),
        };

        commit((current) => ({
          ...current,
          quotes: [quote, ...current.quotes],
          speakers: ensureSpeakerProfiles(current.speakers, [quote]),
        }));
        return quote;
      } catch (error) {
        deleteUnusedImage(imageUri);
        throw error;
      }
    },
    [commit, deleteUnusedImage]
  );

  const updateQuote = useCallback(
    (id: string, updates: Pick<QuoteRecord, "text" | "speaker">) => {
      const currentQuote = stateRef.current.quotes.find(
        (quote) => quote.id === id
      );
      if (!currentQuote) {
        throw new Error("Quote not found");
      }

      const updated: QuoteRecord = {
        ...currentQuote,
        text: updates.text.trim(),
        speaker: updates.speaker.trim(),
        updatedAt: Date.now(),
      };

      commit((current) => ({
        ...current,
        speakers: ensureSpeakerProfiles(current.speakers, [updated]),
        quotes: current.quotes.map((quote) =>
          quote.id === id ? updated : quote
        ),
      }));
      return updated;
    },
    [commit]
  );

  const deleteQuote = useCallback(
    (id: string) => {
      const quote = stateRef.current.quotes.find((item) => item.id === id);
      if (!quote) {
        return;
      }

      commit((current) => ({
        ...current,
        quotes: current.quotes.filter((item) => item.id !== id),
      }));
      deleteUnusedImage(quote.imageUri);
    },
    [commit, deleteUnusedImage]
  );

  const renameSpeaker = useCallback(
    (id: string, name: string) => {
      commit((current) => renameSpeakerInState(current, id, name));
    },
    [commit]
  );

  const setSpeakerAvatarFromUri = useCallback(
    async (id: string, uri: string) => {
      if (!stateRef.current.speakers.some((speaker) => speaker.id === id)) {
        throw new Error("Speaker not found");
      }
      const request = Symbol("speaker-avatar");
      const generation = generationRef.current;
      speakerAvatarRequests.current.set(id, request);
      let nextAvatar: string | null = null;
      try {
        nextAvatar = await persistImage(uri, "avatar", createLocalId());
        const speaker = stateRef.current.speakers.find(
          (item) => item.id === id
        );
        if (
          generation !== generationRef.current ||
          speakerAvatarRequests.current.get(id) !== request ||
          !speaker
        ) {
          deleteUnusedImage(nextAvatar);
          return;
        }
        const oldAvatar = speaker.avatarUri;
        commit((current) => ({
          ...current,
          speakers: current.speakers.map((item) =>
            item.id === id ? { ...item, avatarUri: nextAvatar } : item
          ),
        }));
        deleteUnusedImage(oldAvatar);
      } catch (error) {
        deleteUnusedImage(nextAvatar);
        throw error;
      } finally {
        if (speakerAvatarRequests.current.get(id) === request) {
          speakerAvatarRequests.current.delete(id);
        }
      }
    },
    [commit, deleteUnusedImage]
  );

  const removeSpeakerAvatar = useCallback(
    (id: string) => {
      const speaker = stateRef.current.speakers.find((item) => item.id === id);
      if (!speaker) {
        throw new Error("Speaker not found");
      }
      speakerAvatarRequests.current.delete(id);
      commit((current) => ({
        ...current,
        speakers: current.speakers.map((item) =>
          item.id === id ? { ...item, avatarUri: null } : item
        ),
      }));
      deleteUnusedImage(speaker.avatarUri);
    },
    [commit, deleteUnusedImage]
  );

  const setDisplayName = useCallback(
    (displayName: string) => {
      commit((current) => ({
        ...current,
        profile: { ...current.profile, displayName: displayName.trim() },
      }));
    },
    [commit]
  );

  const setAvatarFromUri = useCallback(
    async (uri: string) => {
      const request = Symbol("profile-avatar");
      profileAvatarRequest.current = request;
      const generation = generationRef.current;
      let nextAvatar: string | null = null;
      try {
        nextAvatar = await persistImage(uri, "avatar", createLocalId());
        if (
          generation !== generationRef.current ||
          profileAvatarRequest.current !== request
        ) {
          deleteUnusedImage(nextAvatar);
          return;
        }
        const oldAvatar = stateRef.current.profile.avatarUri;
        commit((current) => ({
          ...current,
          profile: { ...current.profile, avatarUri: nextAvatar },
        }));
        deleteUnusedImage(oldAvatar);
      } catch (error) {
        deleteUnusedImage(nextAvatar);
        throw error;
      }
    },
    [commit, deleteUnusedImage]
  );

  const removeAvatar = useCallback(() => {
    profileAvatarRequest.current = null;
    const oldAvatar = stateRef.current.profile.avatarUri;
    commit((current) => ({
      ...current,
      profile: { ...current.profile, avatarUri: null },
    }));
    deleteUnusedImage(oldAvatar);
  }, [commit, deleteUnusedImage]);

  const setThemePreference = useCallback(
    (themePreference: ThemePreference) => {
      commit((current) => ({ ...current, themePreference }));
    },
    [commit]
  );

  const clearAllData = useCallback(() => {
    const initialState = createInitialState();
    generationRef.current += 1;
    speakerAvatarRequests.current.clear();
    profileAvatarRequest.current = null;
    resetStorage(initialState);
    stateRef.current = initialState;
    setState(initialState);
  }, []);

  const resolvedTheme = resolveTheme(state.themePreference, systemTheme);
  const palette = PALETTES[resolvedTheme];

  const value = useMemo<AppContextValue>(
    () => ({
      isLoading,
      quotes: state.quotes,
      speakers: state.speakers,
      renameSpeaker,
      setSpeakerAvatarFromUri,
      removeSpeakerAvatar,
      profile: state.profile,
      themePreference: state.themePreference,
      resolvedTheme,
      palette,
      addQuote,
      updateQuote,
      deleteQuote,
      setDisplayName,
      setAvatarFromUri,
      removeAvatar,
      setThemePreference,
      clearAllData,
    }),
    [
      addQuote,
      clearAllData,
      deleteQuote,
      isLoading,
      palette,
      removeAvatar,
      renameSpeaker,
      setSpeakerAvatarFromUri,
      removeSpeakerAvatar,
      state.speakers,
      resolvedTheme,
      setAvatarFromUri,
      setDisplayName,
      setThemePreference,
      state.profile,
      state.quotes,
      state.themePreference,
      updateQuote,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
