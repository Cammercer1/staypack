import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
export { publishedProspectProposal, publishedProspectProposalBySlug } from "./published";

export async function requireProspectOperator() {
  const context = await requireUser();
  const operator = await context.supabase.from("prospect_operators").select("user_id").eq("user_id", context.user.id).maybeSingle();
  if (operator.error || !operator.data) notFound();
  return context;
}
