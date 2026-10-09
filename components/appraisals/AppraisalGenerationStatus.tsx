import { DocumentGenerationStatus } from "@/components/documents/DocumentGenerationStatus";

export function AppraisalGenerationStatus() {
  return (
    <DocumentGenerationStatus
      title="Writing your appraisal"
      description="Your reviewed figures and selected comparables are saved."
      headline="Turning evidence into a report"
      body="We’re preparing the appraisal wording and placing it in your chosen design. You can edit everything on the next screen."
      savedLabel="Design and evidence saved"
      activeLabel="Writing and laying out your appraisal…"
    />
  );
}
