import { describe, expect, test } from "bun:test";

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
