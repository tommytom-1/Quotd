import { describe, expect, test } from "bun:test";

import {
  captionCaretRange,
  captionTopPadding,
  caretIndexAt,
  EXIT_END,
  exitPose,
  exitProgress,
  expandedHeight,
  focusOrigin,
  polaroidMetrics,
  polaroidPlacement,
  quoteTypography,
  speakerTypography,
  readCaption,
  viewfinderLayout,
  writeCaption,
} from "../src/lib/polaroid.ts";

const metrics = polaroidMetrics(260);

describe("polaroid layout", () => {
  test("scales uniformly with its width", () => {
    const large = polaroidMetrics(390);
    for (const key of Object.keys(metrics)) {
      expect(large[key] / metrics[key]).toBeCloseTo(1.5, 10);
    }
  });

  test("stacks so the caption of the next polaroid stays visible", () => {
    expect(metrics.step).toBeGreaterThan(metrics.captionHeight);
    expect(metrics.step).toBeLessThan(metrics.height);
  });

  test("fits every wall line count and the speaker inside the caption", () => {
    const speaker = speakerTypography(metrics.width);
    for (const length of [5, 20, 21, 48, 49, 110, 111, 500]) {
      const typography = quoteTypography("x".repeat(length), metrics.width);
      expect(
        typography.maxLines * typography.lineHeight + speaker.lineHeight
      ).toBeLessThan(metrics.captionHeight * 0.92);
    }
  });

  test("keeps the wall lines where they were when the caption grows", () => {
    const typography = quoteTypography("x".repeat(200), metrics.width);
    const clamped = captionTopPadding(metrics, typography, typography.maxLines);
    expect(captionTopPadding(metrics, typography, 12)).toBe(clamped);
    expect(clamped).toBeCloseTo(
      (metrics.captionHeight -
        typography.maxLines * typography.lineHeight -
        speakerTypography(metrics.width).lineHeight) /
        2
    );
  });

  test("grows for the speaker and never shrinks below the wall height", () => {
    const typography = quoteTypography("Short", metrics.width);
    const oneLine = expandedHeight(metrics, typography, typography.lineHeight);
    const tenLines = expandedHeight(
      metrics,
      typography,
      typography.lineHeight * 10
    );
    expect(oneLine).toBeGreaterThan(metrics.height);
    expect(tenLines - oneLine).toBeGreaterThan(typography.lineHeight * 7);
  });

  test("places a quote the same way every time", () => {
    const first = polaroidPlacement("quote-1", 260);
    expect(polaroidPlacement("quote-1", 260)).toEqual(first);
    for (const id of ["a", "b", "quote-1", "quote-2", "0193f"]) {
      const { tilt, offsetX } = polaroidPlacement(id, 260);
      expect(Math.abs(tilt)).toBeGreaterThanOrEqual(1.2);
      expect(Math.abs(tilt)).toBeLessThanOrEqual(3.1);
      expect(Math.abs(offsetX)).toBeLessThanOrEqual(260 * 0.035);
    }
  });
});

describe("polaroid exit", () => {
  test("rests until the polaroid passes the top slot", () => {
    expect(exitProgress(-80, 0, metrics.step)).toBe(0);
    expect(exitProgress(metrics.step * 2, 2, metrics.step)).toBe(0);
    expect(exitProgress(metrics.step * 2.5, 2, metrics.step)).toBeCloseTo(0.5);
    expect(exitProgress(metrics.step * 50, 2, metrics.step)).toBe(EXIT_END);
  });

  test("a resting polaroid only has its tilt", () => {
    expect(exitPose(0, -2, metrics)).toEqual({
      haze: 0,
      opacity: 1,
      rotate: -2,
      scale: 1,
      translateX: -0,
      translateY: -0,
    });
  });

  test("lifts, grows, turns along its tilt and fades out", () => {
    let previous = exitPose(0, 2, metrics);
    for (let progress = 0.1; progress <= EXIT_END; progress += 0.1) {
      const pose = exitPose(progress, 2, metrics);
      expect(pose.translateY).toBeLessThan(previous.translateY);
      expect(pose.scale).toBeGreaterThan(previous.scale);
      expect(pose.rotate).toBeGreaterThan(previous.rotate);
      expect(pose.haze).toBeGreaterThanOrEqual(previous.haze);
      expect(pose.opacity).toBeLessThanOrEqual(previous.opacity);
      previous = pose;
    }
    expect(exitPose(EXIT_END, 2, metrics).opacity).toBe(0);
    expect(exitPose(1, -2, metrics).rotate).toBeLessThan(-2);
    expect(exitPose(1, -2, metrics).translateX).toBeLessThan(0);
  });
});

