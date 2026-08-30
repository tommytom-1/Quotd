import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { normalizeSpeakerProfiles } from "@/lib/speaker-utils";
import type {
  PersistedAppState,
  QuoteRecord,
  ThemePreference,
} from "@/lib/types";

const ROOT_DIRECTORY = new Directory(Paths.document, "quotd");
const IMAGE_DIRECTORY = new Directory(ROOT_DIRECTORY, "images");
const STATE_FILE = new File(ROOT_DIRECTORY, "state.json");
const BACKUP_STATE_FILE = new File(ROOT_DIRECTORY, "state.backup.json");
const VALID_THEMES = new Set<ThemePreference>(["system", "light", "dark"]);

export function createInitialState(): PersistedAppState {
  return {
    version: 1,
    quotes: [],
    speakers: [],
    profile: {
      displayName: "",
      avatarUri: null,
    },
    themePreference: "system",
  };
}

function ensureStorageDirectories() {
  ROOT_DIRECTORY.create({ idempotent: true, intermediates: true });
  IMAGE_DIRECTORY.create({ idempotent: true, intermediates: true });
}

function isQuoteRecord(value: unknown): value is QuoteRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const quote = value as Partial<QuoteRecord>;
  return (
    typeof quote.id === "string" &&
    typeof quote.text === "string" &&
    typeof quote.speaker === "string" &&
    (quote.imageUri === null || typeof quote.imageUri === "string") &&
    typeof quote.createdAt === "number" &&
    (quote.updatedAt === undefined || typeof quote.updatedAt === "number")
  );
}

function resolveImageUri(uri: string | null) {
  if (!uri) {
    return null;
  }

  if (uri.startsWith("images/")) {
    return new File(ROOT_DIRECTORY, uri).uri;
  }

  // iOS can relocate an app's container. Recover older absolute paths by
  // rebuilding them from the current document directory.
  if (uri.includes("/quotd/images/")) {
    return new File(IMAGE_DIRECTORY, Paths.basename(uri)).uri;
  }

  return uri;
}

function normalizeState(value: unknown): PersistedAppState {
  const fallback = createInitialState();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<PersistedAppState>;
  const quotes = Array.isArray(candidate.quotes)
    ? candidate.quotes.filter(isQuoteRecord).map((quote) => ({
        ...quote,
        imageUri: resolveImageUri(quote.imageUri),
      }))
    : [];
  const displayName =
    candidate.profile && typeof candidate.profile.displayName === "string"
      ? candidate.profile.displayName
      : "";
  const storedAvatar =
    candidate.profile && typeof candidate.profile.avatarUri === "string"
      ? candidate.profile.avatarUri
      : null;
  const themePreference = VALID_THEMES.has(
    candidate.themePreference as ThemePreference
  )
    ? (candidate.themePreference as ThemePreference)
    : "system";

  return {
    version: 1,
    quotes,
    speakers: normalizeSpeakerProfiles(
      candidate.speakers,
      quotes,
      resolveImageUri
    ),
    profile: {
      displayName,
      avatarUri: resolveImageUri(storedAvatar),
    },
    themePreference,
  };
}

async function readStateFile(file: File) {
  return normalizeState(JSON.parse(await file.text()) as unknown);
}

export async function loadAppState() {
  try {
    ensureStorageDirectories();
    if (!STATE_FILE.exists) {
      return createInitialState();
    }

    try {
      return await readStateFile(STATE_FILE);
    } catch (error) {
      console.warn("[quotd-storage-load-primary]", error);
      if (BACKUP_STATE_FILE.exists) {
        return await readStateFile(BACKUP_STATE_FILE);
      }
      return createInitialState();
    }
  } catch (error) {
    console.warn("[quotd-storage-load]", error);
    return createInitialState();
  }
}

