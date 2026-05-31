import {
  BLURB_BLOCKS_MAX,
  BLURB_HEADING_MAX,
  BLURB_PARAGRAPH_MAX,
  blurbBlocksToPlainText,
  normalizeBlurbBlocks,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  PROPERTY_HIGHLIGHTS_ITEM_MAX,
  PROPERTY_HIGHLIGHTS_MAX,
} from "@/lib/collateral/sales-brochure/propertyHighlights";

export const SALES_BROCHURE_COPY_LIMITS = {
  heading: {
    max: 90,
    label: "Heading",
    hint: "Short subtitle shown under the address.",
  },
  blurb: {
    max: 340,
    label: "Property description",
    hint: "Use paragraphs and optional section headings. Add or remove blocks as needed.",
  },
  property_highlights: {
    max: PROPERTY_HIGHLIGHTS_MAX,
    itemMax: PROPERTY_HIGHLIGHTS_ITEM_MAX,
    label: "Property highlights",
    hint: "Optional bullet list (up to 8). Leave empty for description-only brochures.",
  },
  inspection_cta: {
    max: 120,
    label: "Inspection CTA",
    hint: "Open-home or contact call-to-action.",
  },
  price_label: {
    max: 24,
    label: "Price label",
    hint: 'Wording shown above the price (e.g. "Price", "Guide", "Offers over"). Leave blank for "Price".',
  },
  price_value: {
    max: 60,
    label: "Price",
    hint: "Overrides the price shown on this brochure only. Leave blank to use the listing price.",
  },
  bond_label: {
    max: 24,
    label: "Bond label",
    hint: 'Wording shown above the bond (e.g. "Bond", "Security deposit"). Leave blank for "Bond".',
  },
  bond_value: {
    max: 60,
    label: "Bond",
    hint: "Bond amount shown on this lease brochure only.",
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
  "property_highlights",
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

/** Clamps AI-generated copy to layout-friendly lengths. User edits are not clamped. */
export function enforceSalesBrochureCopyLimits(
  copy: SalesBrochureCopyJson,
): SalesBrochureCopyJson {
  const limits = SALES_BROCHURE_COPY_LIMITS;

  const blurb_blocks = normalizeBlurbBlocks(copy.blurb_blocks ?? []).map((block) =>
    block.type === "heading"
      ? { type: "heading" as const, text: truncate(block.text, BLURB_HEADING_MAX) }
      : {
          type: "paragraph" as const,
          text: truncate(block.text, BLURB_PARAGRAPH_MAX),
        },
  ).slice(0, BLURB_BLOCKS_MAX);
  const blurb = blurbBlocksToPlainText(blurb_blocks);

  return {
    heading: truncate(copy.heading, limits.heading.max),
    blurb: truncate(blurb, limits.blurb.max),
    blurb_blocks,
    property_highlights: (copy.property_highlights ?? [])
      .slice(0, limits.property_highlights.max)
      .map((item) => truncate(item, limits.property_highlights.itemMax)),
    inspection_cta: truncate(copy.inspection_cta, limits.inspection_cta.max),
    disclaimer: truncate(copy.disclaimer, limits.disclaimer.max),
    page_two_note: truncate(copy.page_two_note ?? "", limits.page_two_note.max),
    price_label:
      copy.price_label != null
        ? truncate(copy.price_label, limits.price_label.max)
        : undefined,
    price_value:
      copy.price_value != null
        ? truncate(copy.price_value, limits.price_value.max)
        : undefined,
    bond_label:
      copy.bond_label != null
        ? truncate(copy.bond_label, limits.bond_label.max)
        : undefined,
    bond_value:
      copy.bond_value != null
        ? truncate(copy.bond_value, limits.bond_value.max)
        : undefined,
  };
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
