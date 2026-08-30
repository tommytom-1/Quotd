import type { QuoteRecord, SpeakerProfile } from "./types";

// FNV hashing deliberately operates on UTF-16 code units and unsigned 32-bit integers.
/* oxlint-disable eslint/no-bitwise, unicorn/prefer-code-point, unicorn/prefer-math-trunc */
function hashName(name: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < name.length; index += 1) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 16_777_619);
  }
  return hash >>> 0;
}

export function speakerColor(name: string): string {
  // Muted RGB colors suitable for both light and dark backgrounds.
  const hash = hashName(name.trim().toLowerCase());
  return `#${[0, 8, 16]
    .map((shift) =>
      (80 + ((hash >>> shift) & 127)).toString(16).padStart(2, "0")
    )
    .join("")}`;
}

/* oxlint-enable eslint/no-bitwise, unicorn/prefer-code-point, unicorn/prefer-math-trunc */

function availableId(name: string, ids: Set<string>): string {
  const base = `speaker-${hashName(name).toString(36)}`;
  let id = base;
  let suffix = 1;
  while (ids.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/** Exact names remain distinct, including legacy case variants. Never merge quotes. */
export function ensureSpeakerProfiles(
  speakers: readonly SpeakerProfile[],
  quotes: readonly Pick<QuoteRecord, "speaker">[]
): SpeakerProfile[] {
  const result = [...speakers];
  const names = new Set(speakers.map((speaker) => speaker.name));
  const ids = new Set(speakers.map((speaker) => speaker.id));
  for (const { speaker: name } of quotes) {
    if (!name.trim() || names.has(name)) {
      continue;
    }
    const id = availableId(name, ids);
    result.push({ id, name, avatarUri: null, color: speakerColor(name) });
    names.add(name);
    ids.add(id);
  }
  return result;
}

/** Repairs malformed fields without discarding valid names or inactive profiles. */
export function normalizeSpeakerProfiles(
  value: unknown,
  quotes: readonly Pick<QuoteRecord, "speaker">[],
  resolveAvatar: (uri: string | null) => string | null = (uri) => uri
): SpeakerProfile[] {
  const speakers: SpeakerProfile[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of Array.isArray(value) ? value : []) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Partial<SpeakerProfile>;
    const { name } = candidate;
    if (typeof name !== "string" || !name.trim() || names.has(name)) {
      continue;
    }
    const id =
      typeof candidate.id === "string" &&
      candidate.id.trim() &&
      !ids.has(candidate.id)
        ? candidate.id
        : availableId(name, ids);
    speakers.push({
      id,
      name,
      color:
        typeof candidate.color === "string" &&
        /^#[\da-f]{6}$/iu.test(candidate.color)
          ? candidate.color
          : speakerColor(name),
      avatarUri: resolveAvatar(
        typeof candidate.avatarUri === "string" ? candidate.avatarUri : null
      ),
    });
    names.add(name);
    ids.add(id);
  }
  return ensureSpeakerProfiles(speakers, quotes);
}

export function renameSpeakerInState<
  T extends { speakers: SpeakerProfile[]; quotes: QuoteRecord[] },
>(state: T, id: string, input: string): T {
  const name = input.trim();
  if (!name) {
    throw new Error("Speaker name cannot be empty");
  }
  const speaker = state.speakers.find((item) => item.id === id);
  if (!speaker) {
    throw new Error("Speaker not found");
  }
  if (
    state.speakers.some(
      (item) =>
        item.id !== id && item.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error("Another speaker already has this name");
  }
  return {
    ...state,
    speakers: state.speakers.map((item) =>
      item.id === id ? { ...item, name } : item
    ),
    quotes: state.quotes.map((quote) =>
      quote.speaker === speaker.name ? { ...quote, speaker: name } : quote
    ),
  };
}

export interface PersonQuotes {
  person: SpeakerProfile;
  /** Newest first. */
  quotes: QuoteRecord[];
}

/** One entry per person with quotes, starting with whoever was quoted last. */
export function groupQuotesByPerson(
  speakers: readonly SpeakerProfile[],
  quotes: readonly QuoteRecord[]
): PersonQuotes[] {
  const byName = new Map<string, QuoteRecord[]>();
  for (const quote of quotes) {
    const group = byName.get(quote.speaker);
    if (group) {
      group.push(quote);
    } else {
      byName.set(quote.speaker, [quote]);
    }
  }
  const people: PersonQuotes[] = [];
  for (const person of speakers) {
    const group = byName.get(person.name);
    if (group) {
      // oxlint-disable-next-line unicorn/no-array-sort -- Hermes does not provide toSorted.
      group.sort((first, second) => second.createdAt - first.createdAt);
      people.push({ person, quotes: group });
    }
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- Hermes does not provide toSorted.
  return people.sort(
    (first, second) => second.quotes[0].createdAt - first.quotes[0].createdAt
  );
}
