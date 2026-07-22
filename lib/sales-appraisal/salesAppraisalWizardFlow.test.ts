import { describe, expect, it } from "vitest";
import { getInitialSalesAppraisalWizardStep } from "@/lib/sales-appraisal/salesAppraisalWizardFlow";

const readyDraft = {
  hasFinalReport: false,
  hasTemplate: true,
  hasComps: true,
  hasSelectedComps: true,
  isPublished: false,
};

describe("getInitialSalesAppraisalWizardStep", () => {
  it("starts single-template accounts on appraisal data", () => {
    expect(
      getInitialSalesAppraisalWizardStep({
        ...readyDraft,
        skipTemplateSelection: true,
      }),
    ).toBe("data");
  });

  it("keeps the template chooser for accounts with multiple templates", () => {
    expect(
      getInitialSalesAppraisalWizardStep({
        ...readyDraft,
        hasTemplate: false,
        skipTemplateSelection: false,
      }),
    ).toBe("template");
  });

  it("keeps generated single-template drafts on appraisal data", () => {
    expect(
      getInitialSalesAppraisalWizardStep({
        ...readyDraft,
        hasFinalReport: true,
        skipTemplateSelection: true,
      }),
    ).toBe("data");
  });

  it("opens published reports at preview", () => {
    expect(
      getInitialSalesAppraisalWizardStep({
        ...readyDraft,
        isPublished: true,
        skipTemplateSelection: true,
      }),
    ).toBe("preview");
  });
});
