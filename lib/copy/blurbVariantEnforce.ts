import { blurbBlocksToPlainText, blurbStringToBlocks } from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { BrochureBlurbBlock, BrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  BLURB_PARAGRAPH_COUNTS,
  BLURB_PARAGRAPH_MAX,
  type BlurbLength,
  type BlurbVariantsParagraphs,
  type BlurbVariantsStored,
} from "@/lib/copy/blurbVariantConstants";

function clampLegacyParagraph(value: string, max: number) {
  const trimmed = normalizeParagraph(value);
  if (trimmed.length <= max) {
    return trimmed;
  }

  const slice = trimmed.slice(0, max);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (lastSentenceEnd >= max * 0.55) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= max * 0.55) {
    return slice.slice(0, lastSpace).trim();
  }

  return slice.trim();
}

function normalizeParagraph(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Normalize validated AI paragraphs — no truncation. */
export function normalizeBlurbParagraphs(
  paragraphs: string[],
  count: number,
): string[] {
  const normalized = paragraphs
    .map((paragraph) => normalizeParagraph(paragraph))
    .slice(0, count);
  while (normalized.length < count) {
    normalized.push("");
  }
  return normalized;
}

export function normalizeBlurbVariantsParagraphs(
  raw: Partial<BlurbVariantsParagraphs>,
): BlurbVariantsParagraphs {
  return {
    short: normalizeBlurbParagraphs(raw.short ?? [], BLURB_PARAGRAPH_COUNTS.short),
    medium: normalizeBlurbParagraphs(raw.medium ?? [], BLURB_PARAGRAPH_COUNTS.medium),
    long: normalizeBlurbParagraphs(raw.long ?? [], BLURB_PARAGRAPH_COUNTS.long),
  };
}

export function paragraphsToVariantText(paragraphs: string[]): string {
  return paragraphs.map(normalizeParagraph).filter(Boolean).join("\n\n");
}

export function variantTextToParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .map(normalizeParagraph)
    .filter(Boolean);
}

export function enforceBlurbParagraphs(
  paragraphs: string[],
  count: number,
): string[] {
  const normalized = paragraphs.map((paragraph) =>
    clampLegacyParagraph(paragraph, BLURB_PARAGRAPH_MAX),
  );
  const result = normalized.slice(0, count);
  while (result.length < count) {
    result.push("");
  }
  return result;
}

export function enforceBlurbVariantsParagraphs(
  raw: Partial<BlurbVariantsParagraphs>,
): BlurbVariantsParagraphs {
  return {
    short: enforceBlurbParagraphs(raw.short ?? [], BLURB_PARAGRAPH_COUNTS.short),
    medium: enforceBlurbParagraphs(raw.medium ?? [], BLURB_PARAGRAPH_COUNTS.medium),
    long: enforceBlurbParagraphs(raw.long ?? [], BLURB_PARAGRAPH_COUNTS.long),
  };
}

export function blurbVariantsParagraphsToStored(
  paragraphs: BlurbVariantsParagraphs,
): BlurbVariantsStored {
  return {
    short: paragraphsToVariantText(paragraphs.short),
    medium: paragraphsToVariantText(paragraphs.medium),
    long: paragraphsToVariantText(paragraphs.long),
  };
}

export function blurbVariantsStoredToParagraphs(
  stored: BlurbVariantsStored,
): BlurbVariantsParagraphs {
  return {
    short: variantTextToParagraphs(stored.short),
    medium: variantTextToParagraphs(stored.medium),
    long: variantTextToParagraphs(stored.long),
  };
}

export function normalizeBlurbVariantsFromCopy(
  copy: Pick<BrochureCopyJson, "blurb" | "blurb_variants"> & {
    blurb_blocks?: BrochureBlurbBlock[];
  },
): BlurbVariantsStored {
  if (copy.blurb_variants) {
    const paragraphs = blurbVariantsStoredToParagraphs(copy.blurb_variants);
    const enforced = enforceBlurbVariantsParagraphs(paragraphs);
    return blurbVariantsParagraphsToStored(enforced);
  }

  const fallback =
    copy.blurb?.trim() ||
    blurbBlocksToPlainText(
      Array.isArray(copy.blurb_blocks) ? copy.blurb_blocks : blurbStringToBlocks(copy.blurb ?? ""),
    );
  const base = fallback ? [fallback] : [""];

  return blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: base.slice(0, 1),
      medium: base.length >= 2 ? base.slice(0, 2) : [base[0] ?? "", ""],
      long:
        base.length >= 3
          ? base.slice(0, 3)
          : [base[0] ?? "", base[1] ?? "", ""],
    }),
  );
}

export function blurbBlocksForLength(
  copy: Pick<BrochureCopyJson, "blurb" | "blurb_variants"> & {
    blurb_blocks?: BrochureBlurbBlock[];
  },
  length: BlurbLength,
): BrochureBlurbBlock[] {
  const stored = normalizeBlurbVariantsFromCopy(copy);
  const paragraphs = variantTextToParagraphs(stored[length]);
  const enforced = enforceBlurbParagraphs(paragraphs, BLURB_PARAGRAPH_COUNTS[length]);
  return enforced
    .filter(Boolean)
    .map((text) => ({ type: "paragraph" as const, text }));
}

/** Dev / fallback copy when AI is unavailable. */
export function mockBlurbVariantsFromText(blurb: string): BlurbVariantsStored {
  const base = blurb.trim() || "Well-presented property in a convenient location.";
  return blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: [base],
      medium: [
        base,
        "The floor plan offers practical zoning, good natural light and easy everyday living.",
      ],
      long: [
        base,
        "Indoor and outdoor spaces connect well, with room to entertain or unwind at home.",
        "Local shops, schools and transport are within easy reach of the front door.",
      ],
    }),
  );
}
