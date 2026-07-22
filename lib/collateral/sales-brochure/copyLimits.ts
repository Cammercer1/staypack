import { BLURB_VARIANT_LABELS, type BlurbLength } from "@/lib/copy/blurbVariantConstants";
import {
  blurbVariantsStoredToParagraphs,
  normalizeBlurbVariantsFromCopy,
} from "@/lib/copy/blurbVariantEnforce";
import {
  PAGE_ONE_BULLET_COUNT,
  PAGE_ONE_BULLET_MAX,
  PAGE_ONE_HEADING_MAX,
  enforcePageOneMarketingCopy,
  getPageOneMarketingCopyPromptLimits,
  pageOneMediumBlurb,
  type PageOneMarketingCopy,
} from "@/lib/copy/pageOneMarketingCopy";
import { blurbBlocksToPlainText } from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  PROPERTY_HIGHLIGHTS_ITEM_MAX,
  PROPERTY_HIGHLIGHTS_MAX,
} from "@/lib/collateral/sales-brochure/brochureCopyConstants";

export const SALES_BROCHURE_COPY_LIMITS = {
  heading: {
    max: PAGE_ONE_HEADING_MAX,
    label: "Heading",
    hint: "Engaging title shown under the address (not the street address alone).",
  },
  blurb: {
    max: 600,
    label: "Property description",
    hint: "Active blurb for the current template (from short / medium / long variants).",
  },
  property_highlights: {
    max: PROPERTY_HIGHLIGHTS_MAX,
    itemMax: PROPERTY_HIGHLIGHTS_ITEM_MAX,
    label: "Property highlights",
    hint: "Exactly four short bullet points.",
  },
  inspection_cta: {
    max: 120,
    label: "Inspection CTA",
    hint: "From agency brand settings — not AI-generated.",
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
    hint: "Bond amount shown on this rental brochure only.",
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

export function getSalesBrochureCopyPromptLimits() {
  return getPageOneMarketingCopyPromptLimits();
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** Clamps AI-generated page-one copy to the shared contract. */
export function enforceSalesBrochureCopyLimits(
  copy: SalesBrochureCopyJson,
): SalesBrochureCopyJson {
  const limits = SALES_BROCHURE_COPY_LIMITS;

  const pageOne = enforcePageOneMarketingCopy({
    heading: copy.heading,
    blurb_variants: normalizeBlurbVariantsFromCopy(copy),
    bullets:
      copy.property_highlights?.length === PAGE_ONE_BULLET_COUNT
        ? copy.property_highlights
        : (copy.property_highlights ?? []).slice(0, PAGE_ONE_BULLET_COUNT),
  });

  return {
    ...copy,
    ...pageOneToStoredBrochureCopy(pageOne, copy),
    template_blurb_length: copy.template_blurb_length,
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

function pageOneToStoredBrochureCopy(
  pageOne: PageOneMarketingCopy,
  existing: SalesBrochureCopyJson,
): Pick<
  SalesBrochureCopyJson,
  "heading" | "blurb" | "blurb_blocks" | "blurb_variants" | "property_highlights"
> {
  const blurb = pageOneMediumBlurb(pageOne);
  const mediumParagraphs = blurbVariantsStoredToParagraphs(pageOne.blurb_variants).medium
    .filter(Boolean)
    .map((text) => ({ type: "paragraph" as const, text }));
  const property_highlights = pageOne.bullets
    .slice(0, PROPERTY_HIGHLIGHTS_MAX)
    .map((item) => truncate(item, PAGE_ONE_BULLET_MAX));

  return {
    heading: pageOne.heading,
    blurb,
    blurb_blocks:
      mediumParagraphs.length > 0 ? mediumParagraphs : (existing.blurb_blocks ?? []),
    blurb_variants: pageOne.blurb_variants,
    property_highlights,
  };
}

/** Maps validated AI output (heading, blurb, bullets) into stored brochure copy. */
export function brochureCopyFromPageOneAi(
  pageOne: PageOneMarketingCopy,
  agencyDefaults: { inspection_cta: string; disclaimer: string },
): SalesBrochureCopyJson {
  const enforced = enforcePageOneMarketingCopy(pageOne);
  const stored = pageOneToStoredBrochureCopy(enforced, {
    heading: "",
    blurb: "",
    blurb_blocks: [],
    blurb_variants: enforced.blurb_variants,
    property_highlights: [],
    inspection_cta: "",
    disclaimer: "",
  });

  return enforceSalesBrochureCopyLimits({
    ...stored,
    inspection_cta: agencyDefaults.inspection_cta,
    disclaimer: agencyDefaults.disclaimer,
  });
}

export { blurbBlocksToPlainText, BLURB_VARIANT_LABELS };
export type { BlurbLength };
