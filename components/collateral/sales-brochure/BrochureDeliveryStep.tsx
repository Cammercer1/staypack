"use client";
import { useState } from "react";
import { DocumentDeliveryStep } from "@/components/documents/DocumentDeliveryStep";
import { DocumentLinkEditor } from "@/components/documents/DocumentLinkEditor";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { salesBrochureNeedsRepublish } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { CollateralItem } from "@/lib/types";

export function BrochureDeliveryStep({
  collateral,
  document,
  onCollateralChange,
  onEdit,
  onBusyChange,
}: {
  collateral: CollateralItem;
  document: BrochureDocumentJson;
  onCollateralChange: (collateral: CollateralItem) => void;
  onEdit: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [linkPending, setLinkPending] = useState(false);
  async function prepare(action: "pdf" | "publish") {
    const response = await fetch(
      `/api/collateral/${collateral.id}/${action === "pdf" ? "generate-pdf" : "publish"}`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (!response.ok || !payload.collateral)
      throw new Error(
        payload.error ??
          `Unable to ${action === "pdf" ? "prepare PDF" : "publish brochure"}. Try again.`,
      );
    onCollateralChange(payload.collateral);
  }
  return (
    <DocumentDeliveryStep
      name="brochure"
      preview={
        <FittedBrochurePreview
          document={document}
          useDocumentBrand
          pageLabels={["Cover", "Property details"]}
          maxHeight="min(82vh, 960px)"
        />
      }
      pdfReady={
        Boolean(collateral.pdf_url) && !salesBrochureNeedsRepublish(collateral)
      }
      downloadUrl={`/api/collateral/${collateral.id}/download?v=${encodeURIComponent(collateral.updated_at ?? "")}`}
      publicUrl={collateral.public_url}
      published={collateral.status === "published"}
      hasLinkDraft={Boolean(document.document_link_draft)}
      linkPending={linkPending}
      onPreparePdf={() => prepare("pdf")}
      onPublish={() => prepare("publish")}
      onEdit={onEdit}
      onBusyChange={onBusyChange}
      renderLinkEditor={(busy) => (
        <DocumentLinkEditor
          document={document}
          endpoint={`/api/collateral/${collateral.id}/link`}
          disabled={busy}
          onPendingChange={setLinkPending}
          onSaved={(payload) =>
            onCollateralChange(payload.collateral as CollateralItem)
          }
        />
      )}
    />
  );
}
