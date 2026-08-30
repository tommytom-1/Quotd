import { describe, expect, test } from "bun:test";

import {
  coverSize,
  coverTransform,
  fitTextScale,
  transitionOpacity,
  transitionSize,
} from "../src/lib/quote-transition.ts";

const target = { width: 360, height: 480 };
const sources = [
  { width: 390, height: 390 },
  { width: 190, height: 190 },
  { width: 190, height: 389 },
  { width: 390, height: 190 },
];
const images = [
  { width: 4032, height: 3024 },
  { width: 3024, height: 4032 },
  { width: 1000, height: 1000 },
  { width: 6000, height: 1000 },
];

describe("quote transition geometry", () => {
  test("matches the measured source and the capture size exactly", () => {
    for (const source of sources) {
      expect(transitionSize(source, target, 0)).toEqual(source);
      expect(transitionSize(source, target, 1)).toEqual(target);
    }
  });

  test("keeps every image proportional, centered and covering the clip throughout opening and closing", () => {
    for (const source of sources) {
      for (const image of images) {
        const fixedImage = coverSize(image, target);
        // The same geometry is used in reverse for dismissal, with no view swap.
        for (const progress of [
          0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 0.75, 0.5, 0.25, 0,
        ]) {
          const frame = transitionSize(source, target, progress);
          const transform = coverTransform(fixedImage, target, frame);
          const canvasX = frame.width / target.width;
          const canvasY = frame.height / target.height;
          const scaleX = transform.scaleX * canvasX;
          const scaleY = transform.scaleY * canvasY;
          const width = fixedImage.width * scaleX;
          const height = fixedImage.height * scaleY;
          const left = transform.translateX * canvasX;
          const top = transform.translateY * canvasY;

          expect(scaleX).toBeCloseTo(scaleY, 10);
          expect(width + 0.000001).toBeGreaterThanOrEqual(frame.width);
          expect(height + 0.000001).toBeGreaterThanOrEqual(frame.height);
          expect(left + width / 2).toBeCloseTo(frame.width / 2, 10);
          expect(top + height / 2).toBeCloseTo(frame.height / 2, 10);
        }
      }
    }
  });

  test("the background canvas and image transforms settle without a reset", () => {
    for (const image of images) {
      const fixedImage = coverSize(image, target);
      const transform = coverTransform(fixedImage, target, target);
      expect(transform.scaleX).toBeCloseTo(1, 10);
      expect(transform.scaleY).toBeCloseTo(1, 10);
      expect(transform.translateX).toBeCloseTo(
        (target.width - fixedImage.width) / 2,
        10
      );
      expect(transform.translateY).toBeCloseTo(
        (target.height - fixedImage.height) / 2,
        10
      );
    }
  });
});

describe("quote text crossfade", () => {
  test("keeps both fixed text layouts inside the card, even for long quotes on tall cards", () => {
    for (const source of sources) {
      for (const sourceFont of [12.5, 18, 22, 31]) {
        for (const targetFont of [13.5, 19, 31]) {
          for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
            const frame = transitionSize(source, target, progress);
            const margin = 19 + (24 - 19) * progress;
            const font = sourceFont + (targetFont - sourceFont) * progress;
            const available = frame.width - margin * 2;
            for (const [textWidth, baseFont] of [
              [source.width - 38, sourceFont],
              [target.width - 48, targetFont],
            ]) {
              const scale = fitTextScale(font / baseFont, textWidth, available);
              expect(scale * textWidth).toBeLessThanOrEqual(
                available + 0.000001
              );
              expect(scale).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  test("preserves the native font size at each visible endpoint", () => {
    expect(fitTextScale(1, 152, 152)).toBe(1);
    expect(fitTextScale(1, 312, 312)).toBe(1);
  });

  test("shows only the preview initially and only the complete quote before landing", () => {
    expect(transitionOpacity(0, 0.2, 0.8)).toBe(0);
    expect(transitionOpacity(0.2, 0.2, 0.8)).toBe(0);
    expect(transitionOpacity(0.5, 0.2, 0.8)).toBeCloseTo(0.5);
    expect(transitionOpacity(0.8, 0.2, 0.8)).toBe(1);
    expect(transitionOpacity(1, 0.2, 0.8)).toBe(1);
  });

  test("never extrapolates opacity outside its valid range", () => {
    for (const progress of [-1, 0, 0.1, 0.5, 0.9, 1, 2]) {
      const detail = transitionOpacity(progress, 0.2, 0.8);
      const preview = 1 - detail;
      expect(detail).toBeGreaterThanOrEqual(0);
      expect(detail).toBeLessThanOrEqual(1);
      expect(detail + preview).toBe(1);
    }
  });
});