describe("focus transition", () => {
  const target = { height: 480, width: 370, x: 10, y: 170 };

  test("starts exactly over the wall polaroid", () => {
    const source = { height: 340, width: 260, x: 70, y: 130 };
    const pose = exitPose(0.4, 2, metrics);
    const from = focusOrigin(source, pose, target);
    const centerX = target.x + target.width / 2 + from.translateX;
    const centerY = target.y + target.height / 2 + from.translateY;
    expect(centerX).toBeCloseTo(source.x + source.width / 2 + pose.translateX);
    expect(centerY).toBeCloseTo(source.y + source.height / 2 + pose.translateY);
    expect(target.width * from.scale).toBeCloseTo(source.width * pose.scale);
    expect(from.rotate).toBe(pose.rotate);
  });
});

describe("captions", () => {
  test("round-trip through their marks", () => {
    expect(writeCaption("text", "so it goes")).toBe("\u201Cso it goes\u201D");
    expect(writeCaption("speaker", "Kurt")).toBe("- Kurt");
    expect(readCaption("text", "\u201Cso it goes\u201D")).toBe("so it goes");
    expect(readCaption("speaker", "- Kurt")).toBe("Kurt");
    expect(readCaption("text", writeCaption("text", 'he said "no"'))).toBe(
      'he said "no"'
    );
  });

  test("read back when an edit removed their marks", () => {
    expect(readCaption("text", "so it goes\u201D")).toBe("so it goes");
    expect(readCaption("text", "\u201Cso it goes ")).toBe("so it goes");
    expect(readCaption("text", "\u201C")).toBe("");
    expect(readCaption("speaker", "-Kurt")).toBe("Kurt");
    expect(readCaption("speaker", "Kurt ")).toBe("Kurt");
  });

  test("keep the caret inside their marks", () => {
    expect(captionCaretRange("text", '"hi"')).toEqual([1, 3]);
    expect(captionCaretRange("speaker", "- Kurt")).toEqual([2, 6]);
  });
});

describe("caret placement", () => {
  const text = "hello big world";
  const lines = [
    { height: 20, text: "hello big ", width: 100, x: 10, y: 0 },
    { height: 20, text: "world", width: 50, x: 35, y: 20 },
  ];

  test("snaps a tap to the nearer end of the tapped word", () => {
    expect(caretIndexAt(text, lines, { x: 22, y: 10 })).toBe(0);
    expect(caretIndexAt(text, lines, { x: 48, y: 10 })).toBe(5);
    expect(caretIndexAt(text, lines, { x: 82, y: 10 })).toBe(6);
  });

  test("follows the tap onto later lines", () => {
    expect(caretIndexAt(text, lines, { x: 40, y: 30 })).toBe(10);
    expect(caretIndexAt(text, lines, { x: 80, y: 30 })).toBe(15);
  });

  test("stays inside the text for taps around it", () => {
    expect(caretIndexAt(text, lines, { x: -40, y: -10 })).toBe(0);
    expect(caretIndexAt(text, lines, { x: 400, y: 90 })).toBe(15);
    expect(caretIndexAt(text, [], { x: 10, y: 10 })).toBe(15);
  });
});

describe("camera viewfinder", () => {
  const photoRatio = metrics.photoHeight / metrics.photoWidth;

  test("fills the card with the whole 16:9 photo, as large as fits", () => {
    for (const area of [
      { width: 378, height: 702 },
      { width: 378, height: 600 },
      { width: 700, height: 500 },
    ]) {
      const { card, preview } = viewfinderLayout(area);
      expect(preview.height / preview.width).toBeCloseTo(16 / 9);
      expect(card).toEqual({ width: preview.width, height: preview.height });
      expect(card.width).toBeLessThanOrEqual(area.width + 1e-9);
      expect(card.height).toBeLessThanOrEqual(area.height + 1e-9);
      expect(
        Math.abs(card.width - area.width) < 1e-9 ||
          Math.abs(card.height - area.height) < 1e-9
      ).toBe(true);
    }
  });

  test("keeps the inset all round the photo", () => {
    const { card, preview } = viewfinderLayout({ width: 378, height: 702 }, 10);
    expect(preview.x).toBe(10);
    expect(preview.y).toBe(10);
    expect(card.width).toBeCloseTo(preview.width + 20);
    expect(card.height).toBeCloseTo(preview.height + 20);
    expect(preview.height / preview.width).toBeCloseTo(16 / 9);
  });

  test("guides the polaroid's crop: full width, a centred band", () => {
    const { guide, preview } = viewfinderLayout({ width: 378, height: 702 });
    expect(guide.x).toBe(0);
    expect(guide.width).toBe(preview.width);
    expect(guide.height / guide.width).toBeCloseTo(photoRatio);
    expect(guide.y * 2 + guide.height).toBeCloseTo(preview.height);
    // Rounded like the photo on a polaroid of the same width.
    expect(guide.radius / guide.width).toBeCloseTo(
      metrics.photoRadius / metrics.photoWidth
    );
  });
});
