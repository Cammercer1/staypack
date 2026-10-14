import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { browserlessRequest, hasBrowserlessConfig } from "@/lib/browserless/client";
import { renderPdfFromUrl, buildPdfImagePath, buildPdfStylesheetPath } from "@/lib/browserless/pdf";
import { proposalPrintOrigin } from "./printOrigin";
import { proposalPrintUrl } from "./printAccess";
import { proposalPrintHtml } from "./print";
import { proposalSnapshotSchema, isPdf } from "./workspace";
import { ProposalError } from "./server";
export async function prepareProposalPdf(agencyId: string, reportId: string, versionId: string, requestUrl?: string) {
  const admin = createAdminClient();
  const version = await admin.from("digital_proposal_versions").select("id,final_report_json,pdf_status,pdf_path")
    .eq("agency_id", agencyId).eq("report_id", reportId).eq("id", versionId).is("revoked_at", null).maybeSingle();
  if (version.error || !version.data) throw new ProposalError("Proposal version not found.", 404);
  if (version.data.pdf_status === "ready") return "ready" as const;
  const claim = await admin.from("digital_proposal_versions").update({ pdf_status: "generating", pdf_started_at: new Date().toISOString() })
    .eq("id", versionId).or(`pdf_status.in.(pending,failed),and(pdf_status.eq.generating,pdf_started_at.lt.${new Date(Date.now() - 180_000).toISOString()})`).select("id").maybeSingle();
  if (claim.error) throw new ProposalError("Unable to prepare the PDF.", 500);
  if (!claim.data) return "generating" as const;
  try {
    if (!hasBrowserlessConfig()) throw new Error("PDF renderer not configured");
    const snapshot = proposalSnapshotSchema.parse(version.data.final_report_json);
    // DEPLOY_URL is a build-time variable and can be a CLI placeholder at runtime.
    const base = proposalPrintOrigin(requestUrl);
    const buffer = snapshot.pdfReport ? await renderPdfFromUrl(proposalPrintUrl(versionId, base), {
      mirrorImage: async (url, bytes, contentType) => {
        const path = buildPdfImagePath(agencyId, versionId, url, contentType);
        const result = await admin.storage.from("report-assets").upload(path, bytes, { contentType, upsert: true });
        return result.error ? null : admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
      },
      mirrorStylesheet: async (url, bytes, contentType) => {
        const path = buildPdfStylesheetPath(agencyId, versionId, url);
        const result = await admin.storage.from("report-assets").upload(path, bytes, { contentType, upsert: true });
        return result.error ? null : admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
      },
    }) : await browserlessRequest("/pdf", {
      html: proposalPrintHtml(snapshot), emulateMediaType: "print",
      options: { format: "A4", printBackground: true, preferCSSPageSize: true },
      gotoOptions: { waitUntil: "networkidle0", timeout: 60000 },
      waitForFunction: { fn: "() => Array.from(document.images).every(image => image.complete)", timeout: 20000 },
    }, { responseType: "buffer", errorContext: "pdf", timeoutMs: 100_000 });
    if (!buffer || !Buffer.isBuffer(buffer) || !isPdf(buffer)) throw new Error("Invalid PDF response");
    const path = `${agencyId}/${reportId}/${versionId}.pdf`;
    const upload = await admin.storage.from("proposal-pdfs").upload(path, buffer, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error("PDF storage failed");
    const saved = await admin.from("digital_proposal_versions").update({ pdf_status: "ready", pdf_path: path }).eq("id", versionId);
    if (saved.error) throw new Error("PDF status update failed");
    return "ready" as const;
  } catch (error) {
    // Do not log renderer payloads, signed print URLs or private report contents.
    console.error("Proposal PDF preparation failed", { versionId, errorName: error instanceof Error ? error.name : "UnknownError" });
    await admin.from("digital_proposal_versions").update({ pdf_status: "failed" }).eq("id", versionId);
    throw new ProposalError("Your digital proposal is live. The PDF could not be prepared; try again.", 503);
  }
}
