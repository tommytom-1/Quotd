import type { QuoteAlign, QuoteFont } from "./types";

/** Share of a polaroid's height that stays visible above the next one. */
const STACK_STEP = 0.44;
/** Scroll distance, in stack steps, after which a leaving polaroid is gone. */
export const EXIT_END = 1.3;

export interface PolaroidMetrics {
  width: number;
  height: number;
  padding: number;
  photoWidth: number;
  photoHeight: number;
  captionTop: number;
  captionHeight: number;
  captionInset: number;
  /** Corner radius of the card, and of the photo set inside it. */
  radius: number;
  photoRadius: number;
  /** Distance between the tops of two stacked polaroids. */
  step: number;
}

/**
 * The camera takes 16:9 photos, so held upright they are this wide for their
 * height. 16:9 keeps the sensor's full width and trims its top and bottom, so a
 * polaroid's crop from the middle is the same as it would be from a 4:3 photo.
 */
const SENSOR_RATIO = 9 / 16;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lays out a camera viewfinder so that what is framed is what is kept. The card
 * holds the whole photo with `inset` all round, as large as fits in `area`, so
 * the live picture fills it. The guide marks the part of the photo a polaroid
 * shows: the full width, and a band from the middle, rounded like its photo.
 */
export function viewfinderLayout(
  area: { width: number; height: number },
  inset = 0
) {
  const width = Math.min(
    area.width - inset * 2,
    (area.height - inset * 2) * SENSOR_RATIO
  );
  const height = width / SENSOR_RATIO;
  const card = { width: width + inset * 2, height: height + inset * 2 };
  const preview: Rect = { x: inset, y: inset, width, height };
  const { photoWidth, photoHeight, photoRadius } = polaroidMetrics(1);
  const guideHeight = (width / photoWidth) * photoHeight;
  const guide: Rect & { radius: number } = {
    x: 0,
    y: (height - guideHeight) / 2,
    width,
    height: guideHeight,
    radius: (width / photoWidth) * photoRadius,
  };
  return { card, guide, preview };
}

/** Every measure derives from the width, so a polaroid scales uniformly. */
export function polaroidMetrics(width: number): PolaroidMetrics {
  const padding = width * 0.045;
  const photoWidth = width - padding * 2;
  const photoHeight = photoWidth * 1.03;
  const captionHeight = width * 0.33;
  const height = padding + photoHeight + captionHeight;
  return {
    width,
    height,
    padding,
    photoWidth,
    photoHeight,
    captionTop: padding + photoHeight,
    captionHeight,
    captionInset: width * 0.07,
    // Cut paper: barely eased corners, and a photo that is all but square.
    radius: width * 0.012,
    photoRadius: width * 0.004,
    step: height * STACK_STEP,
  };
}

export interface QuoteTypography {
  fontSize: number;
  lineHeight: number;
  /** Lines shown on the wall. The focused polaroid shows every line. */
  maxLines: number;
  /** How much larger the hand is written to read as large as type. */
  scale: number;
}

/** The lettering a caption is set in: a handwriting, or a typeface. */
export interface Hand {
  fontFamily: string;
  /** What the lettering is called where one is chosen. */
  label: string;
  letterSpacing?: number;
  /** Lettering sits at different sizes in its em square; this evens it out. */
  scale: number;
  /** Written by hand: the ink bleeds a little and the lines lean. */
  written?: boolean;
}

/** Every lettering a caption can be set in, in the order they are offered. */
export const HANDS: Record<QuoteFont, Hand> = {
  mynerve: { fontFamily: "Mynerve", label: "Marker", scale: 1, written: true },
  caveat: { fontFamily: "Caveat", label: "Pen", scale: 1.3, written: true },
  shadows: {
    fontFamily: "ShadowsIntoLight",
    label: "Neat",
    scale: 1.12,
    written: true,
  },
  fraunces: {
    fontFamily: "Fraunces",
    label: "Classic",
    letterSpacing: -0.2,
    scale: 1,
  },
  instrumentSerif: {
    fontFamily: "InstrumentSerif",
    label: "Editorial",
    scale: 1.18,
  },
  dmSans: {
    fontFamily: "DMSans",
    label: "Clean",
    letterSpacing: -0.2,
    scale: 1,
  },
  plexMono: {
    fontFamily: "IBMPlexMono",
    label: "Typed",
    letterSpacing: -0.4,
    scale: 0.86,
  },
};

