import { requireAgency } from "@/lib/auth/requireUser";
import { NewListingFlow } from "@/components/listings/NewListingFlow";
import type { AgentProfile } from "@/lib/types";

export default async function NewListingPage() {
  const { supabase, agency, user } = await requireAgency();
  const { data: agents } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agency.id)
    .is("archived_at", null)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-gradient text-3xl font-semibold">New listing</h1>
        <p className="text-muted-foreground">
          Find a property, review its details, and create a record for
          appraisals and marketing material.
        </p>
      </div>
      <NewListingFlow
        agencyAgents={(agents ?? []) as AgentProfile[]}
        storageKey={`staypacks:new-listing:${agency.id}:${user.id}`}
      />
    </div>
  );
}
