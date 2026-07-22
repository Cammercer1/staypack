import { describe, expect, it } from "vitest";
import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  DEFAULT_REPORT_TEMPLATE_ID,
  isSelectableStrTemplateId,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";

describe("normalizeReportTemplateId", () => {
  it("aliases deprecated light ids to detailed", () => {
    expect(normalizeReportTemplateId("classic-light")).toBe(
      CLASSIC_DETAILED_TEMPLATE_ID,
    );
    expect(normalizeReportTemplateId("minimalist-light")).toBe(
      "minimalist-detailed",
    );
  });

  it("aliases legacy classic to classic-detailed", () => {
    expect(normalizeReportTemplateId("classic")).toBe(CLASSIC_DETAILED_TEMPLATE_ID);
  });

  it("defaults unknown ids to minimalist-detailed", () => {
    expect(normalizeReportTemplateId("not-a-template")).toBe(
      DEFAULT_REPORT_TEMPLATE_ID,
    );
  });

  it("keeps the OC lease appraisal template id", () => {
    expect(normalizeReportTemplateId("oc-real-estate-lease-appraisal")).toBe(
      "oc-real-estate-lease-appraisal",
    );
  });
});

describe("isSelectableStrTemplateId", () => {
  it("accepts detailed platform STR templates", () => {
    expect(isSelectableStrTemplateId("refined-detailed")).toBe(true);
    expect(isSelectableStrTemplateId("haven-properties-str")).toBe(true);
  });

  it("rejects deprecated light ids", () => {
    expect(isSelectableStrTemplateId("classic-light")).toBe(false);
    expect(isSelectableStrTemplateId("classic")).toBe(false);
  });

  it("rejects lease appraisal templates", () => {
    expect(isSelectableStrTemplateId("classic-lease-appraisal")).toBe(false);
    expect(isSelectableStrTemplateId("oc-real-estate-lease-appraisal")).toBe(
      false,
    );
  });
});
