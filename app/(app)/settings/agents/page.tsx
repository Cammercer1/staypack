import { AgentsManager } from "@/components/settings/AgentsManager";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { requireAgency } from "@/lib/auth/requireUser";
import type { AgentProfile } from "@/lib/types";

export default async function AgentsSettingsPage() {
  const { agency, role, supabase } = await requireAgency();
  const canManage = ["owner", "admin"].includes(role);
  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Agents"
        highlight="Add"
        title="the people on your reports."
        description={
          canManage
            ? "Create agent profiles with contact details and photos for buyer-facing report pages."
            : "View the agent profiles used on buyer-facing report pages."
        }
      />
      <AgentsManager canManage={canManage} initialAgents={(data ?? []) as AgentProfile[]} />
    </div>
  );
}
