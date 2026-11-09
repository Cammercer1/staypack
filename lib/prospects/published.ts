import "server-only";
import { z } from "zod";
import { databaseRequest } from "@/lib/supabase/rest";
import { viewerSnapshotSchema } from "@/lib/digital-proposals/viewerSnapshot";
import { LOADING_BRAND_SELECT, loadingBrandSchema } from "@/lib/digital-proposals/loadingBrand";
import { isProspectPublicSlug } from "./publicLinks";

type Lookup = "public_token" | "public_slug";
const accessSchema = z.object({ id: z.uuid(), public_slug: z.string().nullable(), published_at: z.string().min(1) });
const isValid = (column: Lookup, value: string) => column === "public_token" ? /^[a-f0-9]{64}$/.test(value) : isProspectPublicSlug(value);

/** Cached branding is decorative only: it never authorizes or includes report content. */
export async function prospectLoadingBrand(column: Lookup, value: string) {
  if (!isValid(column, value)) return null;
  const { url, headers } = databaseRequest("prospect_proposals", {
    select: LOADING_BRAND_SELECT, [column]: `eq.${value}`, published_at: "not.is.null", revoked_at: "is.null", limit: "1",
  });
  try {
    const response = await fetch(url, { headers, cache: "force-cache", next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const rows = await response.json();
    return loadingBrandSchema.safeParse(rows[0]).data ?? null;
  } catch { return null; } // A decorative failure must not bypass the authoritative reader.
}

export async function publishedProspectProposal(token: string, fetcher: typeof fetch = fetch) {
  return isValid("public_token", token) ? findPublishedProposal("public_token", token, fetcher) : null;
}
export async function publishedProspectProposalBySlug(slug: string, fetcher: typeof fetch = fetch) {
  return isValid("public_slug", slug) ? findPublishedProposal("public_slug", slug, fetcher) : null;
}

async function findPublishedProposal(column: Lookup, value: string, fetcher: typeof fetch) {
  const access = databaseRequest("prospect_proposals", {
    select: "id,public_slug,published_at", [column]: `eq.${value}`,
    published_at: "not.is.null", revoked_at: "is.null", limit: "1",
  });
  // No CDN, Next Data Cache or stale-on-error fallback may cache an access decision.
  const response = await fetcher(access.url, { headers: access.headers, cache: "no-store" });
  if (!response.ok) throw new Error("Example proposal temporarily unavailable.");
  const rows = await response.json();
  if (!rows.length) return null;
  const row = accessSchema.parse(rows[0]);
  const content = databaseRequest("prospect_proposals", {
    select: "final_report_json", id: `eq.${row.id}`, published_at: `eq.${row.published_at}`, limit: "1",
  });
  // Frozen content is cached separately, keyed by record + publication. Both URL forms share it.
  const snapshotResponse = await fetcher(content.url, { headers: content.headers, cache: "force-cache", next: { revalidate: 86400 } });
  if (!snapshotResponse.ok) throw new Error("Example proposal temporarily unavailable.");
  const snapshots = await snapshotResponse.json();
  if (!snapshots.length) return null;
  return { id: row.id, public_slug: row.public_slug, snapshot: viewerSnapshotSchema.parse(snapshots[0].final_report_json) };
}
