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

/** The camera's photos are 4:3; portrait, they are this wide for their height. */
const SENSOR_RATIO = 3 / 4;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lays out a camera viewfinder so that what is framed is what is kept. The
 * preview shows the whole photo, as large as fits, and the guide marks the
 * part of it a polaroid shows: the full width, and a band from the middle.
 */
export function viewfinderLayout(frame: { width: number; height: number }) {
  const width = Math.min(frame.width, frame.height * SENSOR_RATIO);
  const height = width / SENSOR_RATIO;
  const preview: Rect = {
    x: (frame.width - width) / 2,
    y: (frame.height - height) / 2,
    width,
    height,
  };
  const { photoWidth, photoHeight } = polaroidMetrics(1);
  const guideHeight = (width / photoWidth) * photoHeight;
  const guide: Rect = {
    x: 0,
    y: (height - guideHeight) / 2,
    width,
    height: guideHeight,
  };
  return { guide, preview };
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
    radius: width * 0.075,
    // Concentric with the card, so the border around the photo stays even.
    photoRadius: width * 0.075 - padding,
    step: height * STACK_STEP,
  };
}

export interface QuoteTypography {
  fontSize: number;
  lineHeight: number;
  /** Lines shown on the wall. The focused polaroid shows every line. */
  maxLines: number;
}

export function quoteTypography(text: string, width: number): QuoteTypography {
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
  const fontSize = width * ratio;
  return { fontSize, lineHeight: fontSize * 1.22, maxLines };
}

export function speakerTypography(width: number) {
  const fontSize = width * 0.045;
  return { fontSize, lineHeight: fontSize * 1.25 };
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
  const speaker = speakerTypography(metrics.width);
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
  const speaker = speakerTypography(metrics.width);
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

interface Frame {
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

/** Share of a polaroid's height between two polaroids in a person's column. */
const COLUMN_STEP = 0.92;
/** Polaroids left peeking out from behind the front of a pile. */
export const PILE_DEPTH = 3;

export function columnMetrics(width: number) {
  return {
    /** Distance between the tops of two polaroids in a column. */
    step: polaroidMetrics(width).height * COLUMN_STEP,
    /** Strip of a piled polaroid that shows above the one in front of it. */
    peek: width * 0.085,
  };
}

/**
 * A polaroid reaching the top of its column stops there, and the following ones
 * pile onto it. Returns the offset from its scrolled position in the list, and
 * the 0–1 strength of its shadow.
 */
export function pilePose(
  scrollY: number,
  index: number,
  step: number,
  peek: number
) {
  "worklet";
  const piled = Math.max(0, scrollY / step);
  // The pile grows downwards until it shows PILE_DEPTH polaroids behind its front.
  const lift = peek * Math.min(piled, PILE_DEPTH);
  const depth = piled - index;
  if (depth <= 0) {
    return { opacity: 1, shadow: 1, translateY: lift };
  }
  return {
    // Once squarely behind the pile, a polaroid fades out as the next one lands.
    opacity: 1 - Math.min(1, Math.max(0, depth - PILE_DEPTH)),
    // A covered polaroid stops casting its own shadow, or the pile's would add up.
    shadow: 1 - Math.min(1, depth),
    translateY:
      lift - peek * Math.min(depth, PILE_DEPTH) + scrollY - index * step,
  };
}
