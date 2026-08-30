import type { QuoteRecord } from "@/lib/types";

export type QuoteArtworkVariant =
  | "detail"
  | "hero"
  | "square"
  | "tall"
  | "wide";

export type QuoteMosaicBlock =
  | {
      id: string;
      kind: "hero" | "wide";
      quotes: [QuoteRecord];
    }
  | {
      id: string;
      kind: "pair" | "tallPair";
      quotes: [QuoteRecord, QuoteRecord];
    }
  | {
      id: string;
      kind: "stackLeft" | "stackRight";
      quotes: [QuoteRecord, QuoteRecord, QuoteRecord];
    };

function hashString(value: string) {
  let hash = 17;
  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return hash;
}

function blockId(kind: QuoteMosaicBlock["kind"], quotes: QuoteRecord[]) {
  return `${kind}:${quotes.map((quote) => quote.id).join(":")}`;
}

/**
 * Packs quotes into complete two-column blocks. The choice for each block is
 * derived from quote IDs, so the same collection keeps the same composition
 * between launches without storing presentation data alongside a quote.
 */
export function buildQuoteMosaic(quotes: QuoteRecord[]): QuoteMosaicBlock[] {
  if (quotes.length === 0) {
    return [];
  }

  const blocks: QuoteMosaicBlock[] = [
    {
      id: blockId("hero", [quotes[0]]),
      kind: "hero",
      quotes: [quotes[0]],
    },
  ];

  let cursor = 1;
  let previousKind: QuoteMosaicBlock["kind"] = "hero";

  while (cursor < quotes.length) {
    const remaining = quotes.length - cursor;
    const roll = hashString(
      `${quotes[cursor].id}:${quotes[cursor + 1]?.id ?? "end"}:${previousKind}`
    );

    if (remaining >= 3 && roll % 100 < 44) {
      const kind = roll % 2 === 0 ? "stackLeft" : "stackRight";
      const group = quotes.slice(cursor, cursor + 3) as [
        QuoteRecord,
        QuoteRecord,
        QuoteRecord,
      ];
      blocks.push({ id: blockId(kind, group), kind, quotes: group });
      previousKind = kind;
      cursor += 3;
      continue;
    }

    if (remaining >= 2 && roll % 100 < 82) {
      const kind = roll % 7 === 0 ? "tallPair" : "pair";
      const group = quotes.slice(cursor, cursor + 2) as [
        QuoteRecord,
        QuoteRecord,
      ];
      blocks.push({ id: blockId(kind, group), kind, quotes: group });
      previousKind = kind;
      cursor += 2;
      continue;
    }

    const group = [quotes[cursor]] as [QuoteRecord];
    blocks.push({ id: blockId("wide", group), kind: "wide", quotes: group });
    previousKind = "wide";
    cursor += 1;
  }

  return blocks;
}
