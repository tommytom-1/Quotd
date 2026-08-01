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
  ThemePreference,
} from "@/lib/types";

interface AppContextValue {
  isLoading: boolean;
  quotes: QuoteRecord[];
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

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const loadedState = await loadAppState();
        if (!isMounted) {
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
      let imageUri: string | null = null;

      try {
        imageUri = input.imageUri
          ? await persistImage(input.imageUri, "quote", id)
          : null;
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
        }));
        return quote;
      } catch (error) {
        deletePersistedImage(imageUri);
        throw error;
      }
    },
    [commit]
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
      deletePersistedImage(quote.imageUri);
    },
    [commit]
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
      const oldAvatar = stateRef.current.profile.avatarUri;
      let nextAvatar: string | null = null;

      try {
        nextAvatar = await persistImage(uri, "avatar", createLocalId());
        commit((current) => ({
          ...current,
          profile: { ...current.profile, avatarUri: nextAvatar },
        }));
        deletePersistedImage(oldAvatar);
      } catch (error) {
        deletePersistedImage(nextAvatar);
        throw error;
      }
    },
    [commit]
  );

  const removeAvatar = useCallback(() => {
    const oldAvatar = stateRef.current.profile.avatarUri;
    commit((current) => ({
      ...current,
      profile: { ...current.profile, avatarUri: null },
    }));
    deletePersistedImage(oldAvatar);
  }, [commit]);

  const setThemePreference = useCallback(
    (themePreference: ThemePreference) => {
      commit((current) => ({ ...current, themePreference }));
    },
    [commit]
  );

  const clearAllData = useCallback(() => {
    const initialState = createInitialState();
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
