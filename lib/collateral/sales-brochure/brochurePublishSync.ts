import {
  isBrochureDocument,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import type { CollateralItem } from "@/lib/types";

/** Mark brochure content as edited (call on every content save). */
export function withBrochureContentSaved(
  document: BrochureDocumentJson,
  savedAt = new Date().toISOString(),
): BrochureDocumentJson {
  return {
    ...document,
    content_saved_at: savedAt,
  };
}

/** Mark the current PDF as reflecting the saved brochure content. */
export function withBrochurePdfSynced(
  document: BrochureDocumentJson,
  syncedAt?: string,
): BrochureDocumentJson {
  const at = syncedAt ?? document.content_saved_at ?? new Date().toISOString();
  return {
    ...document,
    pdf_synced_at: at,
  };
}

export function salesBrochureNeedsRepublish(collateral: CollateralItem): boolean {
  if (!collateral.pdf_url) {
    return true;
  }

  const document = collateral.document_json;
  if (!document || !isBrochureDocument(document)) {
    return false;
  }

  const { content_saved_at, pdf_synced_at } = document;
  if (content_saved_at && !pdf_synced_at) {
    return true;
  }
  if (content_saved_at && pdf_synced_at) {
    return (
      new Date(content_saved_at).getTime() > new Date(pdf_synced_at).getTime()
    );
  }

  // Legacy rows: fall back to row timestamps with slack for trigger ordering.
  if (!collateral.generated_at || !collateral.updated_at) {
    return false;
  }

  const slackMs = 3_000;
  return (
    new Date(collateral.updated_at).getTime() -
      new Date(collateral.generated_at).getTime() >
    slackMs
  );
}
