export const SALES_APPRAISAL_WIZARD_STEPS = [
  { id: "template", label: "Design" },
  { id: "data", label: "Review evidence" },
  { id: "copy", label: "Edit report" },
  { id: "preview", label: "Download & share" },
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

  if (hasFinalReport) {
    return "preview";
  }

  if (skipTemplateSelection) {
    return "data";
  }

  if (!hasTemplate) {
    return skipTemplateSelection ? "data" : "template";
  }

  if (!hasComps || !hasSelectedComps) {
    return "data";
  }

  return "copy";
}
