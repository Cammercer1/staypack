import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { viewerSnapshotSchema } from "@/lib/digital-proposals/viewerSnapshot";
import { isProspectPublicSlug } from "./publicLinks";

export async function requireProspectOperator() {
  const context = await requireUser();
  const operator = await context.supabase.from("prospect_operators").select("user_id").eq("user_id", context.user.id).maybeSingle();
  if (operator.error || !operator.data) notFound();
  return context;
}

/** Never return provider payloads, profile sources, operator identity or original listing agents. */
export async function publishedProspectProposal(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return findPublishedProposal("public_token", token);
}

export async function publishedProspectProposalBySlug(slug: string) {
  if (!isProspectPublicSlug(slug)) return null;
  return findPublishedProposal("public_slug", slug);
}

async function findPublishedProposal(column: "public_token" | "public_slug", value: string) {
  const result = await createAdminClient().from("prospect_proposals")
    .select("id,public_slug,final_report_json")
    .eq(column, value).not("published_at", "is", null).is("revoked_at", null).maybeSingle();
  if (result.error) throw new Error("Example proposal temporarily unavailable.");
  if (!result.data) return null;
  return { id: result.data.id as string, public_slug: result.data.public_slug as string | null,
    snapshot: viewerSnapshotSchema.parse(result.data.final_report_json) };
}
