import { requireOptionalNativeModule } from "expo";

export interface StoryOptions {
  /** The Facebook App ID Instagram requires of apps that open its stories. */
  appId: string;
  /** The polaroid, laid on the story as a sticker the user can move. */
  stickerUri: string;
  /** A picture filling the story behind the sticker. */
  backgroundUri?: string | null;
  /** The story's gradient when there is no background picture. */
  topColor?: string;
  bottomColor?: string;
}

interface InstagramStoriesModule {
  isAvailable: () => Promise<boolean>;
  makeBackground: (
    photoUri: string,
    width: number,
    height: number
  ) => Promise<string>;
  /** Resolves false when Instagram could not be opened. */
  share: (options: StoryOptions) => Promise<boolean>;
}

/** Null where the native side is missing: on Android, and in older builds. */
export const InstagramStories =
  requireOptionalNativeModule<InstagramStoriesModule>("InstagramStories");
