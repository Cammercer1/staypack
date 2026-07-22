export const SALES_APPRAISAL_WIZARD_STEPS = [
  { id: "template", label: "Choose template" },
  { id: "data", label: "Appraisal data" },
  { id: "copy", label: "Content generation" },
  { id: "preview", label: "Preview & publish" },
] as const;

export type SalesAppraisalWizardStep =
  (typeof SALES_APPRAISAL_WIZARD_STEPS)[number]["id"];

type InitialStepInput = {
  hasFinalReport: boolean;
  hasTemplate: boolean;
  hasComps: boolean;
  hasSelectedComps: boolean;
  isPublished: boolean;
  skipTemplateSelection: boolean;
};

export function getInitialSalesAppraisalWizardStep({
  hasFinalReport,
  hasTemplate,
  hasComps,
  hasSelectedComps,
  isPublished,
  skipTemplateSelection,
}: InitialStepInput): SalesAppraisalWizardStep {
  if (isPublished) {
    return "preview";
  }

  if (skipTemplateSelection) {
    return "data";
  }

  if (hasFinalReport) {
    return "preview";
  }

  if (!hasTemplate) {
    return skipTemplateSelection ? "data" : "template";
  }

  if (!hasComps || !hasSelectedComps) {
    return "data";
  }

  return "copy";
}
