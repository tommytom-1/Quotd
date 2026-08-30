import { describe, expect, test } from "bun:test";

import { buildQuoteMosaic } from "../src/lib/quote-grid.ts";
import {
  getUniqueSpeakers,
  rankSpeakers,
  sortNewest,
} from "../src/lib/quote-utils.ts";

const quotes = [
  { createdAt: 10, id: "older", speaker: "Ada", text: "First" },
  { createdAt: 20, id: "newer", speaker: "Grace", text: "Second" },
  { createdAt: 30, id: "newest", speaker: "Ada", text: "Third" },
];

describe("quote mosaic", () => {
  test("keeps the first quote as a full-size hero and packs every quote once", () => {
    const records = Array.from({ length: 75 }, (_, index) => ({
      createdAt: 100 - index,
      id: `quote-${index}`,
      imageUri: null,
      speaker: "Speaker",
      text: `Quote ${index}`,
    }));

    const first = buildQuoteMosaic(records);
    const second = buildQuoteMosaic(records);
    const packedIds = first.flatMap((block) =>
      block.quotes.map((quote) => quote.id)
    );

    expect(first[0].kind).toBe("hero");
    expect(first[0].quotes[0].id).toBe("quote-0");
    expect(packedIds).toEqual(records.map((quote) => quote.id));
    expect(new Set(packedIds).size).toBe(records.length);
    expect(second).toEqual(first);
  });
});

// oxlint-disable eslint/no-extend-native -- This test simulates an older Hermes runtime.
describe("Hermes-compatible quote sorting", () => {
  test("does not require Array.prototype.toSorted", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "toSorted"
    );
    let results;

    try {
      Object.defineProperty(Array.prototype, "toSorted", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      results = {
        newest: sortNewest(quotes).map((quote) => quote.id),
        ranked: rankSpeakers(quotes),
        speakers: getUniqueSpeakers(quotes),
      };
    } finally {
      if (descriptor) {
        Object.defineProperty(Array.prototype, "toSorted", descriptor);
      } else {
        Reflect.deleteProperty(Array.prototype, "toSorted");
      }
    }

    expect(results).toEqual({
      newest: ["newest", "newer", "older"],
      ranked: ["Ada", "Grace"],
      speakers: ["Ada", "Grace"],
    });
    expect(quotes.map((quote) => quote.id)).toEqual([
      "older",
      "newer",
      "newest",
    ]);
  });
});
// oxlint-enable eslint/no-extend-native
