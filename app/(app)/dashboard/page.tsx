import { requireAgency } from "@/lib/auth/requireUser";
import { listWorkspaceAppraisals } from "@/lib/appraisals/list";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
export default async function DashboardPage() {
  const { supabase, agency } = await requireAgency();
  const result = await listWorkspaceAppraisals(supabase, agency.id, { q: "", status: "all", page: 1, pageSize: 5 }).catch(() => null);
  return <DashboardOverview agencyName={agency.name} appraisals={result?.rows.slice(0, 5) ?? []} counts={result?.counts ?? {}} loadError={!result} />;
}
