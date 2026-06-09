import { coerceSalesBrochureCopy } from "@/lib/collateral/sales-brochure/propertyHighlights";
import { resolveCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";

function brochureCollateralVariant(document: BrochureDocumentJson): ReportPageVariant {
  return document.type === "rental_brochure" ? "lease" : "sale";
}

export function coerceSalesBrochureDocument(
  document: BrochureDocumentJson,
  options?: { allowDevBlurbLengthMap?: boolean },
): BrochureDocumentJson {
  const coerced = coerceSalesBrochureCopy(document.copy);
  const resolved = resolveCopyForTemplate({
    copy: coerced,
    templateId: document.template_id,
    collateral: brochureCollateralVariant(document),
    allowDevBlurbLengthMap: options?.allowDevBlurbLengthMap,
  });
  return {
    ...document,
    copy: {
      ...coerced,
      blurb: resolved.blurb,
      blurb_blocks: resolved.blurb_blocks,
      blurb_variants: resolved.blurb_variants,
    },
  };
}
