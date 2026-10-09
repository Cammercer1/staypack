import { DocumentGenerationStatus } from "@/components/documents/DocumentGenerationStatus";

export function BrochureGenerationStatus() {
  return (
    <DocumentGenerationStatus
      title="Writing your brochure"
      description="Your design is saved. We’re using this listing’s property details."
      headline="Turning your listing into a brochure"
      body="We’re preparing the wording and placing your photos in the chosen layout. You can edit the text and replace photos on the next screen."
      savedLabel="Brochure design saved"
      activeLabel="Writing and laying out your brochure…"
    />
  );
}
