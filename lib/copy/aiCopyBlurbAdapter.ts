import type { BrochureCopyJson } from "@/lib/collateral/templates/types";
import { normalizeBlurbVariantsFromCopy } from "@/lib/copy/blurbVariantEnforce";
import type { AiCopyJson } from "@/lib/types";

export function aiCopyToVariantEditorShape(
  copy: AiCopyJson,
): Pick<
  BrochureCopyJson,
  "heading" | "blurb" | "blurb_variants" | "property_highlights" | "inspection_cta" | "disclaimer"
> {
  const blurb_variants =
    copy.sales_pack_blurb_variants ??
    normalizeBlurbVariantsFromCopy({ blurb: copy.sales_pack_blurb });

  return {
    heading: copy.sales_pack_heading,
    blurb: copy.sales_pack_blurb,
    blurb_variants,
    property_highlights: copy.property_appeal_points,
    inspection_cta: "",
    disclaimer: copy.disclaimer,
  };
}

export function applyVariantEditorToAiCopy(
  copy: AiCopyJson,
  shaped: Pick<BrochureCopyJson, "blurb" | "blurb_variants">,
): AiCopyJson {
  return {
    ...copy,
    sales_pack_blurb: shaped.blurb,
    sales_pack_blurb_variants: shaped.blurb_variants,
  };
}
