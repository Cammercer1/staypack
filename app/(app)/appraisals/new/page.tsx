import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { appraisalKindSchema } from "@/lib/appraisals/workspaceTypes";
import { NewStrAppraisalFlow } from "@/components/str-appraisals/NewStrAppraisalFlow";
import { CreateOptions } from "@/components/properties/CreateOptions";
export default async function NewAppraisalPage({ searchParams }: { searchParams: Promise<{ kind?: string; listing_id?: string }> }) {
  const { agency, user } = await requireAgency(); const query = await searchParams;
  const kind = appraisalKindSchema.safeParse(query.kind);
  const listing = query.listing_id ? (await requireListingAccess(query.listing_id)).listing : null;
  if (kind.success) return <NewStrAppraisalFlow key={kind.data} kind={kind.data} initialListing={listing} storageKey={`property-import:${agency.id}:${user.id}`} />;
  return <div data-theme="staypack-workspace" className="max-w-6xl space-y-7 text-base-content"><header><h1 className="font-display text-3xl">Create an appraisal</h1><p className="mt-3 text-base-content/65">Choose an appraisal type.</p></header><CreateOptions listingId={listing?.id} appraisalsOnly /></div>;
}
