import {
  blurbVariantsAreCollapsed,
  pickRicherBlurbVariants,
} from "@/lib/copy/blurbVariantsQuality";
import { normalizeBlurbVariantsFromCopy } from "@/lib/copy/blurbVariantEnforce";
import { pageOneMediumBlurb } from "@/lib/copy/pageOneMarketingCopy";
import type { AiCopyJson, FinalReportJson } from "@/lib/types";

/** Merge richer blurb variants from ai_copy_json when final_report_json is stale. */
export function hydrateFinalReportBlurbVariants(
  report: FinalReportJson,
  aiCopy?: AiCopyJson | null,
): FinalReportJson {
  const existing = report.copy.blurb_variants;
  const fromAi = aiCopy?.sales_pack_blurb_variants ?? null;
  const chosen = pickRicherBlurbVariants(existing, fromAi);

  if (!chosen) {
    if (!report.copy.blurb?.trim()) {
      return report;
    }

    const normalized = normalizeBlurbVariantsFromCopy({
      blurb: report.copy.blurb,
      blurb_variants: existing,
    });

    return {
      ...report,
      copy: {
        ...report.copy,
        blurb_variants: normalized,
      },
    };
  }

  if (
    existing === chosen &&
    !blurbVariantsAreCollapsed(existing) &&
    existing
  ) {
    return report;
  }

  if (existing && !blurbVariantsAreCollapsed(existing) && !fromAi) {
    return report;
  }

  const mediumBlurb =
    pageOneMediumBlurb({
      heading: report.copy.heading,
      bullets: report.copy.appeal_points ?? [],
      blurb_variants: chosen,
    }) || report.copy.blurb;

  return {
    ...report,
    copy: {
      ...report.copy,
      blurb: mediumBlurb,
      blurb_variants: chosen,
    },
  };
}
