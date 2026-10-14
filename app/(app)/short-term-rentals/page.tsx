import Link from "next/link";
import { StrDashboard } from "@/components/str-appraisals/StrDashboard";
import { listStrAppraisals, requireStrWorkspaceAccess, STR_PAGE_SIZE } from "@/lib/str-appraisals/service";
import { appraisalQuerySchema } from "@/lib/str-appraisals/validation";

export default async function StrWorkspacePage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const { supabase,agency } = await requireStrWorkspaceAccess();
  const parsed = appraisalQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <div className="space-y-4"><h1 className="font-display text-3xl">Short-Term Rentals</h1><p>These appraisal filters are invalid.</p><Link href="/short-term-rentals" className="du-btn du-btn-sm min-h-11">Reset filters</Link></div>;
  const data = await listStrAppraisals(supabase,agency.id,parsed.data);
  let propertyName: string | null = null;
  if (parsed.data.listing_id) {
    const { data:listing } = await supabase.from("listings").select("property_address").eq("id",parsed.data.listing_id).eq("agency_id",agency.id).maybeSingle();
    propertyName = listing?.property_address ?? "selected property";
  }
  return <StrDashboard {...data} filters={parsed.data} pageSize={STR_PAGE_SIZE} propertyName={propertyName} />;
}
