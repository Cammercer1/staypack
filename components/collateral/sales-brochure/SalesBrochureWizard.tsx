"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GeneratedBrochureCopyEditor } from "@/components/collateral/sales-brochure/GeneratedBrochureCopyEditor";
import { SalesBrochureTemplateStep } from "@/components/collateral/sales-brochure/SalesBrochureTemplateStep";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { CollateralPdfButton } from "@/components/collateral/CollateralPdfButton";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import {
  isSalesBrochureDocument,
  type SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import type { Agency, CollateralItem, Listing } from "@/lib/types";

const steps = [
  { id: "template", label: "Choose template" },
  { id: "copy", label: "Content generation" },
  { id: "preview", label: "Preview & publish" },
];

type Props = {
  initialListing: Listing;
  initialCollateral: CollateralItem;
  agency: Agency;
};

export function SalesBrochureWizard({
  initialListing,
  initialCollateral,
  agency,
}: Props) {
  const [listing] = useState(initialListing);
  const [collateral, setCollateral] = useState(initialCollateral);
  const [step, setStep] = useState(getInitialStep(initialCollateral));
  const [loading, setLoading] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "publishing" | "generating-pdf"
  >("idle");

  const previewDocument = useMemo((): SalesBrochureDocumentJson | null => {
    const raw = collateral.document_json;
    if (!raw || !isSalesBrochureDocument(raw)) {
      return null;
    }

    return raw;
  }, [collateral.document_json]);

  async function publishBrochure() {
    setLoading(true);
    setPublishStage("publishing");

    const publishResponse = await fetch(`/api/collateral/${collateral.id}/publish`, {
      method: "POST",
    });
    const publishPayload = await publishResponse.json();

    if (!publishResponse.ok) {
      toast.error(publishPayload.error ?? "Publish failed");
      setLoading(false);
      setPublishStage("idle");
      return;
    }

    if (publishPayload.collateral) {
      setCollateral(publishPayload.collateral);
    }

    setPublishStage("generating-pdf");
    const pdfResponse = await fetch(`/api/collateral/${collateral.id}/generate-pdf`, {
      method: "POST",
    });
    const pdfPayload = await pdfResponse.json();

    if (!pdfResponse.ok) {
      toast.error(pdfPayload.error ?? "PDF generation failed");
      setLoading(false);
      setPublishStage("idle");
      return;
    }

    if (pdfPayload.collateral) {
      setCollateral(pdfPayload.collateral);
    }

    toast.success("Sales brochure published");
    setLoading(false);
    setPublishStage("idle");
  }

  return (
    <div className="space-y-6">
      <Tabs value={step} onValueChange={setStep}>
        <TabsList className="grid w-full grid-cols-3">
          {steps.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="template">
          <SalesBrochureTemplateStep
            agency={agency}
            listing={listing}
            collateral={collateral}
            onCollateralChange={setCollateral}
            onContinue={() => setStep("copy")}
          />
        </TabsContent>

        <TabsContent value="copy">
          {collateral.template_id ? (
            <GeneratedBrochureCopyEditor
              agency={agency}
              listing={listing}
              collateral={collateral}
              onCollateralChange={setCollateral}
              onContinueToPreview={() => setStep("preview")}
            />
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <p>Choose a brochure template before generating content.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setStep("template")}
              >
                Back to choose template
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <AsyncLoadingOverlay
            active={loading}
            title={
              publishStage === "generating-pdf"
                ? "Generating PDF"
                : "Publishing brochure"
            }
            description={
              publishStage === "generating-pdf"
                ? "Rendering your print-ready brochure. This can take 15–30 seconds."
                : "Saving the published brochure."
            }
          >
            {previewDocument ? (
              <FittedBrochurePreview
                document={previewDocument}
                maxHeight="min(80vh, 900px)"
                fitToWidth
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate collateral first to preview the brochure.
              </p>
            )}
          </AsyncLoadingOverlay>

          <div className="flex flex-wrap gap-3 no-print">
            <CollateralPdfButton
              collateralId={collateral.id}
              url={collateral.pdf_url}
              canGenerate={Boolean(previewDocument) && !loading}
              generatedAt={collateral.generated_at}
              updatedAt={collateral.updated_at}
              cacheVersion={collateral.updated_at}
              size="default"
              downloadLabel="Download asset"
              onUpdated={setCollateral}
            />
            {collateral.public_url ? (
              <CopyLinkButton url={collateral.public_url} />
            ) : null}
            <Button
              onClick={publishBrochure}
              disabled={loading || !previewDocument}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {publishStage === "generating-pdf"
                    ? "Generating PDF..."
                    : "Publishing..."}
                </>
              ) : collateral.status === "published" ? (
                "Republish brochure"
              ) : (
                "Publish brochure"
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getInitialStep(collateral: CollateralItem) {
  if (collateral.status === "published" || collateral.document_json) {
    return "preview";
  }

  if (collateral.template_id) {
    return "copy";
  }

  return "template";
}
