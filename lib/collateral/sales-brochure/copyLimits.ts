import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";

export const SALES_BROCHURE_COPY_LIMITS = {
  heading: {
    max: 90,
    label: "Heading",
    hint: "Short subtitle shown under the address.",
  },
  blurb: {
    max: 340,
    label: "Blurb",
    hint: "About 4–5 lines on page 1.",
  },
  appeal_points: {
    max: 4,
    itemMax: 120,
    label: "Appeal points",
    hint: "Up to 4 short bullets on page 1.",
  },
  feature_highlights: {
    max: 6,
    itemMax: 140,
    label: "Feature highlights",
    hint: "Up to 6 bullets on page 2.",
  },
  inspection_cta: {
    max: 120,
    label: "Inspection CTA",
    hint: "Open-home or contact call-to-action.",
  },
  disclaimer: {
    max: 500,
    label: "Disclaimer",
    hint: "Legal disclaimer at the bottom of page 2.",
  },
  page_two_note: {
    max: 600,
    label: "Page 2 note (optional)",
    hint: "Optional paragraph shown at the foot of page 2. Leave blank for a photo-only page.",
  },
} as const;

/** Copy fields the AI writes — page_two_note is user-authored, so it's excluded. */
const AI_GENERATED_COPY_KEYS = [
  "heading",
  "blurb",
  "appeal_points",
  "feature_highlights",
  "inspection_cta",
  "disclaimer",
] as const;

export function getSalesBrochureCopyPromptLimits() {
  return Object.entries(SALES_BROCHURE_COPY_LIMITS)
    .filter(([key]) =>
      (AI_GENERATED_COPY_KEYS as readonly string[]).includes(key),
    )
    .map(([key, limit]) => {
      if ("itemMax" in limit) {
        return `- ${key}: up to ${limit.max} items, max ${limit.itemMax} characters each`;
      }
      return `- ${key}: max ${limit.max} characters`;
    })
    .join("\n");
}

export function enforceSalesBrochureCopyLimits(
  copy: SalesBrochureCopyJson,
): SalesBrochureCopyJson {
  const limits = SALES_BROCHURE_COPY_LIMITS;

  return {
    heading: truncate(copy.heading, limits.heading.max),
    blurb: truncate(copy.blurb, limits.blurb.max),
    appeal_points: copy.appeal_points
      .slice(0, limits.appeal_points.max)
      .map((item) => truncate(item, limits.appeal_points.itemMax)),
    feature_highlights: copy.feature_highlights
      .slice(0, limits.feature_highlights.max)
      .map((item) => truncate(item, limits.feature_highlights.itemMax)),
    inspection_cta: truncate(copy.inspection_cta, limits.inspection_cta.max),
    disclaimer: truncate(copy.disclaimer, limits.disclaimer.max),
    page_two_note: truncate(copy.page_two_note ?? "", limits.page_two_note.max),
  };
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
