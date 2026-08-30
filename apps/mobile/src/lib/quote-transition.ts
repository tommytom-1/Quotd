export interface ArtworkSize {
  width: number;
  height: number;
}

export function transitionSize(
  source: ArtworkSize,
  target: ArtworkSize,
  progress: number
): ArtworkSize {
  "worklet";
  return {
    width: source.width + (target.width - source.width) * progress,
    height: source.height + (target.height - source.height) * progress,
  };
}

export function coverSize(
  image: ArtworkSize,
  target: ArtworkSize
): ArtworkSize {
  "worklet";
  const scale = Math.max(
    target.width / image.width,
    target.height / image.height
  );
  return { width: image.width * scale, height: image.height * scale };
}

/**
 * The background canvas scales to the card's changing aspect ratio. Counter-scale
 * the fixed-size images inside it so the photo stays proportional and centered.
 * Neither native image view needs a new layout or decode during the animation.
 */
export function coverTransform(
  image: ArtworkSize,
  canvas: ArtworkSize,
  frame: ArtworkSize
) {
  "worklet";
  const canvasScaleX = frame.width / canvas.width;
  const canvasScaleY = frame.height / canvas.height;
  const scale = Math.max(
    frame.width / image.width,
    frame.height / image.height
  );
  return {
    translateX: (frame.width - image.width * scale) / 2 / canvasScaleX,
    translateY: (frame.height - image.height * scale) / 2 / canvasScaleY,
    scaleX: scale / canvasScaleX,
    scaleY: scale / canvasScaleY,
  };
}

/** Keep fixed line layouts inside the moving clip, including narrow tall cards. */
export function fitTextScale(
  fontScale: number,
  textWidth: number,
  availableWidth: number
) {
  "worklet";
  return Math.min(fontScale, Math.max(0, availableWidth) / textWidth);
}

export function transitionOpacity(
  progress: number,
  start: number,
  end: number
) {
  "worklet";
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}
