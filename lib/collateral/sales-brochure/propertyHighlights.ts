import {
  blurbBlocksFromRaw,
  blurbBlocksFromRawForEditor,
  blurbBlocksToPlainText,
  normalizeBlurbBlocks,
  normalizeBlurbBlocksForEditor,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import type {
  SalesBrochureCopyJson,
  SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";

export const PROPERTY_HIGHLIGHTS_MAX = 8;
export const PROPERTY_HIGHLIGHTS_ITEM_MAX = 140;

type LegacyBrochureCopy = SalesBrochureCopyJson & {
  appeal_points?: string[];
  feature_highlights?: string[];
};

function trimItems(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

/** Safe read for templates — handles legacy documents missing `property_highlights`. */
export function getPropertyHighlights(copy: LegacyBrochureCopy): string[] {
  if (Array.isArray(copy.property_highlights)) {
    return trimItems(copy.property_highlights);
  }
  return trimItems([
    ...(copy.appeal_points ?? []),
    ...(copy.feature_highlights ?? []),
  ]);
}

export function coerceSalesBrochureDocument(
  document: SalesBrochureDocumentJson,
): SalesBrochureDocumentJson {
  return {
    ...document,
    copy: coerceSalesBrochureCopy(document.copy as LegacyBrochureCopy),
  };
}

/** Merges legacy appeal_points + feature_highlights into property_highlights. */
export function coerceSalesBrochureCopy(
  copy: LegacyBrochureCopy,
): SalesBrochureCopyJson {
  const property_highlights = Array.isArray(copy.property_highlights)
    ? trimItems(copy.property_highlights)
    : trimItems([
        ...(copy.appeal_points ?? []),
        ...(copy.feature_highlights ?? []),
      ]);

  const blurb_blocks = normalizeBlurbBlocks(
    blurbBlocksFromRaw({
      blurb: copy.blurb,
      blurb_blocks: copy.blurb_blocks,
    }),
  );
  const blurb = blurbBlocksToPlainText(blurb_blocks) || (copy.blurb ?? "").trim();

  return {
    heading: copy.heading ?? "",
    blurb,
    blurb_blocks,
    property_highlights,
    inspection_cta: copy.inspection_cta ?? "",
    disclaimer: copy.disclaimer ?? "",
    page_two_note: copy.page_two_note,
    price_label: copy.price_label,
    price_value: copy.price_value,
  };
}

/** Preserves in-progress empty blurb blocks for the inline brochure editor. */
export function coerceSalesBrochureCopyForEditor(
  copy: LegacyBrochureCopy,
): SalesBrochureCopyJson {
  const property_highlights = Array.isArray(copy.property_highlights)
    ? trimItems(copy.property_highlights)
    : trimItems([
        ...(copy.appeal_points ?? []),
        ...(copy.feature_highlights ?? []),
      ]);

  const blurb_blocks = normalizeBlurbBlocksForEditor(
    blurbBlocksFromRawForEditor({
      blurb: copy.blurb,
      blurb_blocks: copy.blurb_blocks,
    }),
  );
  const blurb = blurbBlocksToPlainText(blurb_blocks) || (copy.blurb ?? "").trim();

  return {
    heading: copy.heading ?? "",
    blurb,
    blurb_blocks,
    property_highlights,
    inspection_cta: copy.inspection_cta ?? "",
    disclaimer: copy.disclaimer ?? "",
    page_two_note: copy.page_two_note,
    price_label: copy.price_label,
    price_value: copy.price_value,
  };
}

export function propertyHighlightsFromRaw(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.property_highlights)) {
    return trimItems(
      data.property_highlights.filter((item): item is string => typeof item === "string"),
    );
  }

  const appeal = Array.isArray(data.appeal_points)
    ? data.appeal_points
    : Array.isArray(data.property_appeal_points)
      ? data.property_appeal_points
      : [];
  const features = Array.isArray(data.feature_highlights)
    ? data.feature_highlights
    : Array.isArray(data.performance_supporting_factors)
      ? data.performance_supporting_factors
      : [];

  return trimItems([
    ...appeal.filter((item): item is string => typeof item === "string"),
    ...features.filter((item): item is string => typeof item === "string"),
  ]);
}
