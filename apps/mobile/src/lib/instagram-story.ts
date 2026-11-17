import { InstagramStories } from "../../modules/instagram-stories";

/**
 * Quotd's Facebook App ID. Instagram only opens its story editor for apps
 * that name one; it is public and needs no review.
 */
const INSTAGRAM_APP_ID = "2199526684313020";
/** A story's full-screen size, in pixels. */
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/** Whether Instagram is installed and Quotd can open its stories. */
export async function canShareToInstagramStory() {
  if (!InstagramStories) {
    return false;
  }
  try {
    return await InstagramStories.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Opens Instagram's story editor with the polaroid lying on its own photo,
 * blown up and blurred to fill the screen. A quote without a photo gets a
 * paper-coloured gradient instead. Resolves false if Instagram did not open.
 */
export async function shareToInstagramStory({
  photoUri,
  polaroidUri,
}: {
  photoUri: string | null;
  polaroidUri: string;
}) {
  if (!InstagramStories) {
    return false;
  }
  let backgroundUri: string | null = null;
  if (photoUri) {
    try {
      backgroundUri = await InstagramStories.makeBackground(
        photoUri,
        STORY_WIDTH,
        STORY_HEIGHT
      );
    } catch (error) {
      // The story still opens, on a plain gradient.
      console.warn("[quotd-story-background]", error);
    }
  }
  return InstagramStories.share({
    appId: INSTAGRAM_APP_ID,
    backgroundUri,
    // Captures come back as bare paths; the native side expects URLs.
    stickerUri: polaroidUri.startsWith("/")
      ? `file://${polaroidUri}`
      : polaroidUri,
  });
}
