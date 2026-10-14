import { z } from "zod";
import { attachmentSchema, viewerSnapshotSchema } from "./viewerSnapshot";
import { proposalDataSchema } from "./data";
import type { ProposalAssignment } from "./assignment";
import type { ProposalAgentOption } from "./agents";
import { proposalDraftSchema } from "./template";
import { proposalPdfReportSchema } from "./pdfReport";

export { attachmentSchema } from "./viewerSnapshot";
export type ProposalAttachment = z.infer<typeof attachmentSchema>;
export type ProposalAttachmentLink = ProposalAttachment & { href: string };
export const proposalSnapshotSchema = viewerSnapshotSchema.extend({ pdfReport: proposalPdfReportSchema.optional() }).strict();
export type ProposalSnapshot = z.infer<typeof proposalSnapshotSchema>;
export type ProposalVersionSummary = { id: string; draft_revision: number; created_at: string; revoked_at: string | null; path: string; link_id?: string; pdf_status?: "pending" | "generating" | "ready" | "failed"; source_fingerprint?: string };
export type ProposalWorkspace = {
  draft: z.infer<typeof proposalDraftSchema> | null; revision: number;
  attachments: ProposalAttachment[]; versions: ProposalVersionSummary[]; sourceFingerprint: string;
  assignment?: ProposalAssignment; data?: z.infer<typeof proposalDataSchema>;
  availableAgents?: ProposalAgentOption[];
};
export const shareTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const MAX_PROPOSAL_PDF_BYTES = 4 * 1024 * 1024;

export function safeDocumentName(name: string) {
  return name.replace(/[\x00-\x1f\x7f/\\]/g, "").trim().slice(0, 200) || "Document.pdf";
}
export function isPdf(bytes: Uint8Array) {
  return bytes.length > 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}
