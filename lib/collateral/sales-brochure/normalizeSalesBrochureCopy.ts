import type { Agency } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  blurbBlocksFromRaw,
  blurbBlocksToPlainText,
  normalizeBlurbBlocks,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import { propertyHighlightsFromRaw } from "@/lib/collateral/sales-brochure/propertyHighlights";

export function normalizeSalesBrochureCopy(
  raw: unknown,
  agency: Agency,
): SalesBrochureCopyJson {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const blurb_blocks = normalizeBlurbBlocks(blurbBlocksFromRaw(data));
  const blurb =
    blurbBlocksToPlainText(blurb_blocks) ||
    stringField(data.blurb ?? data.sales_pack_blurb);

  return {
    heading: stringField(data.heading ?? data.sales_pack_heading),
    blurb,
    blurb_blocks,
    property_highlights: propertyHighlightsFromRaw(data),
    inspection_cta: stringField(
      data.inspection_cta ?? data.cta ?? agency.default_cta,
    ),
    disclaimer: stringField(
      data.disclaimer ?? agency.default_disclaimer ?? DEFAULT_DISCLAIMER,
    ),
    page_two_note: stringField(data.page_two_note),
    price_label: stringField(data.price_label) || undefined,
    price_value: stringField(data.price_value) || undefined,
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
