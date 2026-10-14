import "server-only";
import { z } from "zod";
import { ProposalError } from "./errors";
import { viewerSnapshotSchema } from "./viewerSnapshot";

export { ProposalError } from "./errors";

const accessSchema = z.object({
  id: z.uuid(),
  version: z.object({
    id: z.uuid(), agency_id: z.uuid(), report_id: z.uuid(), content_hash: z.string().nullable(),
    pdf_status: z.enum(["pending", "generating", "ready", "failed"]), pdf_path: z.string().nullable(),
    report: z.object({ agency_id: z.uuid(), listing: z.object({ agency_id: z.uuid() }) }),
  }),
});

function databaseRequest(table: string, query: Record<string, string>) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Missing Supabase service role configuration");
  return {
    url: `${base}/rest/v1/${table}?${new URLSearchParams(query)}`,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

/** One uncached join preserves revocation, archive and agency boundaries on every visit. */
export async function publishedProposalAccess(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ProposalError("Proposal not available.", 404);
  const { url, headers } = databaseRequest("digital_proposal_links", {
    select: "id,version:digital_proposal_versions!inner(id,agency_id,report_id,content_hash,pdf_status,pdf_path,report:reports!inner(agency_id,listing:listings!inner(agency_id)))",
    token: `eq.${token}`, revoked_at: "is.null", "version.revoked_at": "is.null",
    "version.report.status": "neq.archived", "version.report.listing.status": "neq.archived", limit: "1",
  });
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) throw new ProposalError("Proposal temporarily unavailable. Please try again.", 503);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new ProposalError("Proposal not available.", 404);
  const { id: linkId, version } = accessSchema.parse(rows[0]);
  if (version.agency_id !== version.report.agency_id || version.agency_id !== version.report.listing.agency_id) {
    throw new ProposalError("Proposal not available.", 404);
  }
  const { id, agency_id, report_id, content_hash, pdf_status, pdf_path } = version;
  return { id, agency_id, report_id, content_hash, pdf_status, pdf_path, linkId };
}

/** Internal cache only; this function never grants public access on its own. */
export async function cachedProposalSnapshot(versionId: string, contentHash: string | null) {
  const { url, headers } = databaseRequest("digital_proposal_versions", {
    id: `eq.${versionId}`, ...(contentHash ? { content_hash: `eq.${contentHash}` } : {}),
    select: "version:final_report_json->version,data:final_report_json->data,draft:final_report_json->draft,brand:final_report_json->brand,attachments:final_report_json->attachments,assignment:final_report_json->assignment",
    limit: "1",
  });
  // Native Next Data Cache works with this app's existing (non-Cache-Components) setup.
  // Mutable PDF status and access checks above must never enter this cache.
  const response = await fetch(url, { headers, cache: "force-cache", next: { revalidate: 86400 } });
  if (!response.ok) throw new ProposalError("Proposal temporarily unavailable. Please try again.", 503);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new ProposalError("Proposal not available.", 404);
  const row = rows[0];
  return viewerSnapshotSchema.parse({ ...row, assignment: row.assignment ?? undefined });
}

export async function publishedProposal(token: string) {
  const access = await publishedProposalAccess(token);
  const snapshot = await cachedProposalSnapshot(access.id, access.content_hash);
  return { ...access, snapshot };
}
