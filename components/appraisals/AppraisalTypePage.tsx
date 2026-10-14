import Link from "next/link";
import { requireAgency } from "@/lib/auth/requireUser";
import { listWorkspaceAppraisals } from "@/lib/appraisals/workspace";
import { appraisalKindLabels, workspaceQuerySchema } from "@/lib/appraisals/workspaceTypes";
import { StrDashboard } from "@/components/str-appraisals/StrDashboard";

export async function AppraisalTypePage({ kind, searchParams }: {
  kind: "lease" | "sales";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agency, supabase } = await requireAgency();
  const parsed = workspaceQuerySchema.safeParse({ ...await searchParams, kind });
  const basePath = `/appraisals/${kind === "lease" ? "rental" : "sales"}`;
  if (!parsed.success) return <div className="space-y-4"><h1 className="font-display text-3xl">{appraisalKindLabels[kind]} appraisals</h1><p>These appraisal filters are invalid.</p><Link href={basePath} className="du-btn du-btn-sm min-h-11">Reset filters</Link></div>;
  const data = await listWorkspaceAppraisals(supabase, agency.id, parsed.data);
  let propertyName: string | null = null;
  if (parsed.data.listing_id) {
    const { data: listing } = await supabase.from("listings").select("property_address").eq("id", parsed.data.listing_id).eq("agency_id", agency.id).maybeSingle();
    propertyName = listing?.property_address ?? "selected property";
  }
  const counts = { draft: data.counts.draft ?? 0, ready: data.counts.ready ?? 0, published: data.counts.published ?? 0, failed: data.counts.failed ?? 0, archived: data.counts.archived ?? 0 };
  return <StrDashboard {...data} kind={kind} counts={counts} filters={parsed.data} pageSize={20} propertyName={propertyName} />;
}
