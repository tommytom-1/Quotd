import type { QuoteRecord } from "@/lib/types";

export const QUOTE_GRADIENTS = [
  ["#FDA4AF", "#FED7AA"],
  ["#FCD34D", "#D9F99D"],
  ["#7DD3FC", "#C7D2FE"],
  ["#C4B5FD", "#FBCFE8"],
  ["#5EEAD4", "#A5F3FC"],
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

export function gradientForId(id: string) {
  const sum = [...id].reduce(
    (total, character) => total + (character.codePointAt(0) ?? 0),
    0
  );
  return QUOTE_GRADIENTS[sum % QUOTE_GRADIENTS.length];
}

export function formatDate(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

export function formatMonthLabel(timestamp: number) {
  return monthFormatter.format(new Date(timestamp));
}

export function sortNewest(quotes: QuoteRecord[]) {
  return [...quotes].sort(
    (first, second) => second.createdAt - first.createdAt
  );
}

export function filterBySpeaker(quotes: QuoteRecord[], speaker: string) {
  if (speaker === "All") {
    return quotes;
  }
  return quotes.filter((quote) => quote.speaker === speaker);
}

export function getUniqueSpeakers(quotes: QuoteRecord[]) {
  return [
    ...new Set(quotes.map((quote) => quote.speaker.trim()).filter(Boolean)),
  ].sort((first, second) => first.localeCompare(second));
}

export function rankSpeakers(quotes: QuoteRecord[]) {
  const speakers = new Map<string, { count: number; lastUsed: number }>();

  for (const quote of quotes) {
    const name = quote.speaker.trim();
    if (!name) {
      continue;
    }

    const existing = speakers.get(name);
    if (existing) {
      existing.count += 1;
      existing.lastUsed = Math.max(existing.lastUsed, quote.createdAt);
    } else {
      speakers.set(name, { count: 1, lastUsed: quote.createdAt });
    }
  }

  return [...speakers.entries()]
    .sort(
      ([, first], [, second]) =>
        second.count - first.count || second.lastUsed - first.lastUsed
    )
    .map(([name]) => name)
    .slice(0, 8);
}

export interface QuoteSection {
  title: string;
  data: QuoteRecord[];
}

export function groupByMonth(quotes: QuoteRecord[]): QuoteSection[] {
  const groups = new Map<string, QuoteRecord[]>();

  for (const quote of quotes) {
    const label = formatMonthLabel(quote.createdAt);
    const group = groups.get(label);
    if (group) {
      group.push(quote);
    } else {
      groups.set(label, [quote]);
    }
  }

  return [...groups].map(([title, data]) => ({ title, data }));
}

export function quoteFontSize(text: string) {
  if (text.length > 420) {
    return 13.5;
  }
  if (text.length > 320) {
    return 15;
  }
  if (text.length > 240) {
    return 17;
  }
  if (text.length > 180) {
    return 19;
  }
  if (text.length > 110) {
    return 22;
  }
  if (text.length > 60) {
    return 26;
  }
  return 31;
}
