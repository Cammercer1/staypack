import { requireAgency } from "@/lib/auth/requireUser";
import { notFound } from "next/navigation";
import { LEGACY_PROPERTY_PAGE_TOOLS } from "@/lib/listings/legacyPropertyPages";
import { PageHeader } from "@/components/app-shell/PageHeader";
import type { LeadWithListing } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  if (!LEGACY_PROPERTY_PAGE_TOOLS) notFound();
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
        eyebrow="History"
        highlight="Your"
        title="past enquiries."
        description="Enquiries received before property pages were retired. This history is read-only; contact people through your usual email or phone tools."
      />
      <div className="surface-card overflow-x-auto p-6">
        {leads.length === 0 ? <p className="text-muted-foreground">No historical enquiries.</p> : (
          <table className="w-full text-left text-sm">
            <thead><tr>{["Name", "Email", "Phone", "Property", "Received"].map((label) => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{leads.map((lead) => <tr key={lead.id} className="border-t border-border/60">
              <td className="p-3">{lead.name}</td>
              <td className="p-3">{lead.email ?? "—"}</td>
              <td className="p-3">{lead.phone ?? "—"}</td>
              <td className="p-3">{lead.listings?.property_address ?? lead.listings?.listing_title ?? "Property unavailable"}</td>
              <td className="p-3">{new Date(lead.created_at).toLocaleDateString("en-AU")}</td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
