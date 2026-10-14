import { requireAgency } from "@/lib/auth/requireUser";
import { listWorkspaceAppraisals } from "@/lib/appraisals/workspace";
import { workspaceQuerySchema } from "@/lib/appraisals/workspaceTypes";
import { AppraisalDashboard } from "@/components/appraisals/AppraisalDashboard";
export default async function AppraisalsPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const { agency, supabase } = await requireAgency(); const filters = workspaceQuerySchema.parse(await searchParams);
  return <AppraisalDashboard {...await listWorkspaceAppraisals(supabase,agency.id,filters)} filters={filters} />;
}
