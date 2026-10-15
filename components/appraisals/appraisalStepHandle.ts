export type AppraisalStepSaveResult = "unchanged" | "saved" | "failed";

export type AppraisalStepHandle = {
  savePendingEdits: () => Promise<AppraisalStepSaveResult>;
};