export const DEFAULT_FONT: QuoteFont = "mynerve";
export const DEFAULT_ALIGN: QuoteAlign = "center";

/** A quote's lettering; the default for one saved without, or with one since removed. */
export function handFor(font?: QuoteFont): Hand {
  return (font && HANDS[font]) || HANDS[DEFAULT_FONT];
}

export interface WearLayer {
  index: number;
  flipX: boolean;
  flipY: boolean;
}

/**
 * How a polaroid's paper has worn. Its edges and its marks are drawn from
 * separate sets and each turned its own way, and the marks are enlarged and
 * slid about, so that no two polaroids on a wall carry the same wear.
 */
export function paperWear(id: string, edgeCount: number, markCount: number) {
  const pick = (salt: string) => hashString(`${id}:${salt}`);
  const layer = (salt: string, count: number): WearLayer => {
    const hash = pick(salt);
    return {
      flipX: Math.floor(hash / count) % 2 === 1,
      flipY: Math.floor(hash / count / 2) % 2 === 1,
      index: hash % count,
    };
  };
  const unit = (salt: string) => (pick(salt) % 1000) / 1000;
  const scale = 1.1 + unit("scale") * 0.35;
  return {
    edges: layer("edges", edgeCount),
    marks: {
      ...layer("marks", markCount),
      scale,
      // As shares of the paper's size, kept within what the enlargement hides.
      shiftX: (unit("x") - 0.5) * (scale - 1),
      shiftY: (unit("y") - 0.5) * (scale - 1),
    },
  };
}

/** Degrees a caption leans, as writing by hand never sits quite level. */
export function captionTilt(id: string) {
  return ((hashString(`${id}:caption`) % 100) / 100 - 0.5) * 2.4;
}

export function quoteTypography(
  text: string,
  width: number,
  hand?: Hand
): QuoteTypography {
  let ratio = 0.074;
  let maxLines = 2;
  if (text.length > 110) {
    ratio = 0.042;
    maxLines = 4;
  } else if (text.length > 48) {
    ratio = 0.05;
    maxLines = 4;
  } else if (text.length > 20) {
    ratio = 0.06;
    maxLines = 3;
  }
  const scale = hand?.scale ?? 1;
  const fontSize = width * ratio * scale;
  // The lines keep the room they had in type, however the hand is scaled.
  return { fontSize, lineHeight: width * ratio * 1.22, maxLines, scale };
}

export function speakerTypography(width: number, scale = 1) {
  const fontSize = width * 0.045;
  return { fontSize: fontSize * scale, lineHeight: fontSize * 1.25 };
}

/**
 * The wall centers up to `maxLines` lines and the speaker's line in the
 * caption. The focused polaroid keeps those lines exactly there and lets the
 * remaining text run below, pushing the speaker down with it.
 */
export function captionTopPadding(
  metrics: PolaroidMetrics,
  typography: QuoteTypography,
  lineCount: number
) {
  const lines = Math.min(Math.max(lineCount, 1), typography.maxLines);
  const speaker = speakerTypography(metrics.width, typography.scale);
  return Math.max(
    0,
    (metrics.captionHeight -
      lines * typography.lineHeight -
      speaker.lineHeight) /
      2
  );
}

/** Height of a focused polaroid once the full quote and its speaker fit. */
export function expandedHeight(
  metrics: PolaroidMetrics,
  typography: QuoteTypography,
  quoteHeight: number
) {
  const lineCount = Math.round(quoteHeight / typography.lineHeight);
  const speaker = speakerTypography(metrics.width, typography.scale);
  return Math.max(
    metrics.height,
    metrics.captionTop +
      captionTopPadding(metrics, typography, lineCount) +
      quoteHeight +
      speaker.lineHeight +
      metrics.width * 0.1
  );
}

interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What is written around each caption on the polaroid. */
const CAPTION_MARKS = {
  speaker: ["- ", ""],
  text: ["\u201C", "\u201D"],
} as const;

export type CaptionField = keyof typeof CAPTION_MARKS;

export function writeCaption(field: CaptionField, value: string) {
  const [open, close] = CAPTION_MARKS[field];
  return `${open}${value}${close}`;
}

