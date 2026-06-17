import { describe, expect, it } from "vitest";
import { variantTextToParagraphs } from "@/lib/copy/blurbVariantEnforce";
import { hydrateFinalReportBlurbVariants } from "@/lib/reports/hydrateFinalReportBlurbVariants";
import type { AiCopyJson, FinalReportJson } from "@/lib/types";

function baseReport(copy: FinalReportJson["copy"]): FinalReportJson {
  return {
    version: "str_v1",
    template_id: "bold-detailed",
    generated_at: "2026-01-01T00:00:00.000Z",
    agency: {} as FinalReportJson["agency"],
    agent: {} as FinalReportJson["agent"],
    agents: [],
    property: {} as FinalReportJson["property"],
    str: {} as FinalReportJson["str"],
    ltr: {} as FinalReportJson["ltr"],
    copy,
    assets: { qr_code_url: "", pdf_url: "" },
  };
}

const richAiVariants: AiCopyJson["sales_pack_blurb_variants"] = {
  short: "Short paragraph.",
  medium: "Medium paragraph one.\n\nMedium paragraph two.",
  long: "Long paragraph one.\n\nLong paragraph two.\n\nLong paragraph three.",
};

describe("hydrateFinalReportBlurbVariants", () => {
  it("hydrates missing variants from ai_copy_json", () => {
    const hydrated = hydrateFinalReportBlurbVariants(
      baseReport({
        heading: "Heading",
        blurb: "Legacy single paragraph.",
        key_metrics_line: "",
        appeal_points: [],
        supporting_factors: [],
        buyer_checks: [],
        methodology_note: "",
        disclaimer: "",
        comparable_evidence: "",
        comparable_disclaimer: "",
        cta: "",
      }),
      {
        sales_pack_heading: "Heading",
        sales_pack_blurb: "Legacy single paragraph.",
        sales_pack_blurb_variants: richAiVariants,
        key_metrics_line: "",
        property_appeal_points: [],
        performance_supporting_factors: [],
        buyer_checks: [],
        methodology_note: "",
        disclaimer: "",
        confidence_notes: "",
      },
    );

    expect(hydrated.copy.blurb_variants).toEqual(richAiVariants);
    expect(variantTextToParagraphs(hydrated.copy.blurb_variants!.long)).toHaveLength(3);
  });

  it("keeps existing rich variants when ai_copy is absent", () => {
    const existing = richAiVariants!;
    const hydrated = hydrateFinalReportBlurbVariants(
      baseReport({
        heading: "Heading",
        blurb: existing.medium,
        blurb_variants: existing,
        key_metrics_line: "",
        appeal_points: [],
        supporting_factors: [],
        buyer_checks: [],
        methodology_note: "",
        disclaimer: "",
        comparable_evidence: "",
        comparable_disclaimer: "",
        cta: "",
      }),
      null,
    );

    expect(hydrated.copy.blurb_variants).toEqual(existing);
  });
});
