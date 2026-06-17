import type { AiCopyJson, FinalReportJson, Report } from "@/lib/types";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";
import { pickReportPropertyImages } from "@/lib/reports/editable/reportImageSlots";

export type StrReportEditorCopy = FinalReportJson["copy"];

export function finalReportCopyFromAiCopy(aiCopy: AiCopyJson): StrReportEditorCopy {
  return {
    heading: aiCopy.sales_pack_heading,
    blurb: aiCopy.sales_pack_blurb,
    blurb_variants: aiCopy.sales_pack_blurb_variants,
    key_metrics_line: aiCopy.key_metrics_line,
    appeal_points: [...aiCopy.property_appeal_points],
    supporting_factors: [...aiCopy.performance_supporting_factors],
    buyer_checks: [...aiCopy.buyer_checks],
    methodology_note: aiCopy.methodology_note,
    disclaimer: aiCopy.disclaimer,
    comparable_evidence: "",
    comparable_disclaimer: "",
    cta: "",
  };
}

export function finalReportCopyToAiCopy(
  copy: StrReportEditorCopy,
  existingAiCopy: AiCopyJson | null,
): AiCopyJson {
  return {
    sales_pack_heading: copy.heading,
    sales_pack_blurb: copy.blurb,
    sales_pack_blurb_variants: copy.blurb_variants ?? existingAiCopy?.sales_pack_blurb_variants,
    key_metrics_line: copy.key_metrics_line,
    property_appeal_points: [...copy.appeal_points],
    performance_supporting_factors: [...copy.supporting_factors],
    buyer_checks: [...copy.buyer_checks],
    methodology_note: copy.methodology_note,
    disclaimer: copy.disclaimer,
    confidence_notes: existingAiCopy?.confidence_notes ?? "",
  };
}

export function copyFromStrReport(report: Report): StrReportEditorCopy | null {
  const json = report.final_report_json as FinalReportJson | null;
  if (json?.copy) {
    return json.copy;
  }

  if (report.ai_copy_json) {
    return finalReportCopyFromAiCopy(report.ai_copy_json);
  }

  return null;
}

export function propertyImagesFromStrReport(
  report: Report | null,
): ReportPropertyImageSelection | null {
  const json = report?.final_report_json as FinalReportJson | null;
  if (!json?.property) {
    return null;
  }
  return pickReportPropertyImages(json.property);
}

export function strEditorSnapshot(
  copy: StrReportEditorCopy,
  propertyImages: ReportPropertyImageSelection | null,
) {
  return JSON.stringify({ copy, propertyImages });
}
