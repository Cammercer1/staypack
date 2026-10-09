import { generateQrCodeBuffer } from "@/lib/reports/qr";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDocumentLinkTarget, type DocumentLink, type DocumentLinkDraft } from "./documentLink";

export async function createDocumentLinkDraft({ link, agencyId, documentId, reportUrl }: {
  link: DocumentLink;
  agencyId: string;
  documentId: string;
  reportUrl?: string;
}): Promise<DocumentLinkDraft> {
  const target = resolveDocumentLinkTarget(link, reportUrl);
  if (!target) return { link, target_url: "", qr_code_url: "" };
  const buffer = await generateQrCodeBuffer(target);
  const storage = createAdminClient().storage.from("report-assets");
  const path = `${agencyId}/${documentId}/qr-${crypto.randomUUID()}.png`;
  const { error } = await storage.upload(path, buffer, { contentType: "image/png", upsert: false });
  if (error) throw new Error(error.message);
  return { link, target_url: target, qr_code_url: storage.getPublicUrl(path).data.publicUrl };
}
