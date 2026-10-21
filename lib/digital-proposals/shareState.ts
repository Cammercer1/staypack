import { z } from "zod";
import type { ProposalVersionSummary, ProposalWorkspace } from "./workspace";

const publicationConfirmationSchema = z.object({
  versionId: z.string().min(1).max(128),
  path: z.string().regex(/^\/proposal\/[a-f0-9]{64}$/),
  revision: z.number().int().nonnegative(),
  sourceFingerprint: z.string().min(1).max(256),
}).strict();
export type PublicationConfirmation = z.infer<typeof publicationConfirmationSchema>;
export type PublicationState = "private" | "changes" | "current" | "unverified";

export function publicationReceiptKey(editorPath: string) {
  return `staypack:proposal-publication:${editorPath}`;
}

/** A receipt only records a successful response; fresh workspace data must still match. */
export function parsePublicationReceipt(raw: string | null): PublicationConfirmation | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const parsed = publicationConfirmationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

/** The live link can point to an older, reused snapshot; creation order is not publication order. */
export function currentProposalPublication(workspace: Pick<ProposalWorkspace, "versions" | "shareLink">): ProposalVersionSummary | undefined {
  const link = workspace.shareLink;
  if (link) {
    const version = workspace.versions.find(item => item.id === link.versionId && !item.revoked_at);
    if (!version || link.revoked_at) return undefined;
    return { ...version, path: link.path, link_id: link.id, draft_revision: link.draft_revision, source_fingerprint: link.source_fingerprint };
  }
  const legacy = workspace.versions.find(version => !version.revoked_at);
  return legacy ? { ...legacy, path: legacy.path.split("?")[0] } : undefined;
}

/** Missing legacy metadata cannot establish that a published snapshot matches the draft. */
export function proposalPublicationState(workspace: Pick<ProposalWorkspace, "revision" | "sourceFingerprint">, latest: ProposalVersionSummary | undefined, hasUnsavedChanges = false, confirmation?: PublicationConfirmation | null): PublicationState {
  if (!latest || latest.revoked_at) return "private";
  if (hasUnsavedChanges) return "changes";
  // Publication may reuse an identical snapshot whose original metadata is older.
  if (confirmation?.versionId === latest.id && confirmation.path === latest.path && confirmation.revision === workspace.revision && confirmation.sourceFingerprint === workspace.sourceFingerprint) return "current";
  if (latest.draft_revision !== workspace.revision) return "changes";
  if (!latest.source_fingerprint || !workspace.sourceFingerprint) return "unverified";
  return latest.source_fingerprint === workspace.sourceFingerprint ? "current" : "changes";
}

export const PDF_STATUS_POLL_DELAYS = [2_000, 4_000, 8_000, 16_000, 30_000, 30_000] as const;
