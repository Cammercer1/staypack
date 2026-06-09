import {
  blurbVariantsStoredToParagraphs,
  variantTextToParagraphs,
} from "@/lib/copy/blurbVariantEnforce";
import type { BlurbVariantsStored } from "@/lib/copy/blurbVariantConstants";

export type BlurbVariantsQuality = {
  short: number;
  medium: number;
  long: number;
  allSameText: boolean;
};

export function measureBlurbVariantsQuality(
  variants: BlurbVariantsStored | null | undefined,
): BlurbVariantsQuality | null {
  if (!variants) {
    return null;
  }

  return {
    short: variantTextToParagraphs(variants.short).length,
    medium: variantTextToParagraphs(variants.medium).length,
    long: variantTextToParagraphs(variants.long).length,
    allSameText:
      variants.short === variants.medium && variants.medium === variants.long,
  };
}

/** True when variants are missing or collapsed to a single repeated paragraph. */
export function blurbVariantsAreCollapsed(
  variants: BlurbVariantsStored | null | undefined,
): boolean {
  const quality = measureBlurbVariantsQuality(variants);
  if (!quality) {
    return true;
  }

  if (quality.allSameText && quality.long <= 1) {
    return true;
  }

  return quality.long < 3;
}

export function blurbVariantsQualityScore(
  variants: BlurbVariantsStored | null | undefined,
): number {
  const quality = measureBlurbVariantsQuality(variants);
  if (!quality) {
    return 0;
  }

  let score = quality.short + quality.medium + quality.long;
  if (!quality.allSameText) {
    score += 3;
  }
  if (quality.long >= 3) {
    score += 2;
  }
  return score;
}

export function pickRicherBlurbVariants(
  ...candidates: Array<BlurbVariantsStored | null | undefined>
): BlurbVariantsStored | null {
  let best: BlurbVariantsStored | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const score = blurbVariantsQualityScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

/** Keep medium in sync when only the active blurb string is edited. */
export function syncBlurbFieldWithVariants(
  blurb: string,
  variants?: BlurbVariantsStored | null,
): BlurbVariantsStored {
  const trimmed = blurb.trim();
  const paragraphs = variantTextToParagraphs(trimmed);

  if (variants && !blurbVariantsAreCollapsed(variants)) {
    const stored = blurbVariantsStoredToParagraphs(variants);
    return {
      short: stored.short.filter(Boolean).join("\n\n") || trimmed,
      medium:
        paragraphs.length >= 2
          ? paragraphs.slice(0, 2).join("\n\n")
          : [paragraphs[0] ?? trimmed, stored.medium[1] ?? ""]
              .filter(Boolean)
              .join("\n\n") || trimmed,
      long: variants.long,
    };
  }

  const short = paragraphs[0] ?? trimmed;
  const medium =
    paragraphs.length >= 2
      ? paragraphs.slice(0, 2).join("\n\n")
      : [short, paragraphs[1] ?? ""].filter(Boolean).join("\n\n") || short;
  const long =
    paragraphs.length >= 3
      ? paragraphs.slice(0, 3).join("\n\n")
      : [short, paragraphs[1] ?? "", paragraphs[2] ?? ""]
          .filter(Boolean)
          .join("\n\n") || short;

  return { short, medium, long };
}
