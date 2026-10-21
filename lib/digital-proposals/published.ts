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

/** Fresh scoped joins preserve revocation and archive boundaries on every request. */
export async function publishedProposalAccess(token: string, versionId?: string): Promise<{
  id: string; agency_id: string; report_id: string; content_hash: string | null;
  pdf_status: "pending" | "generating" | "ready" | "failed"; pdf_path: string | null; linkId: string; legacy: boolean;
}> {
  if (!/^[a-f0-9]{64}$/.test(token) || (versionId !== undefined && !z.uuid().safeParse(versionId).success)) {
    throw new ProposalError("Proposal not available.", 404);
  }
  const versionFields = "id,agency_id,report_id,content_hash,pdf_status,pdf_path,report:reports!inner(agency_id,listing:listings!inner(agency_id))";
  const scope = { "version.revoked_at": "is.null", "version.report.status": "neq.archived", "version.report.listing.status": "neq.archived", limit: "1" };
  const request = versionId ? databaseRequest("digital_proposal_link_versions", {
    select: `link:digital_proposal_links!inner(id),version:digital_proposal_versions!inner(${versionFields})`,
    "link.token": `eq.${token}`, "link.revoked_at": "is.null", version_id: `eq.${versionId}`, ...scope,
  }) : databaseRequest("digital_proposal_links", {
    select: `id,version:digital_proposal_versions!digital_proposal_links_agency_id_report_id_version_id_fkey!inner(${versionFields})`, token: `eq.${token}`, revoked_at: "is.null", ...scope,
  });
  const response = await fetch(request.url, { headers: request.headers, cache: "no-store" });
  if (!response.ok) {
    // Before migration, legacy tokens remain readable but cannot authorize any other snapshot.
    const error = await response.json().catch(() => null);
    if (versionId && ["42P01", "PGRST200", "PGRST205"].includes(error?.code)) {
      const current = await publishedProposalAccess(token);
      if (current.id !== versionId) throw new ProposalError("Proposal not available.", 404);
      return { ...current, legacy: true };
    }
    throw new ProposalError("Proposal temporarily unavailable. Please try again.", 503);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new ProposalError("Proposal not available.", 404);
  const row = versionId ? { id: rows[0].link?.id, version: rows[0].version } : rows[0];
  const { id: linkId, version } = accessSchema.parse(row);
  if ((versionId && version.id !== versionId) || version.agency_id !== version.report.agency_id || version.agency_id !== version.report.listing.agency_id) {
    throw new ProposalError("Proposal not available.", 404);
  }
  const { id, agency_id, report_id, content_hash, pdf_status, pdf_path } = version;
  return { id, agency_id, report_id, content_hash, pdf_status, pdf_path, linkId, legacy: false };
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

export async function publishedProposal(token: string, versionId?: string) {
  const access = await publishedProposalAccess(token, versionId);
  const snapshot = await cachedProposalSnapshot(access.id, access.content_hash);
  return { ...access, snapshot };
}