function makePortableUri(uri: string | null) {
  if (!uri) {
    return null;
  }
  if (uri.startsWith(IMAGE_DIRECTORY.uri)) {
    return `images/${Paths.basename(uri)}`;
  }
  return uri;
}

function serializeState(state: PersistedAppState): PersistedAppState {
  return {
    ...state,
    quotes: state.quotes.map((quote) => ({
      ...quote,
      imageUri: makePortableUri(quote.imageUri),
    })),
    speakers: state.speakers.map((speaker) => ({
      ...speaker,
      avatarUri: makePortableUri(speaker.avatarUri),
    })),
    profile: {
      ...state.profile,
      avatarUri: makePortableUri(state.profile.avatarUri),
    },
  };
}

export function saveAppState(state: PersistedAppState) {
  ensureStorageDirectories();
  const temporaryFile = new File(ROOT_DIRECTORY, "state.tmp.json");
  if (temporaryFile.exists) {
    temporaryFile.delete();
  }

  temporaryFile.create();
  temporaryFile.write(JSON.stringify(serializeState(state)));

  if (STATE_FILE.exists) {
    STATE_FILE.copySync(BACKUP_STATE_FILE, { overwrite: true });
  }
  temporaryFile.moveSync(STATE_FILE, { overwrite: true });
}

function safeFileExtension(uri: string) {
  const extension = Paths.extname(uri).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".heic"].includes(extension)) {
    return extension;
  }
  return ".jpg";
}

async function optimizeImage(sourceUri: string, kind: "quote" | "avatar") {
  const maxDimension = kind === "avatar" ? 800 : 1800;
  const context = ImageManipulator.manipulate(sourceUri);
  const sourceImage = await context.renderAsync();
  const largestDimension = Math.max(sourceImage.width, sourceImage.height);

  if (largestDimension > maxDimension) {
    const resize =
      sourceImage.width >= sourceImage.height
        ? { height: null, width: maxDimension }
        : { height: maxDimension, width: null };
    context.resize(resize);
  }

  const renderedImage =
    largestDimension > maxDimension ? await context.renderAsync() : sourceImage;
  return renderedImage.saveAsync({
    compress: kind === "avatar" ? 0.82 : 0.8,
    format: SaveFormat.JPEG,
  });
}

export async function persistImage(
  sourceUri: string,
  kind: "quote" | "avatar",
  id: string
) {
  ensureStorageDirectories();

  if (sourceUri.startsWith(IMAGE_DIRECTORY.uri)) {
    return sourceUri;
  }

  let copySourceUri = sourceUri;
  let extension = safeFileExtension(sourceUri);
  let optimizedFile: File | null = null;
  try {
    const optimized = await optimizeImage(sourceUri, kind);
    copySourceUri = optimized.uri;
    extension = ".jpg";
    optimizedFile = new File(optimized.uri);
  } catch (error) {
    console.warn("[quotd-image-optimize]", error);
  }

  // A reset may have removed these directories while optimization was pending.
  ensureStorageDirectories();
  const destination = new File(IMAGE_DIRECTORY, `${kind}-${id}${extension}`);
  if (destination.exists) {
    destination.delete();
  }

  try {
    await new File(copySourceUri).copy(destination);
    return destination.uri;
  } catch (error) {
    deletePersistedImage(destination.uri);
    throw error;
  } finally {
    if (optimizedFile?.exists) {
      optimizedFile.delete();
    }
  }
}

export function deletePersistedImage(uri: string | null) {
  if (!uri || !uri.startsWith(IMAGE_DIRECTORY.uri)) {
    return;
  }

  try {
    const image = new File(uri);
    if (image.exists) {
      image.delete();
    }
  } catch (error) {
    console.warn("[quotd-storage-delete-image]", error);
  }
}

export function resetStorage(state: PersistedAppState) {
  if (ROOT_DIRECTORY.exists) {
    ROOT_DIRECTORY.delete();
  }
  saveAppState(state);
}

export function createLocalId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
