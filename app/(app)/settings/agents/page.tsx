import { AgentsManager } from "@/components/settings/AgentsManager";
import { PageHeader } from "@/components/app-shell/PageHeader";

export default function AgentsSettingsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Agents"
        highlight="Add"
        title="the people on your reports."
        description="Create agent profiles with contact details and photos for buyer-facing report pages."
      />
      <AgentsManager />
    </div>
  );
}
