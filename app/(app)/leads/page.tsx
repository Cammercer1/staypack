import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { LeadsInbox } from "@/components/leads/LeadsInbox";
import type { LeadWithListing } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { supabase, agency } = await requireAgency();

  const { data } = await supabase
    .from("leads")
    .select(
      "*, listings(id, listing_title, property_address, public_slug, status)",
    )
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as LeadWithListing[];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Leads"
        highlight="Your"
        title="enquiry inbox."
        description="Every enquiry from your property pages in one place, grouped by person so you can see who is interested in which properties and follow up fast."
      />
      <LeadsInbox initialLeads={leads} />
    </div>
  );
}
