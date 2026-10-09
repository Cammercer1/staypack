"use client";
import { DocumentTemplateGallery } from "@/components/documents/DocumentTemplateGallery";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import type { TemplateProduct } from "@/lib/templates/types";
import type { FinalReportJson } from "@/lib/types";

export function AppraisalTemplateGallery({
  previewForTemplate,
  ...props
}: {
  product: TemplateProduct;
  initialTemplates?: TemplatesResponse;
  value: string;
  onChange: (id: string) => void;
  previewForTemplate: (id: string) => FinalReportJson | null;
  disabled?: boolean;
  onReady: (ready: boolean) => void;
}) {
  return (
    <DocumentTemplateGallery
      {...props}
      description="Your branding, photos and agent details are included. The wording shown here is a sample; your appraisal is written after you review the evidence."
      renderPreview={(id) => {
        const preview = previewForTemplate(id);
        return preview ? (
          <FittedReportPreview
            report={preview}
            thumbnail
            maxHeight="170px"
            className="rounded-none border-0 shadow-none"
          />
        ) : null;
      }}
    />
  );
}
