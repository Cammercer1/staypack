/** Blurb variant constants only — no imports from templates or collateral (avoids circular deps). */

export const BLURB_LENGTHS = ["short", "medium", "long"] as const;
export type BlurbLength = (typeof BLURB_LENGTHS)[number];

export const BLURB_PARAGRAPH_COUNTS: Record<BlurbLength, number> = {
  short: 1,
  medium: 2,
  long: 3,
};

/** Max characters per paragraph in each variant. */
export const BLURB_PARAGRAPH_MAX = 320;

export type BlurbVariantsStored = Record<BlurbLength, string>;

export type BlurbVariantsParagraphs = Record<BlurbLength, string[]>;

export const BLURB_VARIANT_LABELS: Record<BlurbLength, string> = {
  short: "Short (1 paragraph)",
  medium: "Medium (2 paragraphs)",
  long: "Long (3 paragraphs)",
};

export function getBlurbVariantsAiContract(): string {
  return `Return these blurb fields (each paragraph max ${BLURB_PARAGRAPH_MAX} characters). Blurbs are marketing copy only — no disclaimers, caveats, or compliance hedging:
- blurb_short: string — exactly ONE paragraph
- blurb_medium_paragraphs: array of exactly 2 strings — two paragraphs
- blurb_long_paragraphs: array of exactly 3 strings — three paragraphs`;
}

export function getBlurbVariantsPromptLimits(): string {
  return `Blurb limits:
- blurb_short: 1 paragraph, max ${BLURB_PARAGRAPH_MAX} characters
- blurb_medium_paragraphs: exactly 2 paragraphs, max ${BLURB_PARAGRAPH_MAX} characters each
- blurb_long_paragraphs: exactly 3 paragraphs, max ${BLURB_PARAGRAPH_MAX} characters each`;
}
