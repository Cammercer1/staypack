import { AgentsManager } from "@/components/settings/AgentsManager";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { requireAgency } from "@/lib/auth/requireUser";
import { loadAgentDirectory } from "@/lib/agents/loadDirectory";

export default async function AgentsSettingsPage() {
  const { agency, role, supabase } = await requireAgency();
  const canManage = ["owner", "admin"].includes(role);
  const agents = await loadAgentDirectory(supabase, agency.id);

  return (
    <div className="space-y-10">
      <PageHeader
        highlight="Agents"
        title=""
        description={
          canManage
            ? "Manage the people shown on your listings and reports."
            : "View the agent profiles used on buyer-facing report pages."
        }
      />
      <AgentsManager canManage={canManage} initialAgents={agents} />
    </div>
  );
}