/** The value a caption holds, whether or not its marks survived an edit. */
export function readCaption(field: CaptionField, caption: string) {
  const [open, close] = CAPTION_MARKS[field];
  let value = caption.trim();
  if (value.startsWith(open.trim())) {
    value = value.slice(open.trim().length);
  }
  if (close && value.endsWith(close)) {
    value = value.slice(0, -close.length);
  }
  return value.trim();
}

/** First and last caret positions that sit inside a caption's marks. */
export function captionCaretRange(field: CaptionField, caption: string) {
  const [open, close] = CAPTION_MARKS[field];
  return [open.length, caption.length - close.length] as const;
}

/**
 * Where the caret lands in `text` for a tap on its laid-out lines. Like the
 * system, a tap inside a word picks the nearer end of that word.
 */
export function caretIndexAt(
  text: string,
  lines: readonly TextLine[],
  point: { x: number; y: number }
) {
  let index = text.length;
  let lineStart = 0;
  for (const [position, line] of lines.entries()) {
    if (point.y < line.y + line.height || position === lines.length - 1) {
      const along = line.width > 0 ? (point.x - line.x) / line.width : 1;
      index =
        lineStart +
        Math.round(Math.min(1, Math.max(0, along)) * line.text.length);
      break;
    }
    lineStart += line.text.length;
  }
  index = Math.min(text.length, Math.max(0, index));

  const isBoundary = (at: number) =>
    at <= 0 ||
    at >= text.length ||
    /\s/u.test(text[at - 1]) !== /\s/u.test(text[at]);
  for (let distance = 0; ; distance += 1) {
    if (isBoundary(index - distance)) {
      return Math.max(0, index - distance);
    }
    if (isBoundary(index + distance)) {
      return Math.min(text.length, index + distance);
    }
  }
}

function hashString(value: string) {
  let hash = 17;
  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return hash;
}

/**
 * Each polaroid is pinned slightly askew. The tilt and sideways nudge come from
 * the quote ID, so the wall looks the same on every launch.
 */
export function polaroidPlacement(id: string, width: number) {
  const hash = hashString(id);
  const direction = hash % 2 === 0 ? 1 : -1;
  return {
    tilt: direction * (1.2 + (Math.floor(hash / 2) % 100) / 55),
    offsetX: (((Math.floor(hash / 256) % 100) - 50) / 50) * width * 0.035,
  };
}

/** 0 while a polaroid is at or below the top slot, growing as it scrolls past. */
export function exitProgress(scrollY: number, index: number, step: number) {
  "worklet";
  return Math.min(EXIT_END, Math.max(0, (scrollY - index * step) / step));
}

export interface PolaroidPose {
  translateX: number;
  translateY: number;
  scale: number;
  /** Degrees. */
  rotate: number;
  /** 0–1 strength of the blur and of the white wash. */
  haze: number;
  opacity: number;
}

/**
 * A polaroid leaving the top lifts off the wall towards the viewer: it grows,
 * turns further along its tilt, and goes out of focus into the light.
 */
export function exitPose(
  progress: number,
  tilt: number,
  metrics: PolaroidMetrics
): PolaroidPose {
  "worklet";
  const direction = tilt < 0 ? -1 : 1;
  return {
    translateX: direction * metrics.width * 0.3 * progress ** 3,
    translateY: -metrics.step * (0.35 * progress + 1.6 * progress ** 4),
    scale: 1 + 0.3 * progress,
    rotate: tilt + direction * 9 * progress,
    haze: Math.min(1, progress),
    opacity: Math.min(
      1,
      Math.max(0, (EXIT_END - progress) / (EXIT_END - 0.75))
    ),
  };
}

export interface FocusTransform {
  translateX: number;
  translateY: number;
  scale: number;
  rotate: number;
}

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Transform that makes the focused polaroid (laid out at `target`) sit exactly
 * over a wall polaroid whose untransformed frame is `source`.
 */
export function focusOrigin(
  source: Frame,
  pose: PolaroidPose,
  target: Frame
): FocusTransform {
  return {
    translateX:
      source.x +
      source.width / 2 +
      pose.translateX -
      (target.x + target.width / 2),
    translateY:
      source.y +
      source.height / 2 +
      pose.translateY -
      (target.y + target.height / 2),
    scale: (source.width * pose.scale) / target.width,
    rotate: pose.rotate,
  };
}

export function mix(from: number, to: number, progress: number) {
  "worklet";
  return from + (to - from) * progress;
}

export function progressBetween(progress: number, start: number, end: number) {
  "worklet";
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}
