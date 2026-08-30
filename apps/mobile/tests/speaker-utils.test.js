import { describe, expect, test } from "bun:test";

import {
  ensureSpeakerProfiles,
  groupQuotesByPerson,
  normalizeSpeakerProfiles,
  renameSpeakerInState,
  speakerColor,
} from "../src/lib/speaker-utils.ts";

const quotes = ["Ada", "Grace", "Ada"].map((speaker, index) => ({
  id: String(index),
  speaker,
  text: `Quote ${index}`,
  imageUri: null,
  createdAt: index,
}));

function fixture() {
  const speakers = normalizeSpeakerProfiles(undefined, quotes);
  speakers[0] = {
    ...speakers[0],
    avatarUri: "images/ada.jpg",
    color: "#123456",
  };
  return { version: 1, speakers, quotes };
}

describe("speaker profiles", () => {
  test("migrates old quotes without changing or merging their names", () => {
    const legacy = [...quotes, { ...quotes[0], speaker: "ada" }];
    const speakers = normalizeSpeakerProfiles(undefined, legacy);
    expect(speakers.map((speaker) => speaker.name)).toEqual([
      "Ada",
      "Grace",
      "ada",
    ]);
    expect(new Set(speakers.map((speaker) => speaker.id)).size).toBe(3);
    expect(speakers.every((speaker) => speaker.avatarUri === null)).toBe(true);
    expect(normalizeSpeakerProfiles(undefined, legacy)).toEqual(speakers);
    expect(legacy.map((quote) => quote.speaker)).toEqual([
      "Ada",
      "Grace",
      "Ada",
      "ada",
    ]);
  });

  test("rename preserves identity, color, photo, and unrelated quotes", () => {
    const state = fixture();
    const renamed = renameSpeakerInState(
      state,
      state.speakers[0].id,
      "  Augusta  "
    );
    expect(renamed.speakers[0]).toEqual({
      ...state.speakers[0],
      name: "Augusta",
    });
    expect(renamed.quotes.map((quote) => quote.speaker)).toEqual([
      "Augusta",
      "Grace",
      "Augusta",
    ]);
    expect(renamed.quotes[1]).toBe(state.quotes[1]);
    expect(renamed.quotes[0]).toEqual({
      ...state.quotes[0],
      speaker: "Augusta",
    });
    expect(state.speakers[0].name).toBe("Ada");
    expect(state.quotes[0].speaker).toBe("Ada");
  });

  test("rejects blank, conflicting, and unknown speaker renames", () => {
    const state = fixture();
    const [{ id }] = state.speakers;
    for (const name of ["", " \n ", "Grace", " gRaCe "]) {
      expect(() => renameSpeakerInState(state, id, name)).toThrow();
    }
    expect(() => renameSpeakerInState(state, "missing", "Name")).toThrow(
      "Speaker not found"
    );
    expect(renameSpeakerInState(state, id, "ADA").speakers[0].name).toBe("ADA");
  });

  test("normalization after JSON persistence and rename keeps stored color and ID", () => {
    const state = fixture();
    const renamed = renameSpeakerInState(
      state,
      state.speakers[0].id,
      "Augusta"
    );
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- Exercise the on-disk JSON representation.
    const persisted = JSON.parse(JSON.stringify(renamed));
    const normalized = normalizeSpeakerProfiles(
      persisted.speakers,
      persisted.quotes
    );
    expect(normalized).toEqual(renamed.speakers);
    expect(normalizeSpeakerProfiles(normalized, persisted.quotes)).toEqual(
      normalized
    );
    expect(speakerColor("Ada")).toBe(speakerColor("Ada"));
  });

  test("ensures new names once and retains inactive profiles", () => {
    const state = fixture();
    const ensured = ensureSpeakerProfiles(state.speakers, [
      { speaker: "New" },
      { speaker: "New" },
    ]);
    expect(ensured.map((speaker) => speaker.name)).toEqual([
      "Ada",
      "Grace",
      "New",
    ]);
    expect(ensureSpeakerProfiles(ensured, [])).toEqual(ensured);
    expect(ensureSpeakerProfiles(ensured, quotes)).toEqual(ensured);
  });

  test("repairs malformed data and resolves portable avatar paths", () => {
    const speakers = normalizeSpeakerProfiles(
      [
        null,
        42,
        {},
        { name: " " },
        {
          name: "Ada",
          id: "same",
          color: "#abcdef",
          avatarUri: "images/ada.jpg",
        },
        { name: "Grace", id: "same", color: 17, avatarUri: false },
        { name: "Inactive", id: "inactive", color: "#123456", avatarUri: null },
      ],
      quotes,
      (uri) => (uri?.startsWith("images/") ? `file:///new/quotd/${uri}` : uri)
    );
    expect(speakers).toHaveLength(3);
    expect(new Set(speakers.map((speaker) => speaker.id)).size).toBe(3);
    expect(speakers[0].avatarUri).toBe("file:///new/quotd/images/ada.jpg");
    expect(speakers[1].avatarUri).toBeNull();
    expect(speakers[1].color).toBe(speakerColor("Grace"));
    expect(normalizeSpeakerProfiles(speakers, quotes)).toEqual(speakers);
  });

  test("new profiles cannot reuse an ID retained through rename", () => {
    const state = fixture();
    const renamed = renameSpeakerInState(
      state,
      state.speakers[0].id,
      "Augusta"
    );
    const ensured = ensureSpeakerProfiles(renamed.speakers, [
      { speaker: "Ada" },
    ]);
    expect(new Set(ensured.map((speaker) => speaker.id)).size).toBe(3);
    expect(ensured[0]).toEqual(renamed.speakers[0]);
  });
});

describe("people columns", () => {
  test("groups quotes by person, most recently quoted first", () => {
    const { speakers } = fixture();
    const idle = {
      id: "idle",
      name: "Idle",
      avatarUri: null,
      color: "#000000",
    };
    const columns = groupQuotesByPerson([...speakers, idle], quotes);
    expect(columns.map((column) => column.person.name)).toEqual([
      "Ada",
      "Grace",
    ]);
    expect(columns[0].quotes.map((quote) => quote.id)).toEqual(["2", "0"]);
  });
});
