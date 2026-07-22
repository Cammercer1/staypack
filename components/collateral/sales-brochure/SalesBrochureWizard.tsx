"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  GeneratedBrochureCopyEditor,
  type BrochureCopyEditorHandle,
} from "@/components/collateral/sales-brochure/GeneratedBrochureCopyEditor";
import { SalesBrochureTemplateStep } from "@/components/collateral/sales-brochure/SalesBrochureTemplateStep";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { CollateralPdfButton } from "@/components/collateral/CollateralPdfButton";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import { salesBrochureNeedsRepublish } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import {
  isBrochureDocument,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import type { Agency, AgentProfile, CollateralItem, CollateralType, Listing } from "@/lib/types";

type BrochureCollateralType = Extract<
  CollateralType,
  "sales_brochure" | "rental_brochure"
>;

const BROCHURE_LABELS: Record<BrochureCollateralType, string> = {
  sales_brochure: "Property brochure",
  rental_brochure: "Rental brochure",
};

const steps = [
  { id: "template", label: "Choose template" },
  { id: "copy", label: "Content generation" },
  { id: "preview", label: "Preview & publish" },
];

/** Minimum time the preview sync overlay stays visible so the refresh is perceptible. */
const PREVIEW_SYNC_MIN_MS = 400;

type Props = {
  initialListing: Listing;
  initialCollateral: CollateralItem;
  agency: Agency;
  collateralType?: BrochureCollateralType;
};

export function SalesBrochureWizard({
  initialListing,
  initialCollateral,
  agency,
  collateralType = "sales_brochure",
}: Props) {
  const [listing, setListing] = useState(initialListing);
  const [collateral, setCollateral] = useState(initialCollateral);
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => response.json())
      .then((payload) => setAgencyAgents(payload.agents ?? []))
      .catch(() => {
        // Preview still works with listing agents only.
      });
  }, []);

  const agentProfile = useMemo(() => {
    if (listing.agent_profile_id != null) {
      return (
        agencyAgents.find((agent) => agent.id === listing.agent_profile_id) ?? null
      );
    }

    return agencyAgents.find((agent) => agent.is_default) ?? agencyAgents[0] ?? null;
  }, [agencyAgents, listing.agent_profile_id]);
  const [step, setStep] = useState(getInitialStep(initialCollateral));
  const [loading, setLoading] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "publishing" | "generating-pdf"
  >("idle");
  const copyEditorRef = useRef<BrochureCopyEditorHandle>(null);
  const previewSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewSyncing, setPreviewSyncing] = useState(false);
  const [previewDraftDocument, setPreviewDraftDocument] =
    useState<BrochureDocumentJson | null>(() => {
      const raw = initialCollateral.document_json;
      return raw && isBrochureDocument(raw) ? raw : null;
    });

  useEffect(() => {
    const raw = collateral.document_json;
    if (raw && isBrochureDocument(raw)) {
      setPreviewDraftDocument(raw);
    }
  }, [collateral.document_json]);

  useEffect(() => {
    return () => {
      if (previewSyncTimeoutRef.current) {
        clearTimeout(previewSyncTimeoutRef.current);
      }
    };
  }, []);

  function handleStepChange(next: string) {
    if (next === "preview") {
      if (step === "preview") {
        return;
      }

      copyEditorRef.current?.flushPendingEdits();
      const liveDocument = copyEditorRef.current?.getPreviewDocument();
      if (liveDocument) {
        setPreviewDraftDocument(liveDocument);
      }

      if (previewSyncTimeoutRef.current) {
        clearTimeout(previewSyncTimeoutRef.current);
      }
      setPreviewSyncing(true);
      setStep("preview");
      previewSyncTimeoutRef.current = setTimeout(() => {
        previewSyncTimeoutRef.current = null;
        setPreviewSyncing(false);
      }, PREVIEW_SYNC_MIN_MS);
      return;
    }

    if (previewSyncTimeoutRef.current) {
      clearTimeout(previewSyncTimeoutRef.current);
      previewSyncTimeoutRef.current = null;
    }
    setPreviewSyncing(false);
    setStep(next);
  }

  const previewDocument = useMemo((): BrochureDocumentJson | null => {
    const doc = previewDraftDocument;
    if (!doc || !isBrochureDocument(doc)) {
      return null;
    }

    return doc;
  }, [previewDraftDocument]);

  const hasDownloadablePdf = Boolean(collateral.pdf_url);
  const needsRepublish = salesBrochureNeedsRepublish(collateral);
  const showDownload = hasDownloadablePdf && !needsRepublish;
  const showPublish = !showDownload;

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

    toast.success(`${BROCHURE_LABELS[collateralType]} published`);
    setLoading(false);
    setPublishStage("idle");
  }

  return (
    <div className="space-y-6">
      <Tabs value={step} onValueChange={handleStepChange}>
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
            collateralType={collateralType}
            onCollateralChange={setCollateral}
            onContinue={() => setStep("copy")}
          />
        </TabsContent>

        <TabsContent value="copy">
          {collateral.template_id ? (
            <GeneratedBrochureCopyEditor
              ref={copyEditorRef}
              agency={agency}
              listing={listing}
              collateral={collateral}
              agencyAgents={agencyAgents}
              agentProfile={agentProfile}
              onCollateralChange={setCollateral}
              onContinueToPreview={() => handleStepChange("preview")}
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
            active={loading || previewSyncing}
            title={
              previewSyncing
                ? "Preparing preview"
                : publishStage === "generating-pdf"
                  ? "Generating PDF"
                  : "Publishing brochure"
            }
            description={
              previewSyncing
                ? "Syncing your latest edits…"
                : publishStage === "generating-pdf"
                  ? "Rendering your print-ready brochure. This can take 15–30 seconds."
                  : "Saving the published brochure."
            }
          >
            {previewSyncing ? (
              <div
                className="min-h-[min(80vh,900px)] rounded-xl border border-transparent"
                aria-hidden
              />
            ) : previewDocument ? (
              <FittedBrochurePreview
                document={previewDocument}
                listing={listing}
                agencyAgents={agencyAgents}
                agentProfile={agentProfile}
                collateralType={collateralType}
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
            {showDownload ? (
              <CollateralPdfButton
                collateralId={collateral.id}
                url={collateral.pdf_url}
                canGenerate={false}
                cacheVersion={collateral.updated_at}
                size="default"
                downloadLabel="Download asset"
                onUpdated={setCollateral}
              />
            ) : null}
            {showDownload && collateral.public_url ? (
              <CopyLinkButton url={collateral.public_url} />
            ) : null}
            {showPublish ? (
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
                ) : collateral.status === "published" || needsRepublish ? (
                  "Republish brochure"
                ) : (
                  "Publish brochure"
                )}
              </Button>
            ) : null}
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
